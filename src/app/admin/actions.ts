"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, audit, getSettings } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { str, optStr, optInt, optFloat, type FormState } from "@/lib/form";
import { CITIES, FINANCING, PROJECT_STATUS, PROJECT_TYPES, UNIT_STATUS, UNIT_TYPES } from "@/lib/constants";
import { DAY_MS, claimBlocks, computeCommission, isValidSaudiMobile, normalizePhone, tierFor } from "@/lib/rules";
import { date } from "@/lib/format";
import { removeUpload } from "@/lib/uploads";

const done = (message?: string): FormState => ({ ok: true, message });
const FAR = () => new Date(Date.now() + 3650 * DAY_MS);

/* ───────────── الوسطاء ───────────── */

export async function reviewBroker(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const decision = str(fd, "decision");
  const note = str(fd, "note").slice(0, 800);
  const b = await db.brokerProfile.findUnique({ where: { userId: id } });
  if (!b) return { error: "الوسيط غير موجود." };
  const now = new Date();
  if (decision === "verify") {
    if (b.status !== "SUBMITTED") return { error: "الطلب ليس قيد المراجعة." };
    if (b.falExpiry && b.falExpiry < now) return { error: "رخصة فال منتهية؛ اطلب التعديل بدلًا من الاعتماد." };
    await db.brokerProfile.update({ where: { userId: id }, data: { status: "VERIFIED", verifiedAt: now, reviewNote: null } });
  } else if (decision === "changes") {
    if (!["SUBMITTED", "VERIFIED"].includes(b.status)) return { error: "لا يمكن طلب تعديل في هذه الحالة." };
    if (!note) return { error: "اكتب ما المطلوب تعديله." };
    await db.brokerProfile.update({ where: { userId: id }, data: { status: "NEEDS_CHANGES", reviewNote: note } });
  } else if (decision === "suspend") {
    if (!note) return { error: "اكتب سبب الإيقاف." };
    await db.brokerProfile.update({ where: { userId: id }, data: { status: "SUSPENDED", reviewNote: note } });
  } else if (decision === "reactivate") {
    if (b.status !== "SUSPENDED") return { error: "الحساب ليس موقوفًا." };
    await db.brokerProfile.update({ where: { userId: id }, data: { status: b.signedAt ? "ACTIVE" : "SUBMITTED", reviewNote: null } });
  } else return { error: "إجراء غير معروف." };
  await audit(admin.id, `broker.${decision}`, "broker", id, note ? { note } : undefined);
  revalidatePath("/admin", "layout");
  return done("حُفظ القرار.");
}

/* ───────────── الحجوزات والصفقات ───────────── */

async function dealFor(id: string) {
  const d = await db.deal.findUnique({ where: { id }, include: { lead: true, unit: true, project: true, broker: { include: { broker: true } } } });
  if (!d) throw new Error("deal not found");
  return d;
}

export async function approveReservation(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const d = await dealFor(str(fd, "id"));
  if (d.status !== "REQUESTED") return { error: "الطلب ليس بانتظار التأكيد." };
  if (!d.unitId) return { error: "لا وحدة مرتبطة بالطلب." };
  const now = new Date();
  try {
    await db.$transaction(async (tx) => {
      const r = await tx.unit.updateMany({ where: { id: d.unitId!, status: "AVAILABLE" }, data: { status: "RESERVED" } });
      if (r.count !== 1) throw new Error("UNIT_TAKEN");
      await tx.deal.update({ where: { id: d.id }, data: { status: "RESERVED", reservedAt: now } });
      await tx.lead.update({ where: { id: d.leadId }, data: { stage: "RESERVED", notes: { create: { kind: "SYSTEM", authorId: admin.id, text: `اعتمدت ازدان حجز الوحدة ${d.unit?.code}` } } } });
      await tx.leadClaim.updateMany({ where: { phone: d.lead.phone, brokerId: d.brokerId }, data: { expiresAt: FAR() } });
    });
  } catch (e) {
    if ((e as Error).message === "UNIT_TAKEN") return { error: "الوحدة لم تعد متاحة. ارفض الطلب ليختار الوسيط وحدة أخرى." };
    throw e;
  }
  await audit(admin.id, "deal.reserve", "deal", d.id);
  revalidatePath("/admin", "layout");
  return done();
}

export async function rejectReservation(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const d = await dealFor(str(fd, "id"));
  if (d.status !== "REQUESTED") return { error: "الطلب ليس بانتظار التأكيد." };
  const note = str(fd, "note") || "لم يكتمل الحجز";
  await db.deal.update({ where: { id: d.id }, data: { status: "REJECTED", adminNote: note, closedAt: new Date() } });
  await db.leadNote.create({ data: { leadId: d.leadId, kind: "SYSTEM", authorId: admin.id, text: `رُفض طلب الحجز: ${note}` } });
  await audit(admin.id, "deal.reject", "deal", d.id, { note });
  revalidatePath("/admin", "layout");
  return done();
}

