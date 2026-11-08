import { redirect } from "next/navigation";
import { requireBroker } from "@/lib/session";
import { db, getSettings } from "@/lib/db";
import { ActionForm, Submit } from "@/components/forms";
import { PageHeader, Stepper, Pill } from "@/components/ui";
import { CITIES, DOC_KINDS, type DocKind } from "@/lib/constants";
import { contractClauses, contractVersion } from "@/lib/contract";
import { date, dateTime, toDateInput } from "@/lib/format";
import { saveProfile, uploadDocument, submitApplication, signContract } from "../actions";

export const metadata = { title: "طلب الانضمام" };

const STEPS = ["البيانات والوثائق", "مراجعة إزدان", "توقيع الاتفاقية", "التفعيل"];

export default async function Onboarding() {
  const u = await requireBroker({ active: false });
  const b = u.broker!;
  if (b.status === "ACTIVE") redirect("/broker");
  const [docs, settings] = await Promise.all([db.document.findMany({ where: { userId: u.id }, orderBy: { uploadedAt: "desc" } }), getSettings()]);
  const docOf = (k: DocKind) => docs.find((d) => d.kind === k);
  const step = { DRAFT: 0, NEEDS_CHANGES: 0, SUBMITTED: 1, VERIFIED: 2, SUSPENDED: 3 }[b.status] ?? 0;

  return (
    <>
      <PageHeader eyebrow="برنامج وسطاء إزدان" title="طلب الانضمام" sub={`أهلًا ${u.name.split(" ")[0]}، أكمل الخطوات التالية لتفعيل حسابك.`} />
      <Stepper steps={STEPS} current={step} />

      {b.status === "SUSPENDED" && (
        <div className="note n-bad"><b>الحساب موقوف.</b> {b.reviewNote ?? "تواصل مع فريق إزدان لمعرفة السبب."}</div>
      )}

      {b.status === "NEEDS_CHANGES" && (
        <div className="note n-warn"><b>مطلوب تعديل قبل الاعتماد:</b> {b.reviewNote}</div>
      )}

      {(b.status === "DRAFT" || b.status === "NEEDS_CHANGES") && (
        <>
          <section className="card stack">
            <div className="card-h"><h2>بيانات الوسيط</h2><span className="xs muted">حسب رخصة فال الصادرة من الهيئة العامة للعقار</span></div>
            <ActionForm action={saveProfile}>
              <fieldset className="choice" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="f" style={{ marginBottom: 6 }}>نوع الحساب</legend>
                <label><input type="radio" name="type" value="INDIVIDUAL" defaultChecked={b.type !== "COMPANY"} /><span><b>فرد</b><br /><span className="xs muted">وسيط مرخّص برخصة فال شخصية</span></span></label>
                <label><input type="radio" name="type" value="COMPANY" defaultChecked={b.type === "COMPANY"} /><span><b>منشأة</b><br /><span className="xs muted">مكتب أو شركة وساطة وتسويق</span></span></label>
              </fieldset>
              <div className="form-2">
                <label className="f">رقم رخصة فال
                  <input name="falNumber" id="falNumber" inputMode="numeric" dir="ltr" defaultValue={b.falNumber ?? ""} placeholder="1100000000" required />
                </label>
                <label className="f">تاريخ انتهاء الرخصة
                  <input name="falExpiry" id="falExpiry" type="date" defaultValue={toDateInput(b.falExpiry)} required />
                </label>
                <label className="f">المدينة
                  <select name="city" id="city" defaultValue={b.city}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select>
                </label>
                <label className="f">الرقم الضريبي <span className="hint">اختياري، إن كنت مسجلًا في ضريبة القيمة المضافة</span>
                  <input name="vatNumber" id="vatNumber" inputMode="numeric" dir="ltr" defaultValue={b.vatNumber ?? ""} placeholder="3xxxxxxxxxxxxx3" />
                </label>
                <label className="f">اسم المنشأة <span className="hint">للمنشآت فقط</span>
                  <input name="companyName" id="companyName" defaultValue={b.companyName ?? ""} />
                </label>
                <label className="f">رقم السجل التجاري <span className="hint">للمنشآت فقط</span>
                  <input name="crNumber" id="crNumber" inputMode="numeric" dir="ltr" defaultValue={b.crNumber ?? ""} />
                </label>
              </div>
              <div><Submit>حفظ البيانات</Submit></div>
            </ActionForm>
          </section>

          <section className="card stack">
            <div className="card-h"><h2>الوثائق</h2><span className="xs muted">PDF أو JPG أو PNG، حتى 5 ميجابايت للملف</span></div>
            <div className="docs">
              {(Object.keys(DOC_KINDS) as DocKind[]).filter((k) => k !== "CR" || b.type === "COMPANY").map((k) => {
                const d = docOf(k);
                const req = DOC_KINDS[k].required || k === "CR";
                return (
                  <div key={k} className="doc-row">
                    <div className="stack-sm" style={{ minWidth: 0 }}>
                      <div className="row"><b>{DOC_KINDS[k].label}</b>{req ? <Pill tone={d ? "ok" : "warn"}>{d ? "مرفقة" : "مطلوبة"}</Pill> : <Pill tone={d ? "ok" : "muted"}>{d ? "مرفقة" : "اختيارية الآن"}</Pill>}</div>
                      {d && <a className="xs link" href={`/api/files/${d.id}`} target="_blank" rel="noreferrer">{d.fileName} · {dateTime(d.uploadedAt)}</a>}
                      {k === "IBAN" && !d && <span className="xs muted">مطلوبة قبل صرف أول عمولة.</span>}
                    </div>
                    <ActionForm action={uploadDocument} className="row" resetOnOk>
                      <input type="hidden" name="kind" value={k} />
                      <input type="file" name="file" id={`file-${k}`} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-label={DOC_KINDS[k].label} required className="file" />
                      <Submit className="btn btn-o btn-sm" pending="جارٍ الرفع…">{d ? "استبدال" : "رفع"}</Submit>
                    </ActionForm>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card row-between">
            <div className="stack-sm">
              <h2>إرسال الطلب للمراجعة</h2>
              <p className="small muted">نراجع الطلب خلال يومي عمل، وتصلك النتيجة هنا.</p>
            </div>
            <ActionForm action={submitApplication} className="stack-sm">
              <Submit pending="جارٍ الإرسال…">إرسال الطلب</Submit>
            </ActionForm>
          </section>
        </>
      )}

      {b.status === "SUBMITTED" && (
        <section className="card stack">
          <div className="row"><Pill tone="info">قيد المراجعة</Pill><span className="small muted">أُرسل {dateTime(b.submittedAt)}</span></div>
          <h2>طلبك لدى فريق إزدان</h2>
          <p className="muted">نتحقق من سريان رخصة فال ومطابقة الوثائق. عند الاعتماد تظهر لك اتفاقية الوساطة للتوقيع هنا مباشرة.</p>
          <dl className="kv">
            <dt>رخصة فال</dt><dd className="num">{b.falNumber} · تنتهي {date(b.falExpiry)}</dd>
            <dt>النوع</dt><dd>{b.type === "COMPANY" ? `منشأة: ${b.companyName}` : "فرد"}</dd>
            <dt>الوثائق</dt><dd>{docs.map((d) => DOC_KINDS[d.kind as DocKind]?.label).join("، ")}</dd>
          </dl>
        </section>
      )}

      {b.status === "VERIFIED" && (
        <section className="card stack">
          <div className="row"><Pill tone="ok">تم التحقق من وثائقك</Pill></div>
          <h2>اتفاقية الوساطة العقارية</h2>
          <div className="contract">
            <p><b>الطرف الأول:</b> شركة إزدان. <b>الطرف الثاني:</b> {b.type === "COMPANY" ? `${b.companyName}، سجل تجاري ${b.crNumber}، ويمثلها ${u.name}` : u.name}، رخصة فال رقم <span className="num">{b.falNumber}</span>.</p>
            <ol>{contractClauses(settings.protectDays, settings.payoutDays).map((c, i) => <li key={i}>{c}</li>)}</ol>
            <p className="xs muted">إصدار الاتفاقية {contractVersion()}</p>
          </div>
          <ActionForm action={signContract}>
            <label className="check"><input type="checkbox" name="agree" id="agree" /><span>قرأت الاتفاقية وأوافق على جميع بنودها.</span></label>
            <label className="f">التوقيع: اكتب اسمك الثلاثي كما هو مسجل
              <input name="signature" id="signature" placeholder={u.name} autoComplete="off" required />
            </label>
            <div><Submit pending="جارٍ التوقيع…">توقيع وتفعيل الحساب</Submit></div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
