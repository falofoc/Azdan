"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db, audit } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";
import { normalizePhone, isValidSaudiMobile } from "@/lib/rules";
import { str, type FormState } from "@/lib/form";

// حد بسيط لمحاولات الدخول لكل رقم (في الذاكرة؛ يكفي لخادم واحد)
const attempts = new Map<string, { n: number; until: number }>();
function throttled(key: string) {
  const a = attempts.get(key);
  return !!a && a.n >= 5 && a.until > Date.now();
}
function fail(key: string) {
  const a = attempts.get(key);
  const n = a && a.until > Date.now() ? a.n + 1 : 1;
  attempts.set(key, { n, until: Date.now() + 15 * 60_000 });
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const phone = normalizePhone(str(fd, "phone"));
  const password = str(fd, "password");
  if (!isValidSaudiMobile(phone) || !password) return { error: "أدخل رقم الجوال وكلمة المرور." };
  if (throttled(phone)) return { error: "محاولات كثيرة. حاول بعد 15 دقيقة." };
  const user = await db.user.findUnique({ where: { phone } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    fail(phone);
    return { error: "رقم الجوال أو كلمة المرور غير صحيحة." };
  }
  attempts.delete(phone);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  redirect(user.role === "ADMIN" ? "/admin" : "/broker");
}

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  const phone = normalizePhone(str(fd, "phone"));
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (name.split(/\s+/).length < 2) return { error: "اكتب اسمك الثلاثي كما في الهوية." };
  if (!isValidSaudiMobile(phone)) return { error: "رقم الجوال غير صحيح. مثال: 0551234567" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "البريد الإلكتروني غير صحيح." };
  if (password.length < 8) return { error: "كلمة المرور 8 أحرف على الأقل." };
  if (fd.get("terms") !== "on") return { error: "يلزم الموافقة على شروط البرنامج وسياسة الخصوصية." };
  if (await db.user.findUnique({ where: { phone } })) return { error: "هذا الرقم مسجل مسبقًا. سجّل الدخول بدلًا من ذلك." };
  const user = await db.user.create({
    data: {
      name, phone, email: email || null,
      passwordHash: await bcrypt.hash(password, 12),
      role: "BROKER",
      broker: { create: {} },
    },
  });
  await audit(user.id, "register", "user", user.id, { ip: (await headers()).get("x-forwarded-for") ?? null });
  await createSession(user.id);
  redirect("/broker/onboarding");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