export async function markSold(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const d = await dealFor(str(fd, "id"));
  if (d.status !== "RESERVED") return { error: "يجب أن تكون الصفقة محجوزة أولًا." };
  const value = optInt(fd, "value") ?? d.value;
  if (value <= 0) return { error: "أدخل قيمة الصفقة النهائية." };
  const soldBefore = await db.deal.count({ where: { brokerId: d.brokerId, status: "SOLD" } });
  const tier = tierFor(soldBefore + 1);
  const c = computeCommission(value, d.baseRate, tier.bonus, !!d.broker.broker?.vatNumber);
  const now = new Date();
  await db.$transaction([
    db.deal.update({ where: { id: d.id }, data: { status: "SOLD", value, bonusRate: tier.bonus, commission: c.commission, vat: c.vat, soldAt: now, commissionStatus: "APPROVED", approvedAt: now, closedAt: now } }),
    ...(d.unitId ? [db.unit.update({ where: { id: d.unitId }, data: { status: "SOLD" } })] : []),
    db.lead.update({ where: { id: d.leadId }, data: { stage: "SOLD", notes: { create: { kind: "SYSTEM", authorId: admin.id, text: `اكتمل البيع بقيمة ${value.toLocaleString("en-US")} ر.س واعتُمدت العمولة` } } } }),
  ]);
  await audit(admin.id, "deal.sold", "deal", d.id, { value, ...c, tier: tier.name });
  revalidatePath("/admin", "layout");
  return done();
}

export async function markPaid(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const d = await dealFor(str(fd, "id"));
  if (d.status !== "SOLD" || d.commissionStatus !== "APPROVED") return { error: "العمولة ليست معتمدة." };
  if (!d.broker.broker?.iban) return { error: "لا يوجد آيبان مسجل للوسيط." };
  const ref = str(fd, "ref");
  if (!ref) return { error: "أدخل رقم الحوالة أو المرجع." };
  await db.deal.update({ where: { id: d.id }, data: { commissionStatus: "PAID", paidAt: new Date(), paymentRef: ref } });
  await audit(admin.id, "deal.paid", "deal", d.id, { ref });
  revalidatePath("/admin", "layout");
  return done();
}

export async function cancelDeal(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const d = await dealFor(str(fd, "id"));
  if (d.status !== "RESERVED") return { error: "يمكن إلغاء الحجوزات المعتمدة فقط." };
  const note = str(fd, "note") || "أُلغي الحجز";
  const { protectDays } = await getSettings();
  await db.$transaction([
    db.deal.update({ where: { id: d.id }, data: { status: "CANCELLED", adminNote: note, closedAt: new Date() } }),
    ...(d.unitId ? [db.unit.update({ where: { id: d.unitId }, data: { status: "AVAILABLE" } })] : []),
    db.lead.update({ where: { id: d.leadId }, data: { stage: "VISIT", protectedUntil: new Date(Date.now() + protectDays * DAY_MS), notes: { create: { kind: "SYSTEM", authorId: admin.id, text: `أُلغي الحجز: ${note}` } } } }),
    db.leadClaim.updateMany({ where: { phone: d.lead.phone, brokerId: d.brokerId }, data: { expiresAt: new Date(Date.now() + protectDays * DAY_MS) } }),
  ]);
  await audit(admin.id, "deal.cancel", "deal", d.id, { note });
  revalidatePath("/admin", "layout");
  return done();
}

/* ───────────── إسناد عميل ───────────── */

export async function assignLead(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const brokerId = str(fd, "brokerId");
  const phone = normalizePhone(str(fd, "phone"));
  const name = str(fd, "name");
  const broker = await db.user.findFirst({ where: { id: brokerId, broker: { status: "ACTIVE" } } });
  if (!broker) return { error: "اختر وسيطًا نشطًا." };
  if (name.length < 2 || !isValidSaudiMobile(phone)) return { error: "اكتب اسم العميل ورقم جوال صحيح." };
  const { protectDays } = await getSettings();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + protectDays * DAY_MS);
  const claim = await db.leadClaim.findUnique({ where: { phone } });
  if (claimBlocks(claim, brokerId, now)) {
    const owner = await db.user.findUnique({ where: { id: claim!.brokerId }, select: { name: true } });
    return { error: `العميل محمي لدى ${owner?.name ?? "وسيط آخر"} حتى ${date(claim!.expiresAt)}.` };
  }
  if (await db.lead.findUnique({ where: { brokerId_phone: { brokerId, phone } } })) return { error: "العميل مسجل لدى هذا الوسيط مسبقًا." };
  const projectId = optStr(fd, "projectId");
  const financing = str(fd, "financing");
  const note = str(fd, "note");
  const lead = await db.lead.create({
    data: {
      brokerId, phone, name, projectId, financing: FINANCING.includes(financing) ? financing : null, source: "إسناد من الشركة", assignedByAdmin: true,
      nextFollowUp: now, protectedUntil: expiresAt, consentAt: now,
      notes: { create: [{ kind: "SYSTEM", authorId: admin.id, text: "أسندت ازدان هذا العميل إليك" }, ...(note ? [{ kind: "NOTE", authorId: admin.id, text: `ملاحظة الإدارة: ${note}` }] : [])] },
    },
  });
  await db.leadClaim.upsert({ where: { phone }, create: { phone, brokerId, leadId: lead.id, expiresAt }, update: { brokerId, leadId: lead.id, claimedAt: now, expiresAt } });
  await audit(admin.id, "lead.assign", "lead", lead.id, { brokerId });
  revalidatePath("/admin", "layout");
  return done(`أُسند العميل إلى ${broker.name}.`);
}

