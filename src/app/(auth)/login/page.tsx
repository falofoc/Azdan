import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/forms";
import { currentUser } from "@/lib/session";
import { login } from "../actions";

export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage() {
  const u = await currentUser();
  if (u) redirect(u.role === "ADMIN" ? "/admin" : "/broker");
  return (
    <div className="stack">
      <div className="stack-sm">
        <h1>تسجيل الدخول</h1>
        <p className="muted">ادخل لوحتك لمتابعة عملائك وعمولاتك.</p>
      </div>
      <ActionForm action={login}>
        <label className="f">رقم الجوال
          <input name="phone" id="phone" inputMode="tel" autoComplete="tel" placeholder="05xxxxxxxx" dir="ltr" required />
        </label>
        <label className="f">كلمة المرور
          <input name="password" id="password" type="password" autoComplete="current-password" required />
        </label>
        <Submit className="btn btn-p btn-block" pending="جارٍ الدخول…">دخول</Submit>
      </ActionForm>
      <p className="small muted">ليس لديك حساب؟ <Link className="link" href="/register">انضم كوسيط</Link></p>
    </div>
  );
}
