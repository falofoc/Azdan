"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db, audit, getSettings } from "@/lib/db";
import { requireBroker, requireUser } from "@/lib/session";
import { saveUpload, removeUpload } from "@/lib/uploads";
import { str, optStr, optInt, optDate, type FormState } from "@/lib/form";
import { BROKER_STAGES, CITIES, DOC_KINDS, FINANCING, SOURCES, CONTRACT_VERSION, LOST_REASONS, stageOf, type DocKind } from "@/lib/constants";
import { DAY_MS, isValidFal, isValidSaudiIban, isValidSaudiMobile, normalizeIban, normalizePhone, claimBlocks } from "@/lib/rules";
import { date } from "@/lib/format";

const EDITABLE = ["DRAFT", "NEEDS_CHANGES"];

/* ───────────── الانضمام ───────────── */

export async function saveProfile(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireBroker({ active: false });
  const b = u.broker!;
  if (!EDITABLE.includes(b.status)) return { error: "لا يمكن تعديل البيانات أثناء المراجعة." };
  const type = str(fd, "type") === "COMPANY" ? "COMPANY" : "INDIVIDUAL";
  const falNumber = str(fd, "falNumber").replace(/\D/g, "");
  const falExpiry = optDate(fd, "falExpiry");
  const city = str(fd, "city");
  const companyName = optStr(fd, "companyName");
  const crNumber = optStr(fd, "crNumber")?.replace(/\D/g, "") || null;
  const vatNumber = optStr(fd, "vatNumber")?.replace(/\D/g, "") || null;
  if (!isValidFal(falNumber)) return { error: "رقم رخصة فال غير صحيح (أرقام فقط)." };
  if (!falExpiry) return { error: "أدخل تاريخ انتهاء رخصة فال." };
  if (falExpiry.getTime() < Date.now()) return { error: "رخصة فال منتهية. جدّدها من منصة الهيئة العامة للعقار ثم أكمل التسجيل." };
  if (!CITIES.includes(city)) return { error: "اختر المدينة." };
  if (type === "COMPANY" && (!companyName || !crNumber)) return { error: "اسم المنشأة ورقم السجل التجاري مطلوبان للمنشآت." };
  if (crNumber && !/^\d{10}$/.test(crNumber)) return { error: "رقم السجل التجاري 10 أرقام." };
  if (vatNumber && !/^3\d{13}3$/.test(vatNumber)) return { error: "الرقم الضريبي 15 رقمًا يبدأ وينتهي بالرقم 3." };
  await db.brokerProfile.update({
    where: { userId: u.id },
    data: { type, falNumber, falExpiry, city, companyName: type === "COMPANY" ? companyName : null, crNumber: type === "COMPANY" ? crNumber : null, vatNumber },
  });
  revalidatePath("/broker/onboarding");
  return { ok: true, message: "حُفظت البيانات." };
}