/* ───────────── المشاريع والوحدات ───────────── */

function slugify(s: string) {
  return s.trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").slice(0, 60) || `p-${Date.now()}`;
}

export async function saveProject(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = optStr(fd, "id");
  const name = str(fd, "name");
  const commissionRate = optFloat(fd, "commissionRate");
  const status = str(fd, "status");
  const type = str(fd, "type");
  const city = str(fd, "city");
  if (name.length < 2) return { error: "اكتب اسم المشروع." };
  if (commissionRate === null || commissionRate < 0 || commissionRate > 10) return { error: "نسبة العمولة بين 0 و10%." };
  if (!(status in PROJECT_STATUS) || !PROJECT_TYPES.includes(type) || !CITIES.includes(city)) return { error: "تحقق من الحالة والنوع والمدينة." };
  const url = (k: string) => { const v = optStr(fd, k); return v && /^https:\/\//.test(v) ? v : null; };
  const data = {
    name, status, type, city, commissionRate,
    district: optStr(fd, "district"), description: optStr(fd, "description"), highlights: optStr(fd, "highlights"),
    priceFrom: optInt(fd, "priceFrom"), adLicense: optStr(fd, "adLicense"), waflLicense: optStr(fd, "waflLicense"),
    deliveryDate: optStr(fd, "deliveryDate"), locationUrl: url("locationUrl"), brochureUrl: url("brochureUrl"),
  };
  let pid = id;
  if (id) {
    await db.project.update({ where: { id }, data });
  } else {
    let slug = slugify(name);
    if (await db.project.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    pid = (await db.project.create({ data: { ...data, slug } })).id;
  }
  await audit(admin.id, id ? "project.update" : "project.create", "project", pid!);
  revalidatePath("/admin/projects");
  if (!id) redirect(`/admin/projects/${pid}`);
  return done("حُفظ المشروع.");
}

/** إضافة وحدات دفعة واحدة: سطر لكل وحدة
 *  رقم الوحدة، النوع، السعر، مسطح البناء، مساحة الأرض، الغرف، دورات المياه، الدور */
export async function addUnits(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const projectId = str(fd, "projectId");
  if (!(await db.project.findUnique({ where: { id: projectId } }))) return { error: "المشروع غير موجود." };
  const lines = str(fd, "rows").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { error: "أضف سطرًا واحدًا على الأقل." };
  if (lines.length > 500) return { error: "500 وحدة كحد أقصى في المرة الواحدة." };
  const n = (v?: string) => { const x = Number(String(v ?? "").replace(/[,\s]/g, "")); return v && Number.isFinite(x) ? x : null; };
  const rows = [];
  for (const [i, line] of lines.entries()) {
    const [code, type, price, built, land, beds, baths, floor] = line.split(/[,،\t]/).map((s) => s.trim());
    if (!code || !UNIT_TYPES.includes(type) || !n(price)) return { error: `السطر ${i + 1}: يلزم رقم الوحدة ونوع صحيح (${UNIT_TYPES.join("/")}) والسعر.` };
    rows.push({ projectId, code, type, price: Math.round(n(price)!), builtArea: n(built), landArea: n(land), bedrooms: n(beds), bathrooms: n(baths), floor: floor || null });
  }
  const existing = new Set((await db.unit.findMany({ where: { projectId, code: { in: rows.map((r) => r.code) } }, select: { code: true } })).map((u) => u.code));
  const fresh = rows.filter((r) => !existing.has(r.code));
  for (const r of fresh) await db.unit.create({ data: r });
  await audit(admin.id, "units.add", "project", projectId, { count: fresh.length });
  revalidatePath(`/admin/projects/${projectId}`);
  return done(`أُضيفت ${fresh.length} وحدة${existing.size ? `، وتُجوهلت ${existing.size} موجودة مسبقًا` : ""}.`);
}

export async function updateUnit(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const unit = await db.unit.findUnique({ where: { id: str(fd, "id") }, include: { deals: { where: { status: { in: ["REQUESTED", "RESERVED"] } } } } });
  if (!unit) return { error: "الوحدة غير موجودة." };
  const price = optInt(fd, "price");
  const status = str(fd, "status");
  if (!price || price <= 0) return { error: "السعر غير صحيح." };
  if (!(status in UNIT_STATUS)) return { error: "حالة غير صحيحة." };
  if (status !== unit.status && unit.deals.length) return { error: "على الوحدة حجز أو طلب قائم؛ عالجه من صفحة الحجوزات." };
  await db.unit.update({ where: { id: unit.id }, data: { price, status } });
  await audit(admin.id, "unit.update", "unit", unit.id, { price, status });
  revalidatePath(`/admin/projects/${unit.projectId}`);
  return done();
}

export async function deleteUnit(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const unit = await db.unit.findUnique({ where: { id: str(fd, "id") }, include: { _count: { select: { deals: true } } } });
  if (!unit) return { error: "الوحدة غير موجودة." };
  if (unit._count.deals) return { error: "لا يمكن حذف وحدة مرتبطة بصفقات؛ غيّر حالتها إلى «غير متاحة»." };
  await db.unit.delete({ where: { id: unit.id } });
  await audit(admin.id, "unit.delete", "unit", unit.id);
  revalidatePath(`/admin/projects/${unit.projectId}`);
  return done();
}

/* ───────────── الإعدادات ───────────── */

export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const protectDays = optInt(fd, "protectDays");
  const payoutDays = optInt(fd, "payoutDays");
  if (!protectDays || protectDays < 7 || protectDays > 365) return { error: "مدة الحماية بين 7 و365 يومًا." };
  if (!payoutDays || payoutDays < 1 || payoutDays > 120) return { error: "مدة الصرف بين 1 و120 يومًا." };
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, protectDays, payoutDays }, update: { protectDays, payoutDays, supportPhone: optStr(fd, "supportPhone"), supportEmail: optStr(fd, "supportEmail") } });
  await audit(admin.id, "settings.update", "settings", "1", { protectDays, payoutDays });
  revalidatePath("/", "layout");
  return done("حُفظت الإعدادات. تُطبّق مدة الحماية الجديدة على العملاء المسجلين من الآن.");
}

