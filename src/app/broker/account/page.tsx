import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ActionForm, Submit } from "@/components/forms";
import { PageHeader, StatusPill, Pill } from "@/components/ui";
import { BROKER_STATUS, DOC_KINDS, type DocKind } from "@/lib/constants";
import { date, dateTime } from "@/lib/format";
import { updateBank, updateFal, changePassword, uploadDocument } from "../actions";

export const metadata = { title: "حسابي" };

export default async function Account() {
  const u = await requireUser();
  if (u.role === "ADMIN") redirect("/admin");
  const b = u.broker!;
  const docs = await db.document.findMany({ where: { userId: u.id }, orderBy: { uploadedAt: "desc" } });
  const falDays = b.falExpiry ? Math.ceil((+b.falExpiry - Date.now()) / 864e5) : null;
  const iban = docs.find((d) => d.kind === "IBAN");
  return (
    <>
      <PageHeader title="حسابي" sub={<span className="row" style={{ gap: 8 }}>{u.name} <StatusPill map={BROKER_STATUS} value={b.status} /></span>} />
      <div className="grid-2">
        <section className="card stack">
          <h2>البيانات</h2>
          <dl className="kv">
            <dt>الجوال</dt><dd className="ltr">{u.phone}</dd>
            <dt>البريد</dt><dd className="ltr">{u.email ?? "—"}</dd>
            <dt>النوع</dt><dd>{b.type === "COMPANY" ? `منشأة: ${b.companyName ?? "—"}` : "فرد"}</dd>
            {b.crNumber && <><dt>السجل التجاري</dt><dd className="num">{b.crNumber}</dd></>}
            <dt>الرقم الضريبي</dt><dd className="num">{b.vatNumber ?? "غير مسجل"}</dd>
            <dt>المدينة</dt><dd>{b.city}</dd>
            <dt>رخصة فال</dt><dd className="num">{b.falNumber ?? "—"} {falDays !== null && <Pill tone={falDays < 0 ? "bad" : falDays <= 30 ? "warn" : "ok"}>{falDays < 0 ? "منتهية" : `تنتهي ${date(b.falExpiry)}`}</Pill>}</dd>
            {b.signedAt && <><dt>الاتفاقية</dt><dd>وُقّعت {dateTime(b.signedAt)} · إصدار {b.contractVersion}</dd></>}
          </dl>
          <p className="xs muted">لتعديل الاسم أو بيانات المنشأة بعد الاعتماد، تواصل مع فريق إزدان.</p>
        </section>

        <section className="card stack">
          <h2>بيانات صرف العمولة</h2>
          <ActionForm action={updateBank}>
            <label className="f">رقم الآيبان
              <input name="iban" id="iban" dir="ltr" defaultValue={b.iban ?? ""} placeholder="SA00 0000 0000 0000 0000 0000" required />
            </label>
            <label className="f">اسم البنك
              <input name="bankName" id="bankName" defaultValue={b.bankName ?? ""} />
            </label>
            <div><Submit>حفظ الآيبان</Submit></div>
          </ActionForm>
          <div className="stack-sm">
            <span className="small" style={{ fontWeight: 600 }}>شهادة الآيبان {iban ? <Pill tone="ok">مرفقة</Pill> : <Pill tone="warn">مطلوبة قبل الصرف</Pill>}</span>
            <ActionForm action={uploadDocument} className="row" resetOnOk>
              <input type="hidden" name="kind" value="IBAN" />
              <input type="file" name="file" id="iban-file" accept=".pdf,.jpg,.jpeg,.png" aria-label="شهادة الآيبان" required className="file" />
              <Submit className="btn btn-o btn-sm" pending="جارٍ الرفع…">{iban ? "استبدال" : "رفع"}</Submit>
            </ActionForm>
          </div>
        </section>

        {b.status !== "DRAFT" && (
          <section className="card stack">
            <h2>تجديد رخصة فال</h2>
            <p className="small muted">بعد تجديد الرخصة من منصة الهيئة العامة للعقار، أدخل التاريخ الجديد وأرفق صورتها.</p>
            <ActionForm action={updateFal} resetOnOk>
              <label className="f">تاريخ الانتهاء الجديد<input type="date" name="falExpiry" id="fal-exp" required /></label>
              <label className="f">صورة الرخصة<input type="file" name="file" id="fal-file" accept=".pdf,.jpg,.jpeg,.png" required className="file" /></label>
              <div><Submit>تحديث الرخصة</Submit></div>
            </ActionForm>
          </section>
        )}

        <section className="card stack">
          <h2>كلمة المرور</h2>
          <ActionForm action={changePassword} resetOnOk>
            <label className="f">كلمة المرور الحالية<input type="password" name="current" id="pw-cur" autoComplete="current-password" required /></label>
            <label className="f">كلمة المرور الجديدة<input type="password" name="next" id="pw-new" autoComplete="new-password" minLength={8} required /></label>
            <div><Submit>تغيير كلمة المرور</Submit></div>
          </ActionForm>
        </section>
      </div>

      <section className="card">
        <div className="card-h"><h2>وثائقي</h2></div>
        <div className="list">
          {docs.map((d) => (
            <a key={d.id} className="li" href={`/api/files/${d.id}`} target="_blank" rel="noreferrer">
              <span className="grow"><span className="title">{DOC_KINDS[d.kind as DocKind]?.label ?? d.kind}</span><span className="xs muted">{d.fileName}</span></span>
              <span className="xs muted">{dateTime(d.uploadedAt)}</span>
            </a>
          ))}
          {!docs.length && <p className="small muted">لا وثائق مرفوعة.</p>}
        </div>
      </section>
    </>
  );
}
