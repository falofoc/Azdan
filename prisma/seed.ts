// تهيئة المنصة: الإعدادات، حساب المدير الأول، وبيانات تجريبية اختيارية
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDemo } from "./demo";

const db = new PrismaClient();

function normalize(p: string) {
  let d = p.replace(/\D/g, "");
  if (d.startsWith("966")) d = d.slice(3);
  if (d.length === 9) d = "0" + d;
  return d;
}

async function main() {
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, protectDays: 60, payoutDays: 30 }, update: {} });

  // توحيد كتابة الاسم: «ازدان» (تحديث البيانات المحفوظة سابقًا بالصيغة القديمة)
  const OLD = "\u0625\u0632\u062f\u0627\u0646"; // إزدان
  await db.$executeRaw`UPDATE \`Project\` SET \`name\` = replace(\`name\`, ${OLD}, 'ازدان'), \`description\` = replace(\`description\`, ${OLD}, 'ازدان') WHERE \`name\` LIKE ${"%" + OLD + "%"} OR \`description\` LIKE ${"%" + OLD + "%"}`;
  await db.$executeRaw`UPDATE \`User\` SET \`name\` = replace(\`name\`, ${OLD}, 'ازدان') WHERE \`name\` LIKE ${"%" + OLD + "%"}`;
  await db.$executeRaw`UPDATE \`LeadNote\` SET \`text\` = replace(\`text\`, ${OLD}, 'ازدان') WHERE \`text\` LIKE ${"%" + OLD + "%"}`;

  const phone = normalize(process.env.ADMIN_PHONE ?? "");
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!/^05\d{8}$/.test(phone) || password.length < 10 || password.startsWith("change-")) {
    console.warn("⚠ ADMIN_PHONE أو ADMIN_PASSWORD غير صالح (كلمة المرور 10 أحرف على الأقل). لم يُنشأ حساب المدير.");
  } else if (!(await db.user.findUnique({ where: { phone } }))) {
    await db.user.create({ data: { phone, name: process.env.ADMIN_NAME || "إدارة ازدان", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) } });
    console.log("✓ أُنشئ حساب المدير:", phone);
  }

  // بيانات تجريبية شاملة (مرة واحدة فقط؛ تُحذف من لوحة الإدارة → الإعدادات)
  if (process.env.SEED_DEMO === "1") await seedDemo(db);
}

main().finally(() => db.$disconnect());