export async function addAdmin(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const name = str(fd, "name");
  const phone = normalizePhone(str(fd, "phone"));
  const password = str(fd, "password");
  if (name.length < 2 || !isValidSaudiMobile(phone)) return { error: "اكتب الاسم ورقم جوال صحيح." };
  if (password.length < 10) return { error: "كلمة المرور 10 أحرف على الأقل لحسابات الإدارة." };
  if (await db.user.findUnique({ where: { phone } })) return { error: "الرقم مسجل مسبقًا." };
  const u = await db.user.create({ data: { name, phone, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) } });
  await audit(admin.id, "admin.create", "user", u.id);
  revalidatePath("/admin/settings");
  return done(`أُضيف ${name} إلى فريق الإدارة.`);
}

/* ───────────── البيانات التجريبية ───────────── */

export async function deleteDemoData(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (str(fd, "confirm") !== "حذف") return { error: "اكتب كلمة «حذف» للتأكيد." };
  const users = await db.user.findMany({ where: { isDemo: true }, select: { id: true, documents: { select: { storageKey: true } } } });
  const ids = users.map((u) => u.id);
  const keys = users.flatMap((u) => u.documents.map((d) => d.storageKey));
  await db.leadClaim.deleteMany({ where: { brokerId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } }); // تحذف معها العملاء والصفقات والوثائق والملاحظات
  for (const k of keys) await removeUpload(k);
  // المشاريع التجريبية: تُحذف إن لم تعد عليها صفقات حقيقية، وإلا تُخفى
  const projects = await db.project.findMany({ where: { isDemo: true }, select: { id: true, _count: { select: { deals: true } } } });
  let hidden = 0;
  for (const p of projects) {
    if (p._count.deals) { await db.project.update({ where: { id: p.id }, data: { status: "HIDDEN" } }); hidden++; }
    else await db.project.delete({ where: { id: p.id } });
  }
  await audit(admin.id, "demo.delete", "settings", "1", { users: ids.length, projects: projects.length });
  revalidatePath("/", "layout");
  return done(`حُذف ${ids.length} وسيط تجريبي و${projects.length - hidden} مشروع تجريبي${hidden ? `، وأُخفي ${hidden} لارتباطه بصفقات حقيقية` : ""}.`);
}
