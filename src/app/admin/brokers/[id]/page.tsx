import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { db, getSettings } from "@/lib/db";
import { PageHeader, StatusPill, Pill, Stat } from "@/components/ui";
import { ActionForm, Submit, ConfirmButton } from "@/components/forms";
import { BROKER_STATUS, DEAL_STATUS, DOC_KINDS, STAGE_MAP, FINANCING, type DocKind } from "@/lib/constants";
import { tierFor } from "@/lib/rules";
import { date, dateTime, num, sar } from "@/lib/format";
import { reviewBroker, assignLead } from "../../actions";

export const metadata = { title: "ملف الوسيط" };

export default async function BrokerDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const u = await db.user.findFirst({
    where: { id, role: "BROKER" },
    include: { broker: true, documents: { orderBy: { uploadedAt: "desc" } }, leads: { orderBy: { updatedAt: "desc" }, take: 50, include: { project: { select: { name: true } } } }, deals: { orderBy: { updatedAt: "desc" }, include: { project: { select: { name: true } }, lead: { select: { name: true } } } } },
  });
  if (!u || !u.broker) notFound();
  const b = u.broker;
  const [projects, settings, log] = await Promise.all([
    db.project.findMany({ where: { status: { in: ["ACTIVE", "SOON"] } }, select: { id: true, name: true } }),
    getSettings(),
    db.auditLog.findMany({ where: { OR: [{ entityId: id }, { actorId: id }] }, orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { name: true } } } }),
  ]);
  const sold = u.deals.filter((d) => d.status === "SOLD");
  const falExpired = b.falExpiry ? b.falExpiry < new Date() : false;

  return (
    <>
      <Link className="link small" href="/admin/brokers">→ الوسطاء</Link>
      <PageHeader title={u.name} sub={<span className="row" style={{ gap: 8 }}><span className="ltr">{u.phone}</span><StatusPill map={BROKER_STATUS} value={b.status} /><Pill>{tierFor(sold.length).name}</Pill></span>} />

      {b.status === "SUBMITTED" && (
        <section className="card stack">
          <h2>قرار المراجعة</h2>
          <p className="small muted">تحقّق من سريان رخصة فال عبر منصة الهيئة العامة للعقار ومطابقة الاسم والهوية قبل الاعتماد. بعد الاعتماد يوقّع الوسيط الاتفاقية فيُفعّل حسابه.</p>
          <div className="row">
            <ConfirmButton action={reviewBroker} hidden={{ id, decision: "verify" }} label="اعتماد الوثائق" className="btn btn-p" confirm="تظهر للوسيط اتفاقية الوساطة للتوقيع." />
            <ConfirmButton action={reviewBroker} hidden={{ id, decision: "changes" }} label="طلب تعديل" className="btn btn-o" confirm="يعود الطلب للوسيط مع ملاحظتك." field={{ name: "note", label: "المطلوب تعديله", required: true }} />
          </div>
        </section>
      )}
      {b.reviewNote && <div className="note n-warn"><b>آخر ملاحظة:</b> {b.reviewNote}</div>}

      <div className="stats">
        <Stat k="العملاء" v={num(u.leads.length)} />
        <Stat k="صفقات مباعة" v={num(sold.length)} s={sar(sold.reduce((s, d) => s + d.value, 0))} />
        <Stat k="عمولات مستحقة" v={sar(sold.filter((d) => d.commissionStatus === "APPROVED").reduce((s, d) => s + d.commission + d.vat, 0))} />
        <Stat k="عمولات مصروفة" v={sar(sold.filter((d) => d.commissionStatus === "PAID").reduce((s, d) => s + d.commission + d.vat, 0))} />
      </div>

      <div className="detail">
        <div className="stack" style={{ minWidth: 0 }}>
          <section className="card stack">
            <h2>بيانات الوسيط</h2>
            <dl className="kv">
              <dt>النوع</dt><dd>{b.type === "COMPANY" ? `منشأة: ${b.companyName}` : "فرد"}</dd>
              {b.crNumber && <><dt>السجل التجاري</dt><dd className="num">{b.crNumber}</dd></>}
              <dt>رخصة فال</dt><dd className="num">{b.falNumber ?? "—"} <span className={falExpired ? "err" : "muted"}>· {falExpired ? "منتهية" : "تنتهي"} {date(b.falExpiry)}</span></dd>
              <dt>الرقم الضريبي</dt><dd className="num">{b.vatNumber ?? "غير مسجل"}</dd>
              <dt>المدينة</dt><dd>{b.city}</dd>
              <dt>البريد</dt><dd className="ltr">{u.email ?? "—"}</dd>
              <dt>الآيبان</dt><dd className="ltr">{b.iban ?? "—"}{b.bankName ? ` · ${b.bankName}` : ""}</dd>
              <dt>أُرسل الطلب</dt><dd>{dateTime(b.submittedAt)}</dd>
              {b.signedAt && <><dt>التوقيع</dt><dd>{dateTime(b.signedAt)} · «{b.signatureName}» · إصدار {b.contractVersion}{b.signatureIp ? ` · ${b.signatureIp}` : ""}</dd></>}
            </dl>
          </section>

          <section className="card">
            <div className="card-h"><h2>الصفقات</h2></div>
            {u.deals.length ? <div className="list">{u.deals.map((d) => (
              <div key={d.id} className="li"><span className="grow"><span className="title">{d.lead.name}</span><span className="xs muted">{d.project.name} · <span className="num">{sar(d.value)}</span></span></span><StatusPill map={DEAL_STATUS} value={d.status} /></div>
            ))}</div> : <p className="small muted">لا صفقات.</p>}
          </section>

          <section className="card">
            <div className="card-h"><h2>العملاء</h2><span className="xs muted">آخر 50</span></div>
            {u.leads.length ? <div className="table-wrap"><table className="t"><thead><tr><th>العميل</th><th>المرحلة</th><th>المشروع</th><th>الحماية</th></tr></thead><tbody>
              {u.leads.map((l) => <tr key={l.id}><td>{l.name}<div className="xs muted ltr">{l.phone}</div></td><td><StatusPill map={STAGE_MAP} value={l.stage} /></td><td className="small">{l.project?.name ?? "—"}</td><td className="small num">{date(l.protectedUntil)}</td></tr>)}
            </tbody></table></div> : <p className="small muted">لا عملاء.</p>}
          </section>
        </div>

        <aside className="stack" style={{ minWidth: 0 }}>
          <section className="card stack-sm">
            <h3>الوثائق</h3>
            {(Object.keys(DOC_KINDS) as DocKind[]).map((k) => {
              const d = u.documents.find((x) => x.kind === k);
              return <div key={k} className="row-between small"><span>{DOC_KINDS[k].label}</span>{d ? <a className="link" href={`/api/files/${d.id}`} target="_blank" rel="noreferrer">عرض</a> : <span className="muted">غير مرفقة</span>}</div>;
            })}
          </section>

          {b.status === "ACTIVE" && (
            <section className="card stack">
              <h3>إسناد عميل لهذا الوسيط</h3>
              <ActionForm action={assignLead} resetOnOk>
                <input type="hidden" name="brokerId" value={id} />
                <label className="f">اسم العميل<input name="name" id="as-name" required /></label>
                <label className="f">الجوال<input name="phone" id="as-phone" dir="ltr" inputMode="tel" placeholder="05xxxxxxxx" required /></label>
                <label className="f">المشروع<select name="projectId" id="as-proj"><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                <label className="f">طريقة الشراء<select name="financing" id="as-fin">{FINANCING.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="f">ملاحظة<input name="note" id="as-note" /></label>
                <Submit className="btn btn-dark">إسناد العميل</Submit>
              </ActionForm>
              <p className="xs muted">يُحمى العميل للوسيط {settings.protectDays} يومًا.</p>
            </section>
          )}

          <section className="card stack-sm">
            <h3>إجراءات الحساب</h3>
            {b.status === "SUSPENDED" ? (
              <ConfirmButton action={reviewBroker} hidden={{ id, decision: "reactivate" }} label="إعادة التفعيل" className="btn btn-p btn-sm" confirm="يعود الحساب لحالته قبل الإيقاف." />
            ) : b.status !== "DRAFT" && (
              <ConfirmButton action={reviewBroker} hidden={{ id, decision: "suspend" }} label="إيقاف الحساب" className="btn btn-danger btn-sm" confirm="لن يستطيع الوسيط تسجيل عملاء أو طلب حجوزات. العمولات المستحقة محفوظة." field={{ name: "note", label: "سبب الإيقاف", required: true }} />
            )}
          </section>

          <section className="card stack-sm">
            <h3>سجل التدقيق</h3>
            <div className="timeline">{log.map((l) => <div key={l.id} className="sys"><time>{dateTime(l.createdAt)}</time><span className="small">{l.action} · {l.actor?.name ?? "النظام"}</span></div>)}</div>
          </section>
        </aside>
      </div>
    </>
  );
}
