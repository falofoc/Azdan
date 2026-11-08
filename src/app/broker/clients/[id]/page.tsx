import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBroker } from "@/lib/session";
import { db } from "@/lib/db";
import { ActionForm, Submit, ConfirmButton } from "@/components/forms";
import { PageHeader, StatusPill, Pill } from "@/components/ui";
import { BROKER_STAGES, DEAL_STATUS, LOST_REASONS, STAGE_MAP, stageOf, COMMISSION_STATUS } from "@/lib/constants";
import { computeCommission, tierFor } from "@/lib/rules";
import { date, dateTime, sar, pct, num, relDays } from "@/lib/format";
import { updateLead, addNote, requestReservation, cancelRequest } from "../../actions";
import { LeadFields } from "../../LeadFields";

export const metadata = { title: "ملف العميل" };

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const u = await requireBroker();
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const lead = await db.lead.findFirst({
    where: { id, brokerId: u.id },
    include: { notes: { orderBy: { createdAt: "desc" }, take: 80 }, project: true, unit: true, deal: { include: { unit: true, project: true } } },
  });
  if (!lead) notFound();

  const [projects, sold] = await Promise.all([
    db.project.findMany({ where: { status: { in: ["ACTIVE", "SOON"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.deal.count({ where: { brokerId: u.id, status: "SOLD" } }),
  ]);
  const tier = tierFor(sold);
  const deal = lead.deal;
  const activeDeal = deal && ["REQUESTED", "RESERVED", "SOLD"].includes(deal.status) ? deal : null;
  const locked = ["RESERVED", "SOLD"].includes(lead.stage);
  const canReserve = !activeDeal && !["SOLD", "LOST"].includes(lead.stage);
  const units = canReserve && lead.projectId
    ? await db.unit.findMany({ where: { projectId: lead.projectId, status: "AVAILABLE", project: { status: "ACTIVE" } }, orderBy: [{ price: "asc" }], take: 200 })
    : [];
  const vatReg = !!u.broker!.vatNumber;
  const est = activeDeal ? computeCommission(activeDeal.value, activeDeal.baseRate, activeDeal.status === "SOLD" ? activeDeal.bonusRate : tier.bonus, vatReg) : null;

  return (
    <>
      <Link href="/broker/clients" className="link small">→ عملائي</Link>
      <PageHeader
        title={lead.name}
        sub={<span className="row" style={{ gap: 8 }}><span className="ltr">{lead.phone}</span><StatusPill map={STAGE_MAP} value={lead.stage} />{lead.assignedByAdmin && <Pill tone="info">مُسند من إزدان</Pill>}</span>}
        actions={<a className="btn btn-o" href={`https://wa.me/966${lead.phone.slice(1)}`} target="_blank" rel="noreferrer">واتساب</a>}
      />

      {isNew && <div className="note n-ok"><b>سُجّل العميل وحُمي باسمك حتى {date(lead.protectedUntil)}.</b> أضف موعد المتابعة القادم ليظهر في متابعاتك.</div>}

      <div className="detail">
        <div className="stack" style={{ minWidth: 0 }}>
          {activeDeal && est && (
            <section className="card stack deal-card">
              <div className="row-between">
                <h2>{activeDeal.status === "REQUESTED" ? "طلب حجز قيد التأكيد" : activeDeal.status === "RESERVED" ? "حجز معتمد" : "صفقة مكتملة"}</h2>
                <StatusPill map={DEAL_STATUS} value={activeDeal.status} />
              </div>
              <dl className="kv">
                <dt>المشروع</dt><dd>{activeDeal.project.name}</dd>
                <dt>الوحدة</dt><dd>{activeDeal.unit ? `${activeDeal.unit.code} · ${activeDeal.unit.type}${activeDeal.unit.builtArea ? ` · ${num(activeDeal.unit.builtArea)} م²` : ""}` : "—"}</dd>
                <dt>قيمة الصفقة</dt><dd className="num">{sar(activeDeal.value)}</dd>
                <dt>النسبة</dt><dd className="num">{pct(activeDeal.baseRate)}{(activeDeal.status === "SOLD" ? activeDeal.bonusRate : tier.bonus) > 0 && ` + ${pct(activeDeal.status === "SOLD" ? activeDeal.bonusRate : tier.bonus)} مكافأة الفئة`}</dd>
                <dt>{activeDeal.status === "SOLD" ? "العمولة" : "العمولة المتوقعة"}</dt>
                <dd className="num"><b>{sar(activeDeal.status === "SOLD" ? activeDeal.commission + activeDeal.vat : est.total)}</b>{vatReg && <span className="xs muted"> شاملة الضريبة</span>}</dd>
                {activeDeal.status === "SOLD" && <><dt>حالة العمولة</dt><dd><StatusPill map={COMMISSION_STATUS} value={activeDeal.commissionStatus} /></dd></>}
                <dt>تاريخ الطلب</dt><dd>{dateTime(activeDeal.requestedAt)}</dd>
                {activeDeal.reservedAt && <><dt>تاريخ الحجز</dt><dd>{dateTime(activeDeal.reservedAt)}</dd></>}
                {activeDeal.soldAt && <><dt>تاريخ البيع</dt><dd>{dateTime(activeDeal.soldAt)}</dd></>}
              </dl>
              {activeDeal.status === "REQUESTED" && (
                <div className="row-between">
                  <span className="xs muted">يتواصل فريق المبيعات مع العميل لتأكيد الحجز واستلام العربون.</span>
                  <ConfirmButton action={cancelRequest} hidden={{ id: lead.id }} label="إلغاء الطلب" className="btn btn-o btn-sm" confirm="سيُلغى طلب حجز الوحدة. يمكنك طلب وحدة أخرى بعدها." />
                </div>
              )}
            </section>
          )}

          {deal && ["REJECTED", "CANCELLED"].includes(deal.status) && (
            <div className="note n-warn"><b>{deal.status === "REJECTED" ? "رُفض طلب الحجز السابق" : "أُلغي طلب الحجز السابق"}</b>{deal.adminNote ? `: ${deal.adminNote}` : "."} يمكنك طلب حجز وحدة أخرى.</div>
          )}

          {canReserve && (
            <section className="card stack">
              <div className="card-h"><h2>طلب حجز وحدة</h2><span className="xs muted">الوحدات المتاحة الآن{lead.project ? ` في ${lead.project.name}` : ""}</span></div>
              {!lead.projectId ? (
                <p className="small muted">حدّد المشروع الذي يهتم به العميل في البيانات أدناه لتظهر وحداته المتاحة.</p>
              ) : units.length === 0 ? (
                <p className="small muted">لا توجد وحدات متاحة حاليًا في هذا المشروع.</p>
              ) : (
                <ActionForm action={requestReservation}>
                  <input type="hidden" name="id" value={lead.id} />
                  <div className="units-pick" role="radiogroup" aria-label="الوحدة">
                    {units.map((x) => {
                      const c = computeCommission(x.price, lead.project!.commissionRate, tier.bonus, vatReg);
                      return (
                        <label key={x.id} className="unit-opt">
                          <input type="radio" name="unitId" value={x.id} required />
                          <span className="stack-sm" style={{ gap: 2 }}>
                            <b>وحدة {x.code}</b>
                            <span className="xs muted">{[x.type, x.bedrooms ? `${x.bedrooms} غرف` : null, x.builtArea ? `${num(x.builtArea)} م²` : null, x.floor ? `الدور ${x.floor}` : null].filter(Boolean).join(" · ")}</span>
                          </span>
                          <span className="stack-sm" style={{ gap: 2, textAlign: "end" }}>
                            <b className="num">{sar(x.price)}</b>
                            <span className="xs num" style={{ color: "var(--accent)" }}>عمولتك ≈ {sar(c.total)}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <label className="f">ملاحظة لفريق المبيعات <span className="hint">اختياري</span>
                    <input name="note" id="res-note" placeholder="مثال: العميل جاهز لدفع العربون يوم الأحد" />
                  </label>
                  <div><Submit pending="جارٍ الإرسال…">إرسال طلب الحجز</Submit></div>
                </ActionForm>
              )}
            </section>
          )}

          <section className="card stack">
            <div className="card-h"><h2>بيانات العميل</h2>{locked && <span className="xs muted">المرحلة والمشروع يحددهما الحجز</span>}</div>
            <ActionForm action={updateLead}>
              <input type="hidden" name="id" value={lead.id} />
              <LeadFields projects={projects} lead={lead} lockProject={locked} />
              {!locked && (
                <div className="form-2">
                  <label className="f">المرحلة
                    <select name="stage" id="lead-stage" defaultValue={lead.stage}>
                      {BROKER_STAGES.map((k) => <option key={k} value={k}>{stageOf(k).label}</option>)}
                    </select>
                  </label>
                  <label className="f">سبب عدم الاهتمام <span className="hint">عند اختيار «غير مهتم»</span>
                    <select name="lostReason" id="lead-lost" defaultValue={lead.lostReason ?? ""}>
                      <option value="">—</option>
                      {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </label>
                </div>
              )}
              <div><Submit>حفظ التغييرات</Submit></div>
            </ActionForm>
          </section>
        </div>

        <aside className="stack" style={{ minWidth: 0 }}>
          <section className="card stack-sm">
            <h3>الحماية</h3>
            {locked ? <p className="small">محمي باسمك حتى إغلاق الصفقة.</p> : (
              <p className="small">محمي باسمك حتى <b>{date(lead.protectedUntil)}</b> <span className="muted">({relDays(lead.protectedUntil)})</span></p>
            )}
            <p className="xs muted">سُجّل {date(lead.createdAt)}{lead.source ? ` · المصدر: ${lead.source}` : ""}</p>
          </section>

          <section className="card stack">
            <h3>سجل المتابعة</h3>
            <ActionForm action={addNote} resetOnOk className="form">
              <input type="hidden" name="id" value={lead.id} />
              <label className="f"><span className="sr-only">ملاحظة</span>
                <textarea name="text" id="note-text" placeholder="ماذا حدث في آخر تواصل؟" required />
              </label>
              <label className="f">موعد المتابعة القادم <span className="hint">اختياري</span>
                <input type="date" name="nextFollowUp" id="note-follow" />
              </label>
              <div><Submit className="btn btn-dark btn-sm">إضافة</Submit></div>
            </ActionForm>
            <div className="timeline">
              {lead.notes.map((n) => (
                <div key={n.id} className={n.kind !== "NOTE" ? "sys" : ""}>
                  <time>{dateTime(n.createdAt)}</time>
                  <span className={n.kind !== "NOTE" ? "muted" : ""}>{n.text}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
