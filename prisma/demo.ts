// بيانات تجريبية شاملة لعرض كل وظائف المنصة.
// تُنشأ مرة واحدة فقط (Settings.demoSeededAt)، وكل سجلاتها معلّمة isDemo
// وتُحذف بزر واحد من لوحة الإدارة → الإعدادات.
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { computeCommission, tierFor } from "../src/lib/rules";

export const DEMO_PASSWORD = "Demo-Broker-2026";
const DAY = 864e5;
const now = Date.now();
const ago = (d: number) => new Date(now - d * DAY);
const ahead = (d: number) => new Date(now + d * DAY);

/* ───── وثيقة PDF تجريبية صغيرة ───── */
function demoPdf(title: string) {
  const text = `DEMO DOCUMENT - AZDAN - ${title}`;
  const stream = `BT /F1 18 Tf 60 760 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function storeFile(buf: Buffer) {
  const key = crypto.randomBytes(16).toString("hex");
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "broker-documents";
  if (url && sk) {
    const h = { Authorization: `Bearer ${sk}`, apikey: sk };
    await fetch(`${url}/storage/v1/bucket`, { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ id: bucket, name: bucket, public: false }) }).catch(() => {});
    const r = await fetch(`${url}/storage/v1/object/${bucket}/${key}`, { method: "POST", headers: { ...h, "Content-Type": "application/pdf" }, body: new Uint8Array(buf) });
    if (!r.ok) throw new Error(`storage ${r.status}`);
  } else {
    const root = path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, key), buf);
  }
  return key;
}

/* ───── المشاريع ───── */
type U = { code: string; type: string; price: number; floor?: string; bedrooms?: number; bathrooms?: number; landArea?: number; builtArea?: number };
const PROJECTS: { slug: string; name: string; city: string; district: string; type: string; status: string; commissionRate: number; priceFrom: number; deliveryDate: string; adLicense?: string; waflLicense?: string; description: string; highlights: string; units: U[] }[] = [
  {
    slug: "demo-villas-north", name: "فلل ازدان الشمال (تجريبي)", city: "الرياض", district: "الملقا", type: "فلل", status: "ACTIVE", commissionRate: 2.5, priceFrom: 1650000, deliveryDate: "الربع الثاني 2027",
    adLicense: "7200000000", waflLicense: "WF-1447-0192", description: "فلل مستقلة بتصميم معاصر وواجهات حجرية، على شوارع بعرض 20 مترًا، مع مسابح خاصة للفلل الزاوية.",
    highlights: "ضمان هيكلي 10 سنوات\nمسبح خاص في الفلل الزاوية\nقرب طريق الملك سلمان\nنظام منزل ذكي",
    units: Array.from({ length: 24 }, (_, i) => ({ code: `V-${String(i + 1).padStart(2, "0")}`, type: "فيلا", bedrooms: 5, bathrooms: 6, landArea: 300 + (i % 3) * 30, builtArea: 360 + (i % 4) * 20, price: 1650000 + (i % 4) * 120000 })),
  },
  {
    slug: "demo-residence", name: "ازدان ريزيدنس (تجريبي)", city: "الرياض", district: "حطين", type: "شقق", status: "ACTIVE", commissionRate: 2, priceFrom: 720000, deliveryDate: "جاهز للسكن",
    adLicense: "7200000001", description: "شقق سكنية بثلاث وأربع غرف في مبنى بخدمات متكاملة ومواقف خاصة.",
    highlights: "تشطيب فاخر\nمواقف خاصة لكل شقة\nحارس وكاميرات 24 ساعة\nنادٍ رياضي للسكان",
    units: Array.from({ length: 24 }, (_, i) => ({ code: `A-${Math.floor(i / 4) + 1}${(i % 4) + 1}`, type: "شقة", floor: String(Math.floor(i / 4) + 1), bedrooms: i % 2 ? 4 : 3, bathrooms: i % 2 ? 4 : 3, builtArea: i % 2 ? 175 : 145, price: (i % 2 ? 890000 : 720000) + Math.floor(i / 4) * 25000 })),
  },
  {
    slug: "demo-floors-narjis", name: "أدوار ازدان النرجس (تجريبي)", city: "الرياض", district: "النرجس", type: "أدوار", status: "ACTIVE", commissionRate: 2.25, priceFrom: 980000, deliveryDate: "الربع الأول 2027",
    adLicense: "7200000002", waflLicense: "WF-1447-0233", description: "أدوار أرضية وعلوية بمداخل مستقلة وسطوح خاصة للأدوار العلوية.",
    highlights: "مدخل مستقل لكل دور\nسطح خاص للدور العلوي\nقرب المدارس والخدمات",
    units: Array.from({ length: 16 }, (_, i) => ({ code: `F-${Math.floor(i / 2) + 1}${i % 2 ? "U" : "G"}`, type: "دور", floor: i % 2 ? "علوي" : "أرضي", bedrooms: 4, bathrooms: i % 2 ? 4 : 5, builtArea: i % 2 ? 210 : 240, price: i % 2 ? 980000 : 1120000 })),
  },
  {
    slug: "demo-land-east", name: "أراضي ازدان الشرق (تجريبي)", city: "الدمام", district: "الفيصلية", type: "أراضٍ", status: "ACTIVE", commissionRate: 1.5, priceFrom: 540000, deliveryDate: "إفراغ فوري",
    adLicense: "7200000003", description: "مخطط سكني مطوّر بالكامل بالخدمات، صكوك جاهزة للإفراغ.",
    highlights: "بنية تحتية مكتملة\nصكوك جاهزة\nقرب طريق الملك فهد",
    units: Array.from({ length: 20 }, (_, i) => ({ code: `L-${100 + i}`, type: "أرض", landArea: 450 + (i % 5) * 50, price: 540000 + (i % 5) * 60000 })),
  },
  {
    slug: "demo-townhouses", name: "تاون هاوس ازدان (تجريبي)", city: "جدة", district: "أبحر الشمالية", type: "تاون هاوس", status: "SOON", commissionRate: 2.5, priceFrom: 1100000, deliveryDate: "2028",
    description: "مشروع قادم: تاون هاوس بإطلالات بحرية. يُفتح باب الحجز قريبًا.", highlights: "قرب الواجهة البحرية\nحدائق مشتركة", units: [],
  },
];

/* ───── الوسطاء ───── */
type BrokerSpec = {
  key: string; name: string; status: string; type?: string; companyName?: string; crNumber?: string; vatNumber?: string; city?: string;
  falDays: number; iban?: string; bank?: string; docs: string[]; note?: string; joinedDaysAgo: number;
};
const BROKERS: BrokerSpec[] = [
  { key: "gold", name: "سعد عبدالله القحطاني", status: "ACTIVE", falDays: 300, iban: "SA0380000000608010167519", bank: "مصرف الراجحي", docs: ["NATIONAL_ID", "FAL", "IBAN"], joinedDaysAgo: 150 },
  { key: "company", name: "عبدالعزيز محمد الدوسري", status: "ACTIVE", type: "COMPANY", companyName: "دار الوساطة للتسويق العقاري", crNumber: "1010456789", vatNumber: "310123456700003", falDays: 400, iban: "SA4420000001234567891234", bank: "البنك الأهلي السعودي", docs: ["NATIONAL_ID", "FAL", "IBAN", "CR"], joinedDaysAgo: 120 },
  { key: "silver", name: "نورة خالد العتيبي", status: "ACTIVE", falDays: 20, iban: "SA1305000068201234567000", bank: "مصرف الإنماء", docs: ["NATIONAL_ID", "FAL", "IBAN"], joinedDaysAgo: 90 },
  { key: "new", name: "فيصل ناصر الشمري", status: "ACTIVE", falDays: 500, docs: ["NATIONAL_ID", "FAL"], joinedDaysAgo: 12, city: "الدمام" },
  { key: "submitted1", name: "ريم سعود الحربي", status: "SUBMITTED", falDays: 250, docs: ["NATIONAL_ID", "FAL", "IBAN"], joinedDaysAgo: 2, city: "جدة" },
  { key: "submitted2", name: "تركي فهد العنزي", status: "SUBMITTED", type: "COMPANY", companyName: "مكتب أركان العقارية", crNumber: "2050123456", falDays: 180, docs: ["NATIONAL_ID", "FAL", "CR"], joinedDaysAgo: 1, city: "الدمام" },
  { key: "changes", name: "ماجد سالم الغامدي", status: "NEEDS_CHANGES", falDays: 90, docs: ["NATIONAL_ID", "FAL"], note: "صورة رخصة فال غير واضحة، أرفق نسخة أوضح تظهر فيها تاريخ الانتهاء.", joinedDaysAgo: 5 },
  { key: "verified", name: "هند عبدالرحمن الزهراني", status: "VERIFIED", falDays: 200, docs: ["NATIONAL_ID", "FAL", "IBAN"], joinedDaysAgo: 3 },
  { key: "suspended", name: "خالد إبراهيم المطيري", status: "SUSPENDED", falDays: -15, docs: ["NATIONAL_ID", "FAL"], note: "رخصة فال منتهية ولم تُجدّد.", joinedDaysAgo: 200, iban: "SA6980000204608016019999" },
  { key: "draft", name: "عمر يوسف السبيعي", status: "DRAFT", falDays: 0, docs: [], joinedDaysAgo: 0 },
];

const FIRST = ["محمد", "عبدالله", "فهد", "سلطان", "ناصر", "بندر", "سارة", "منيرة", "لطيفة", "عبدالرحمن", "يوسف", "حصة", "نواف", "مشاري", "أمل", "ريم", "ياسر", "طلال", "دانة", "وليد", "مها", "سامي", "جواهر", "أحمد"];
const LAST = ["الشهري", "القرني", "البقمي", "الرشيدي", "العمري", "الدوسري", "السهلي", "الزهراني", "الحارثي", "المالكي", "الجهني", "العسيري", "الخالدي", "الشمراني", "اليامي", "السلمي"];
const NOTES = ["تواصلت معه وأرسلت له الكتيّب التعريفي", "يفضّل الوحدات الزاوية", "ينتظر موافقة البنك على التمويل", "طلب زيارة للموقع نهاية الأسبوع", "مهتم بالدور العلوي مع السطح", "يقارن مع مشروع آخر في نفس الحي", "حضر المعاينة وأعجبه التصميم", "يحتاج التسليم قبل بداية العام الدراسي"];
const SOURCES = ["معارف", "سناب شات", "إنستغرام", "تيك توك", "إكس", "واتساب", "زيارة موقع"];
const FIN = ["كاش", "تمويل بنكي", "دعم سكني"];

export async function seedDemo(db: PrismaClient) {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (settings?.demoSeededAt) return;
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  const pw = await bcrypt.hash(DEMO_PASSWORD, 10);
  let seq = 0;
  const nextName = () => `${FIRST[seq % FIRST.length]} ${LAST[(seq * 7) % LAST.length]}`;
  const nextPhone = () => `058${String(1000000 + ++seq).slice(-7)}`;

  // المشاريع والوحدات
  const projects: Record<string, { id: string; rate: number; units: { id: string; price: number; code: string }[] }> = {};
  for (const p of PROJECTS) {
    const { units, ...data } = p;
    let proj = await db.project.findUnique({ where: { slug: p.slug } });
    if (!proj) proj = await db.project.create({ data: { ...data, isDemo: true } });
    else proj = await db.project.update({ where: { id: proj.id }, data: { ...data, isDemo: true } });
    const have = new Set((await db.unit.findMany({ where: { projectId: proj.id }, select: { code: true } })).map((u) => u.code));
    for (const u of units) if (!have.has(u.code)) await db.unit.create({ data: { ...u, projectId: proj.id } });
    const all = await db.unit.findMany({ where: { projectId: proj.id, status: "AVAILABLE" }, orderBy: { code: "asc" } });
    projects[p.slug] = { id: proj.id, rate: p.commissionRate, units: all.map((u) => ({ id: u.id, price: u.price, code: u.code })) };
  }
  const takeUnit = (slug: string) => {
    const u = projects[slug].units.shift();
    if (!u) throw new Error("no units left in " + slug);
    return u;
  };
  const ACTIVE_SLUGS = ["demo-villas-north", "demo-residence", "demo-floors-narjis", "demo-land-east"];

  // الوسطاء
  const brokers: Record<string, { id: string; vat: boolean }> = {};
  for (const [i, b] of BROKERS.entries()) {
    const phone = `05900000${String(i + 1).padStart(2, "0")}`;
    if (await db.user.findUnique({ where: { phone } })) continue;
    const joined = ago(b.joinedDaysAgo);
    const submitted = b.status !== "DRAFT" ? new Date(joined.getTime() + 3600e3) : null;
    const signed = ["ACTIVE", "SUSPENDED"].includes(b.status) ? new Date(joined.getTime() + 2 * DAY) : null;
    const u = await db.user.create({
      data: {
        name: b.name, phone, email: `demo${i + 1}@azdan-demo.sa`, passwordHash: pw, role: "BROKER", isDemo: true, createdAt: joined, lastLoginAt: ago(Math.min(b.joinedDaysAgo, i % 4)),
        broker: {
          create: {
            type: b.type ?? "INDIVIDUAL", companyName: b.companyName, crNumber: b.crNumber, vatNumber: b.vatNumber, city: b.city ?? "الرياض",
            falNumber: b.status === "DRAFT" ? null : `11000${String(54321 + i * 1111).padStart(5, "0")}`, falExpiry: b.status === "DRAFT" ? null : ahead(b.falDays),
            iban: b.iban, bankName: b.bank, status: b.status, reviewNote: b.note ?? null, submittedAt: submitted,
            verifiedAt: ["VERIFIED", "ACTIVE", "SUSPENDED"].includes(b.status) ? new Date(joined.getTime() + DAY) : null,
            signedAt: signed, activatedAt: signed, signatureName: signed ? b.name : null, contractVersion: signed ? "2026.1" : null,
          },
        },
      },
    });
    for (const kind of b.docs) {
      const key = await storeFile(demoPdf(kind));
      await db.document.create({ data: { userId: u.id, kind, fileName: `${kind.toLowerCase()}-demo.pdf`, mime: "application/pdf", size: 600, storageKey: key, uploadedAt: joined } });
    }
    await db.auditLog.create({ data: { actorId: u.id, action: "register", entity: "user", entityId: u.id, createdAt: joined } });
    if (submitted) await db.auditLog.create({ data: { actorId: u.id, action: "submit", entity: "broker", entityId: u.id, createdAt: submitted } });
    if (signed && admin) await db.auditLog.create({ data: { actorId: admin.id, action: "broker.verify", entity: "broker", entityId: u.id, createdAt: new Date(joined.getTime() + DAY) } });
    if (signed) await db.auditLog.create({ data: { actorId: u.id, action: "sign", entity: "broker", entityId: u.id, createdAt: signed } });
    brokers[b.key] = { id: u.id, vat: !!b.vatNumber };
  }
  if (!brokers.gold) { await db.settings.update({ where: { id: 1 }, data: { demoSeededAt: new Date() } }); return; }

  // عميل بمرحلة محددة
  async function lead(brokerKey: string, o: { stage: string; slug?: string; createdDaysAgo: number; follow?: number | null; lostReason?: string; assigned?: boolean; protectLeft?: number }) {
    const b = brokers[brokerKey];
    const phone = nextPhone();
    const name = nextName();
    const created = ago(o.createdDaysAgo);
    const protectedUntil = o.protectLeft !== undefined ? ahead(o.protectLeft) : new Date(created.getTime() + 60 * DAY);
    const notes = [
      { kind: "SYSTEM", text: o.assigned ? "أسندت ازدان هذا العميل إليك" : "سُجّل العميل وحُمي باسم الوسيط", createdAt: created, authorId: o.assigned ? admin?.id : b.id },
      { kind: "NOTE", text: NOTES[seq % NOTES.length], createdAt: new Date(created.getTime() + DAY), authorId: b.id },
    ];
    const l = await db.lead.create({
      data: {
        brokerId: b.id, name, phone, stage: o.stage, projectId: o.slug ? projects[o.slug].id : null, financing: FIN[seq % FIN.length], source: o.assigned ? "إسناد من الشركة" : SOURCES[seq % SOURCES.length],
        budget: 800000 + (seq % 8) * 150000, nextFollowUp: o.follow === null || o.follow === undefined ? null : ahead(o.follow), lostReason: o.lostReason, assignedByAdmin: !!o.assigned,
        consentAt: created, protectedUntil, createdAt: created, notes: { create: notes },
      },
    });
    await db.leadClaim.upsert({ where: { phone }, create: { phone, brokerId: b.id, leadId: l.id, claimedAt: created, expiresAt: ["RESERVED", "SOLD"].includes(o.stage) ? ahead(3650) : protectedUntil }, update: {} });
    return l;
  }

  // صفقة بحالة محددة
  const soldCount: Record<string, number> = {};
  async function deal(brokerKey: string, slug: string, status: string, o: { daysAgo: number; paid?: boolean; note?: string }) {
    const b = brokers[brokerKey];
    const unit = takeUnit(slug);
    const stage = status === "SOLD" ? "SOLD" : status === "RESERVED" ? "RESERVED" : status === "REQUESTED" ? "VISIT" : "VISIT";
    const l = await lead(brokerKey, { stage, slug, createdDaysAgo: o.daysAgo + 12, follow: stage === "VISIT" ? 1 : null });
    const requestedAt = ago(o.daysAgo + 6);
    const rate = projects[slug].rate;
    let extra = {};
    if (status === "SOLD") {
      soldCount[brokerKey] = (soldCount[brokerKey] ?? 0) + 1;
      const tier = tierFor(soldCount[brokerKey]);
      const c = computeCommission(unit.price, rate, tier.bonus, b.vat);
      extra = {
        bonusRate: tier.bonus, commission: c.commission, vat: c.vat, reservedAt: ago(o.daysAgo + 4), soldAt: ago(o.daysAgo), approvedAt: ago(o.daysAgo), closedAt: ago(o.daysAgo),
        commissionStatus: o.paid ? "PAID" : "APPROVED", paidAt: o.paid ? ago(Math.max(0, o.daysAgo - 14)) : null, paymentRef: o.paid ? `TRX-${1000 + seq}` : null,
      };
      await db.unit.update({ where: { id: unit.id }, data: { status: "SOLD" } });
    } else if (status === "RESERVED") {
      extra = { reservedAt: ago(o.daysAgo) };
      await db.unit.update({ where: { id: unit.id }, data: { status: "RESERVED" } });
    } else if (status === "REJECTED" || status === "CANCELLED") {
      extra = { adminNote: o.note, closedAt: ago(o.daysAgo) };
    }
    await db.deal.create({ data: { leadId: l.id, brokerId: b.id, projectId: projects[slug].id, unitId: unit.id, status, value: unit.price, baseRate: rate, requestedAt, ...extra } });
    await db.lead.update({ where: { id: l.id }, data: { unitId: unit.id } });
    const label = { SOLD: "اكتمل البيع واعتُمدت العمولة", RESERVED: `اعتمدت ازدان حجز الوحدة ${unit.code}`, REQUESTED: `طلب حجز الوحدة ${unit.code}`, REJECTED: `رُفض طلب الحجز: ${o.note}`, CANCELLED: `أُلغي الحجز: ${o.note}` }[status];
    await db.leadNote.create({ data: { leadId: l.id, kind: "SYSTEM", text: label!, authorId: admin?.id, createdAt: ago(o.daysAgo) } });
    if (admin && status !== "REQUESTED") await db.auditLog.create({ data: { actorId: admin.id, action: `deal.${status.toLowerCase()}`, entity: "deal", entityId: l.id, createdAt: ago(o.daysAgo) } });
  }

  const S = ACTIVE_SLUGS;
  // الوسيط الذهبي: 11 صفقة مباعة عبر 4 أشهر
  for (let i = 0; i < 11; i++) await deal("gold", S[i % 3], "SOLD", { daysAgo: 115 - i * 10, paid: i < 9 });
  await deal("gold", "demo-villas-north", "RESERVED", { daysAgo: 3 });
  await deal("gold", "demo-residence", "REQUESTED", { daysAgo: 0 });
  // المنشأة (مسجلة ضريبيًا): 4 مبيعات، ثم حجز وطلب ورفض وإلغاء
  for (let i = 0; i < 4; i++) await deal("company", S[(i + 1) % 4], "SOLD", { daysAgo: 95 - i * 22, paid: i < 3 });
  await deal("company", "demo-floors-narjis", "RESERVED", { daysAgo: 6 });
  await deal("company", "demo-land-east", "REQUESTED", { daysAgo: 1 });
  await deal("company", "demo-villas-north", "REJECTED", { daysAgo: 20, note: "لم يُستلم العربون خلال المهلة" });
  await deal("company", "demo-residence", "CANCELLED", { daysAgo: 30, note: "لم يُعتمد تمويل العميل" });
  // نورة: بيعة معتمدة بانتظار الصرف وطلب حجز
  await deal("silver", "demo-residence", "SOLD", { daysAgo: 5, paid: false });
  await deal("silver", "demo-floors-narjis", "REQUESTED", { daysAgo: 0 });

  // عملاء في كل المراحل
  const pipeline: [string, string, string | undefined, number, number | null, string?, boolean?, number?][] = [
    ["gold", "NEW", "demo-villas-north", 1, 0], ["gold", "NEW", undefined, 2, 1], ["gold", "CONTACTED", "demo-residence", 6, -1], ["gold", "CONTACTED", "demo-floors-narjis", 9, 0],
    ["gold", "QUALIFIED", "demo-villas-north", 14, 2], ["gold", "VISIT", "demo-villas-north", 18, 0], ["gold", "VISIT", "demo-floors-narjis", 22, 3],
    ["gold", "LOST", "demo-residence", 40, null, "السعر"], ["gold", "LOST", "demo-land-east", 55, null, "اشترى من مكان آخر"],
    ["gold", "CONTACTED", "demo-residence", 54, 0, undefined, false, 5],
    ["company", "NEW", "demo-land-east", 0, 1], ["company", "CONTACTED", "demo-land-east", 4, 0], ["company", "QUALIFIED", "demo-residence", 10, -2], ["company", "VISIT", "demo-villas-north", 15, 2],
    ["company", "LOST", "demo-floors-narjis", 35, null, "التمويل لم يُعتمد"], ["company", "NEW", "demo-villas-north", 0, 0, undefined, true],
    ["silver", "NEW", "demo-residence", 1, 0], ["silver", "CONTACTED", "demo-villas-north", 7, 1], ["silver", "QUALIFIED", "demo-floors-narjis", 12, 0], ["silver", "LOST", "demo-villas-north", 30, null, "لا يرد"],
    ["new", "NEW", "demo-land-east", 0, 0], ["new", "NEW", "demo-land-east", 1, 1], ["new", "CONTACTED", "demo-land-east", 3, 0], ["new", "QUALIFIED", "demo-villas-north", 8, -1],
    ["new", "CONTACTED", "demo-residence", 57, 2, undefined, false, 3], ["new", "NEW", "demo-floors-narjis", 0, 0, undefined, true],
    ["suspended", "CONTACTED", "demo-residence", 70, null],
  ];
  for (const [k, stage, slug, d, follow, lost, assigned, protectLeft] of pipeline) {
    await lead(k, { stage, slug, createdDaysAgo: d, follow, lostReason: lost, assigned, protectLeft });
  }

  await db.settings.update({ where: { id: 1 }, data: { demoSeededAt: new Date(), supportPhone: "920000000", supportEmail: "brokers@azdan.sa" } });
  console.log("✓ أُضيفت بيانات تجريبية شاملة (كلمة مرور الوسطاء التجريبيين: " + DEMO_PASSWORD + ")");
}

/** حذف كل البيانات التجريبية مع وثائقها */
export async function demoCounts(db: PrismaClient) {
  const [users, projects] = await Promise.all([db.user.count({ where: { isDemo: true } }), db.project.count({ where: { isDemo: true } })]);
  return { users, projects };
}
