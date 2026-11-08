// تهيئة المنصة: الإعدادات، حساب المدير الأول، وبيانات تجريبية اختيارية
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

function normalize(p: string) {
  let d = p.replace(/\D/g, "");
  if (d.startsWith("966")) d = d.slice(3);
  if (d.length === 9) d = "0" + d;
  return d;
}

async function main() {
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, protectDays: 60, payoutDays: 30 }, update: {} });

  const phone = normalize(process.env.ADMIN_PHONE ?? "");
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!/^05\d{8}$/.test(phone) || password.length < 10 || password.startsWith("change-")) {
    console.warn("⚠ ADMIN_PHONE أو ADMIN_PASSWORD غير صالح (كلمة المرور 10 أحرف على الأقل). لم يُنشأ حساب المدير.");
  } else if (!(await db.user.findUnique({ where: { phone } }))) {
    await db.user.create({ data: { phone, name: process.env.ADMIN_NAME || "إدارة إزدان", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) } });
    console.log("✓ أُنشئ حساب المدير:", phone);
  }

  if (process.env.SEED_DEMO !== "1" || (await db.project.count()) > 0) return;

  // مشاريع تجريبية لتجربة المنصة — استبدلها بمشاريع إزدان الفعلية من لوحة الإدارة
  const projects = [
    { slug: "demo-villas-north", name: "فلل إزدان الشمال (تجريبي)", city: "الرياض", district: "الملقا", type: "فلل", commissionRate: 2.5, priceFrom: 1650000, deliveryDate: "الربع الثاني 2027",
      adLicense: "7200000000", description: "مشروع تجريبي لعرض طريقة عمل المنصة. فلل مستقلة بتصميم معاصر وواجهات حجرية.",
      highlights: "ضمان هيكلي 10 سنوات\nمسبح خاص في الفلل الزاوية\nقرب طريق الملك سلمان",
      units: Array.from({ length: 12 }, (_, i) => ({ code: `V-${String(i + 1).padStart(2, "0")}`, type: "فيلا", bedrooms: 5, bathrooms: 6, landArea: 300 + (i % 3) * 30, builtArea: 360 + (i % 4) * 20, price: 1650000 + (i % 4) * 120000 })) },
    { slug: "demo-residence", name: "إزدان ريزيدنس (تجريبي)", city: "الرياض", district: "حطين", type: "شقق", commissionRate: 2, priceFrom: 720000, deliveryDate: "جاهز للسكن",
      adLicense: "7200000001", description: "مشروع تجريبي: شقق سكنية بثلاث وأربع غرف مع مواقف خاصة.",
      highlights: "تشطيب فاخر\nمواقف خاصة لكل شقة\nحارس وكاميرات 24 ساعة",
      units: Array.from({ length: 16 }, (_, i) => ({ code: `A-${Math.floor(i / 4) + 1}${(i % 4) + 1}`, type: "شقة", floor: String(Math.floor(i / 4) + 1), bedrooms: i % 2 ? 4 : 3, bathrooms: i % 2 ? 4 : 3, builtArea: i % 2 ? 175 : 145, price: (i % 2 ? 890000 : 720000) + Math.floor(i / 4) * 25000 })) },
    { slug: "demo-townhouses", name: "تاون هاوس إزدان (تجريبي)", city: "جدة", district: "أبحر الشمالية", type: "تاون هاوس", commissionRate: 2.5, status: "SOON", priceFrom: 1100000, deliveryDate: "2028",
      description: "مشروع تجريبي قادم.", units: [] as { code: string; type: string; price: number }[] },
  ];
  for (const { units, ...p } of projects) {
    await db.project.create({ data: { ...p, units: { create: units } } });
  }
  console.log("✓ أُضيفت مشاريع تجريبية");
}

main().finally(() => db.$disconnect());
