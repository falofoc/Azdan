import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/forms";
import { VSteps } from "@/components/ui";
import { currentUser } from "@/lib/session";
import { register } from "../actions";

export const metadata = { title: "انضم كوسيط" };

export default async function RegisterPage() {
  const u = await currentUser();
  if (u) redirect(u.role === "ADMIN" ? "/admin" : "/broker");
  return (
    <div className="stack">
      <div className="stack-sm">
        <span className="eyebrow">المرحلة 1 من 4: التسجيل</span>
        <h1>إنشاء حساب وسيط</h1>
        <p className="muted">بعدها تكمل بيانات رخصة فال والوثائق، ثم نراجع طلبك خلال يومي عمل.</p>
      </div>
      <ActionForm action={register}>
        <label className="f">الاسم الثلاثي
          <input name="name" id="name" autoComplete="name" required />
        </label>
        <label className="f">رقم الجوال
          <input name="phone" id="phone" inputMode="tel" autoComplete="tel" placeholder="05xxxxxxxx" dir="ltr" required />
        </label>
        <label className="f">البريد الإلكتروني <span className="hint">اختياري، لإرسال كشوف العمولة</span>
          <input name="email" id="email" type="email" autoComplete="email" dir="ltr" />
        </label>
        <label className="f">كلمة المرور <span className="hint">8 أحرف على الأقل</span>
          <input name="password" id="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label className="check">
          <input type="checkbox" name="terms" id="terms" />
          <span>أوافق على <Link className="link" href="/terms" target="_blank">شروط برنامج الوسطاء</Link> و<Link className="link" href="/privacy" target="_blank">سياسة الخصوصية</Link> وفق نظام حماية البيانات الشخصية.</span>
        </label>
        <Submit className="btn btn-p btn-block" pending="جارٍ الإنشاء…">إنشاء الحساب</Submit>
      </ActionForm>
      <p className="small muted">لديك حساب؟ <Link className="link" href="/login">سجّل الدخول</Link></p>
      <section className="card-flat stack">
        <h3>مراحل الانضمام</h3>
        <VSteps steps={[
          { title: "التسجيل", state: "cur", desc: "أنشئ حسابك، ثم أكمل بيانات رخصة فال وارفع الوثائق." },
          { title: "التحقق", state: "todo", desc: "يراجع فريق ازدان طلبك خلال يومي عمل." },
          { title: "التفعيل", state: "todo", desc: "توقّع اتفاقية الوساطة إلكترونيًا فيُفعّل حسابك." },
          { title: "البداية", state: "todo", desc: "سجّل عملاءك واحجز لهم وتابع عمولتك." },
        ]} />
      </section>
    </div>
  );
}
