import { requireAdmin } from "@/lib/session";
import { db, getSettings } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { dateTime } from "@/lib/format";
import { saveSettings, addAdmin, deleteDemoData } from "../actions";

export const metadata = { title: "الإعدادات" };

export default async function Settings() {
  await requireAdmin();
  const [s, admins, demoUsers, demoProjects] = await Promise.all([
    getSettings(),
    db.user.findMany({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } }),
    db.user.count({ where: { isDemo: true } }),
    db.project.count({ where: { isDemo: true } }),
  ]);
  return (
    <>
      <PageHeader title="الإعدادات" />
      <div className="grid-2">
        <section className="card stack">
          <h2>قواعد البرنامج</h2>
          <ActionForm action={saveSettings}>
            <label className="f">مدة حماية العميل (يوم)<input name="protectDays" id="st-protect" type="number" min={7} max={365} defaultValue={s.protectDays} /></label>
            <label className="f">مدة صرف العمولة بعد الاعتماد (يوم)<input name="payoutDays" id="st-payout" type="number" min={1} max={120} defaultValue={s.payoutDays} /></label>
            <label className="f">جوال الدعم للوسطاء<input name="supportPhone" id="st-phone" dir="ltr" defaultValue={s.supportPhone ?? ""} /></label>
            <label className="f">بريد الدعم<input name="supportEmail" id="st-email" dir="ltr" defaultValue={s.supportEmail ?? ""} /></label>
            <div><Submit>حفظ</Submit></div>
          </ActionForm>
          <p className="xs muted">فئات الوسطاء: برونزي (أساسي)، فضي من 3 صفقات (+0.25%)، ذهبي من 10 صفقات (+0.5%). تُعدّل في src/lib/constants.ts.</p>
        </section>
        <section className="card stack">
          <h2>فريق الإدارة</h2>
          <div className="list">{admins.map((a) => <div key={a.id} className="li"><span className="grow"><span className="title">{a.name}</span><span className="xs muted ltr">{a.phone}</span></span><span className="xs muted">آخر دخول {dateTime(a.lastLoginAt)}</span></div>)}</div>
          <details className="disclose">
            <summary>إضافة مدير</summary>
            <div className="body">
              <ActionForm action={addAdmin} resetOnOk>
                <label className="f">الاسم<input name="name" id="ad-name" required /></label>
                <label className="f">الجوال<input name="phone" id="ad-phone" dir="ltr" inputMode="tel" required /></label>
                <label className="f">كلمة مرور مؤقتة <span className="hint">10 أحرف على الأقل</span><input name="password" id="ad-pw" type="password" autoComplete="new-password" required /></label>
                <div><Submit>إضافة</Submit></div>
              </ActionForm>
            </div>
          </details>
        </section>
      </div>
      {demoUsers === 0 && demoProjects === 0 && s.demoSeededAt && (
        <p className="note n-ok">لا توجد بيانات تجريبية في المنصة. البيانات الحالية حقيقية بالكامل.</p>
      )}
      {(demoUsers > 0 || demoProjects > 0) && (
        <section className="card stack" style={{ borderColor: "var(--warn)" }}>
          <div className="card-h"><h2>البيانات التجريبية</h2><span className="pill t-warn">{demoUsers} وسيط · {demoProjects} مشروع</span></div>
          <p className="small muted">المنصة تحتوي بيانات تجريبية لعرض وظائفها: وسطاء بكل الحالات وعملاء وحجوزات وعمولات. احذفها قبل الإطلاق الرسمي. لا يتأثر أي حساب أو مشروع حقيقي، ولن تُضاف مرة أخرى.</p>
          <p className="small">دخول الوسطاء التجريبيين: الجوال من <span className="ltr">0590000001</span> إلى <span className="ltr">0590000010</span> وكلمة المرور <span className="ltr">Demo-Broker-2026</span></p>
          <ActionForm action={deleteDemoData} className="row">
            <input className="input" name="confirm" id="demo-confirm" placeholder="اكتب: حذف" style={{ width: 160 }} aria-label="تأكيد الحذف" />
            <Submit className="btn btn-danger" pending="جارٍ الحذف…">حذف كل البيانات التجريبية</Submit>
          </ActionForm>
        </section>
      )}
    </>
  );
}