export async function uploadDocument(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireBroker({ active: false });
  const kind = str(fd, "kind") as DocKind;
  if (!(kind in DOC_KINDS)) return { error: "نوع الوثيقة غير معروف." };
  // الآيبان يمكن تحديثه في أي وقت؛ بقية الوثائق أثناء التسجيل فقط
  if (kind !== "IBAN" && !EDITABLE.includes(u.broker!.status)) return { error: "لا يمكن تغيير الوثائق بعد إرسال الطلب." };
  let saved;
  try {
    saved = await saveUpload(fd.get("file") as File);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const old = await db.document.findMany({ where: { userId: u.id, kind } });
  await db.document.create({ data: { userId: u.id, kind, ...saved } });
  for (const o of old) {
    await db.document.delete({ where: { id: o.id } });
    await removeUpload(o.storageKey);
  }
  await audit(u.id, "upload", "document", kind);
  revalidatePath("/broker/onboarding");
  revalidatePath("/broker/account");
  return { ok: true, message: "رُفعت الوثيقة." };
}

export async function submitApplication(_: FormState): Promise<FormState> {
  const u = await requireBroker({ active: false });
  const b = u.broker!;
  if (!EDITABLE.includes(b.status)) return { error: "الطلب مُرسل مسبقًا." };
  if (!b.falNumber || !b.falExpiry) return { error: "أكمل بيانات رخصة فال أولًا." };
  const docs = await db.document.findMany({ where: { userId: u.id }, select: { kind: true } });
  const have = new Set(docs.map((d) => d.kind));
  const missing = (Object.keys(DOC_KINDS) as DocKind[]).filter((k) => (DOC_KINDS[k].required || (k === "CR" && b.type === "COMPANY")) && !have.has(k));
  if (missing.length) return { error: "وثائق ناقصة: " + missing.map((k) => DOC_KINDS[k].label).join("، ") };
  await db.brokerProfile.update({ where: { userId: u.id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
  await audit(u.id, "submit", "broker", u.id);
  revalidatePath("/broker/onboarding");
  return { ok: true };
}

export async function signContract(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireBroker({ active: false });
  if (u.broker!.status !== "VERIFIED") return { error: "الاتفاقية غير متاحة للتوقيع الآن." };
  const sig = str(fd, "signature");
  if (fd.get("agree") !== "on") return { error: "يلزم الإقرار بقراءة الاتفاقية والموافقة عليها." };
  if (sig.replace(/\s+/g, " ") !== u.name.replace(/\s+/g, " ")) return { error: `اكتب اسمك كما هو مسجل: ${u.name}` };
  const h = await headers();
  const now = new Date();
  await db.brokerProfile.update({
    where: { userId: u.id },
    data: { status: "ACTIVE", signedAt: now, activatedAt: now, signatureName: sig, signatureIp: h.get("x-forwarded-for")?.split(",")[0] ?? null, contractVersion: CONTRACT_VERSION },
  });
  await audit(u.id, "sign", "broker", u.id, { version: CONTRACT_VERSION });
  redirect("/broker?welcome=1");
}

/* ───────────── العملاء ───────────── */

function leadFields(fd: FormData) {
  const projectId = optStr(fd, "projectId");
  const financing = str(fd, "financing");
  const source = str(fd, "source");
  return {
    name: str(fd, "name"),
    projectId,
    financing: FINANCING.includes(financing) ? financing : null,
    source: SOURCES.includes(source) ? source : null,
    budget: optInt(fd, "budget"),
    nextFollowUp: optDate(fd, "nextFollowUp"),
  };
}

class Protected extends Error {}

export async function createLead(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireBroker();
  const phone = normalizePhone(str(fd, "phone"));
  const f = leadFields(fd);
  if (f.name.length < 2) return { error: "اكتب اسم العميل." };
  if (!isValidSaudiMobile(phone)) return { error: "رقم جوال العميل غير صحيح. مثال: 0551234567" };
  if (fd.get("consent") !== "on") return { error: "أكّد أن العميل وافق على مشاركة بياناته مع إزدان." };
  if (u.broker!.falExpiry && u.broker!.falExpiry.getTime() < Date.now()) return { error: "رخصة فال منتهية. حدّثها من صفحة حسابي لتسجيل عملاء جدد." };
  if (f.projectId && !(await db.project.findFirst({ where: { id: f.projectId, status: { not: "HIDDEN" } } }))) f.projectId = null;
  const own = await db.lead.findUnique({ where: { brokerId_phone: { brokerId: u.id, phone } } });
  if (own) return { error: "هذا العميل مسجل لديك مسبقًا." };

  const { protectDays } = await getSettings();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + protectDays * DAY_MS);
  const note = str(fd, "note");
  let leadId = "";
  try {
    await db.$transaction(async (tx) => {
      const claim = await tx.leadClaim.findUnique({ where: { phone } });
      if (claimBlocks(claim, u.id, now)) throw new Protected(date(claim!.expiresAt));
      const lead = await tx.lead.create({
        data: { ...f, brokerId: u.id, phone, stage: "NEW", protectedUntil: expiresAt, consentAt: now,
          notes: { create: [{ kind: "SYSTEM", text: `سُجّل العميل وحُمي باسمك حتى ${date(expiresAt)}`, authorId: u.id }, ...(note ? [{ kind: "NOTE", text: note, authorId: u.id }] : [])] } },
      });
      leadId = lead.id;
      if (!claim) {
        await tx.leadClaim.create({ data: { phone, brokerId: u.id, leadId: lead.id, expiresAt } });
      } else {
        // مطالبة منتهية أو تخص الوسيط نفسه: تُحدّث بشرط ألا يكون غيره قد سبقه
        const r = await tx.leadClaim.updateMany({
          where: { phone, OR: [{ brokerId: u.id }, { expiresAt: { lte: now } }] },
          data: { brokerId: u.id, leadId: lead.id, claimedAt: now, expiresAt },
        });
        if (r.count !== 1) throw new Protected("");
      }
    });
  } catch (e) {
    if (e instanceof Protected) return { error: e.message ? `هذا العميل محمي لوسيط آخر حتى ${e.message}. لا يمكن تسجيله الآن.` : "هذا العميل محمي لوسيط آخر." };
    if ((e as { code?: string }).code === "P2002") return { error: "هذا العميل مسجل لدى وسيط آخر الآن." };
    throw e;
  }
  await audit(u.id, "create", "lead", leadId);
  redirect(`/broker/clients/${leadId}?new=1`);
}

async function ownLead(userId: string, id: string) {
  const lead = await db.lead.findFirst({ where: { id, brokerId: userId }, include: { deal: true } });
  if (!lead) throw new Error("not found");
  return lead;
}

export async function updateLead(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireBroker();
  const lead = await ownLead(u.id, str(fd, "id"));
  const f = leadFields(fd);
  if (f.name.length < 2) return { error: "اكتب اسم العميل." };
  const stage = str(fd, "stage");
  const locked = ["RESERVED", "SOLD"].includes(lead.stage);
  const nextStage = locked ? lead.stage : BROKER_STAGES.includes(stage as never) ? stage : lead.stage;
  const lostReason = nextStage === "LOST" ? (LOST_REASONS.includes(str(fd, "lostReason")) ? str(fd, "lostReason") : "أخرى") : null;
  if (f.projectId && !(await db.project.findFirst({ where: { id: f.projectId, status: { not: "HIDDEN" } } }))) f.projectId = null;
  const notes = [];
  if (nextStage !== lead.stage) notes.push({ kind: "STAGE", text: `نُقل إلى مرحلة: ${stageOf(nextStage).label}${lostReason ? ` (${lostReason})` : ""}`, authorId: u.id });
  await db.lead.update({
    where: { id: lead.id },
    data: { ...f, projectId: locked ? lead.projectId : f.projectId, stage: nextStage, lostReason, notes: { create: notes } },
  });
  revalidatePath(`/broker/clients/${lead.id}`);
  revalidatePath("/broker/clients");
  return { ok: true, message: "حُفظت التغييرات." };
}

export async function addNote(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireBroker();
  const lead = await ownLead(u.id, str(fd, "id"));
  const text = str(fd, "text").slice(0, 1000);
  if (!text) return { error: "اكتب الملاحظة." };
  const follow = optDate(fd, "nextFollowUp");
  await db.lead.update({ where: { id: lead.id }, data: { notes: { create: { kind: "NOTE", text, authorId: u.id } }, ...(follow ? { nextFollowUp: follow } : {}) } });
  revalidatePath(`/broker/clients/${lead.id}`);
  return { ok: true };
}

export async function requestReservation(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireBroker();
  const lead = await ownLead(u.id, str(fd, "id"));
  if (["RESERVED", "SOLD", "LOST"].includes(lead.stage)) return { error: "لا يمكن طلب حجز لعميل في هذه المرحلة." };
  if (lead.deal && ["REQUESTED", "RESERVED", "SOLD"].includes(lead.deal.status)) return { error: "يوجد طلب حجز قائم لهذا العميل." };
  const unit = await db.unit.findUnique({ where: { id: str(fd, "unitId") }, include: { project: true } });
  if (!unit || unit.project.status !== "ACTIVE") return { error: "اختر وحدة من مشروع متاح للبيع." };
  if (unit.status !== "AVAILABLE") return { error: "هذه الوحدة لم تعد متاحة. اختر وحدة أخرى." };
  const note = str(fd, "note").slice(0, 500);
  const data = {
    brokerId: u.id, projectId: unit.projectId, unitId: unit.id, status: "REQUESTED", value: unit.price, baseRate: unit.project.commissionRate,
    bonusRate: 0, commission: 0, vat: 0, commissionStatus: "EXPECTED", adminNote: null, requestedAt: new Date(), reservedAt: null, soldAt: null, approvedAt: null, paidAt: null, closedAt: null,
  };
  await db.$transaction([
    db.deal.upsert({ where: { leadId: lead.id }, create: { leadId: lead.id, ...data }, update: data }),
    db.lead.update({
      where: { id: lead.id },
      data: { projectId: unit.projectId, unitId: unit.id, notes: { create: { kind: "SYSTEM", authorId: u.id, text: `طلب حجز الوحدة ${unit.code} في ${unit.project.name}${note ? ` — ${note}` : ""}` } } },
    }),
  ]);
  await audit(u.id, "request", "deal", lead.id, { unit: unit.id });
  revalidatePath(`/broker/clients/${lead.id}`);
  return { ok: true, message: "أُرسل طلب الحجز. سيتواصل فريق المبيعات لتأكيده." };
}

export async function cancelRequest(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireBroker();
  const lead = await ownLead(u.id, str(fd, "id"));
  if (lead.deal?.status !== "REQUESTED") return { error: "لا يوجد طلب حجز قابل للإلغاء." };
  await db.deal.update({ where: { id: lead.deal.id }, data: { status: "CANCELLED", closedAt: new Date() } });
  await db.leadNote.create({ data: { leadId: lead.id, kind: "SYSTEM", authorId: u.id, text: "ألغى الوسيط طلب الحجز" } });
  revalidatePath(`/broker/clients/${lead.id}`);
  return { ok: true };
}

/* ───────────── الحساب ───────────── */

export async function updateBank(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireBroker({ active: false });
  const iban = normalizeIban(str(fd, "iban"));
  if (!isValidSaudiIban(iban)) return { error: "رقم الآيبان غير صحيح. يبدأ بـ SA ويتكون من 24 خانة." };
  await db.brokerProfile.update({ where: { userId: u.id }, data: { iban, bankName: optStr(fd, "bankName") } });
  await audit(u.id, "update", "iban", u.id);
  revalidatePath("/broker/account");
  return { ok: true, message: "حُفظ الآيبان." };
}

export async function updateFal(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireBroker({ active: false });
  const falExpiry = optDate(fd, "falExpiry");
  if (!falExpiry || falExpiry.getTime() < Date.now()) return { error: "أدخل تاريخ انتهاء صالح لرخصة فال المجددة." };
  let saved;
  try {
    saved = await saveUpload(fd.get("file") as File);
  } catch (e) {
    return { error: "أرفق صورة الرخصة المجددة: " + (e as Error).message };
  }
  const old = await db.document.findMany({ where: { userId: u.id, kind: "FAL" } });
  await db.document.create({ data: { userId: u.id, kind: "FAL", ...saved } });
  for (const o of old) { await db.document.delete({ where: { id: o.id } }); await removeUpload(o.storageKey); }
  await db.brokerProfile.update({ where: { userId: u.id }, data: { falExpiry } });
  await audit(u.id, "renew", "fal", u.id);
  revalidatePath("/broker/account");
  return { ok: true, message: "حُدّثت رخصة فال." };
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const cur = str(fd, "current");
  const next = str(fd, "next");
  if (!(await bcrypt.compare(cur, u.passwordHash))) return { error: "كلمة المرور الحالية غير صحيحة." };
  if (next.length < 8) return { error: "كلمة المرور الجديدة 8 أحرف على الأقل." };
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  await audit(u.id, "password", "user", u.id);
  return { ok: true, message: "تغيّرت كلمة المرور." };
}
