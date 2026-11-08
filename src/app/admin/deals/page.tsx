import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Empty, StatusPill } from "@/components/ui";
import { ConfirmButton } from "@/components/forms";
import { COMMISSION_STATUS, DEAL_STATUS } from "@/lib/constants";
import { sar, pct, dateTime, num } from "@/lib/format";
import { approveReservation, rejectReservation, markSold, markPaid, cancelDeal } from "../actions";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "الحجوزات والصفقات" };

const TABS = [
  { k: "REQUESTED", label: "طلبات الحجز" },
  { k: "RESERVED", label: "محجوزة" },
  { k: "TOPAY", label: "عمولات للصرف" },
  { k: "PAID", label: "مصروفة" },
  { k: "CLOSED", label: "مرفوضة وملغاة" },
];

export default async function Deals({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab = "REQUESTED" } = await searchParams;
  const whereFor = (k: string): Prisma.DealWhereInput =>
    k === "TOPAY" ? { status: "SOLD", commissionStatus: "APPROVED" } : k === "PAID" ? { commissionStatus: "PAID" } : k === "CLOSED" ? { status: { in: ["REJECTED", "CANCELLED"] } } : { status: k };
  const counts = await Promise.all(TABS.map((t) => db.deal.count({ where: whereFor(t.k) })));
  const deals = await db.deal.findMany({
    where: whereFor(tab),
    include: { lead: { select: { name: true, phone: true } }, broker: { select: { id: true, name: true, broker: { select: { iban: true, vatNumber: true, falNumber: true } } } }, project: { select: { name: true } }, unit: { select: { code: true, type: true } } },
    orderBy: tab === "REQUESTED" ? { requestedAt: "asc" } : { updatedAt: "desc" },
    take: 200,
  });

  return (
    <>
      <PageHeader title="الحجوزات والصفقات" sub="أكّد الحجز بعد استلام العربون، وسجّل البيع بعد توقيع العقد واستلام الدفعة المقررة لتُعتمد العمولة تلقائيًا." />
      <div className="chips">
        {TABS.map((t, i) => <Link key={t.k} className="chip" href={`?tab=${t.k}`} aria-current={tab === t.k ? "true" : undefined}>{t.label} <span className="c">{num(counts[i])}</span></Link>)}
      </div>
      {deals.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>العميل</th><th>الوسيط</th><th>المشروع / الوحدة</th><th>القيمة</th><th>العمولة</th><th>الحالة</th><th>التاريخ</th><th>إجراء</th></tr></thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  <td><b>{d.lead.name}</b><div className="xs muted ltr">{d.lead.phone}</div></td>
                  <td><Link className="link" href={`/admin/brokers/${d.broker.id}`}>{d.broker.name}</Link><div className="xs muted">فال {d.broker.broker?.falNumber}</div></td>
                  <td className="small">{d.project.name}{d.unit && <div className="xs muted">{d.unit.code} · {d.unit.type}</div>}</td>
                  <td className="num">{sar(d.value)}</td>
                  <td className="num">{d.status === "SOLD" ? <>{sar(d.commission + d.vat)}<div className="xs muted">{pct(d.baseRate + d.bonusRate)}{d.vat ? " + ضريبة" : ""}</div></> : <span className="muted">{pct(d.baseRate)}</span>}</td>
                  <td><StatusPill map={DEAL_STATUS} value={d.status} />{d.status === "SOLD" && <div style={{ marginTop: 4 }}><StatusPill map={COMMISSION_STATUS} value={d.commissionStatus} /></div>}{d.adminNote && <div className="xs muted">{d.adminNote}</div>}</td>
                  <td className="small num">{dateTime(d.paidAt ?? d.soldAt ?? d.reservedAt ?? d.closedAt ?? d.requestedAt)}{d.paymentRef && <div className="xs muted ltr">{d.paymentRef}</div>}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      {d.status === "REQUESTED" && <>
                        <ConfirmButton action={approveReservation} hidden={{ id: d.id }} label="تأكيد الحجز" className="btn btn-p btn-sm" confirm={`تُحجز الوحدة ${d.unit?.code} للعميل وتُقفل عن بقية الوسطاء.`} />
                        <ConfirmButton action={rejectReservation} hidden={{ id: d.id }} label="رفض" className="btn btn-o btn-sm" confirm="يُبلّغ الوسيط بالسبب ويستطيع طلب وحدة أخرى." field={{ name: "note", label: "السبب", placeholder: "مثال: لم يُستلم العربون" }} />
                      </>}
                      {d.status === "RESERVED" && <>
                        <ConfirmButton action={markSold} hidden={{ id: d.id }} label="تسجيل البيع" className="btn btn-p btn-sm" confirm="بعد توقيع عقد البيع واستلام الدفعة المقررة. تُعتمد العمولة تلقائيًا بنسبة فئة الوسيط." field={{ name: "value", label: "قيمة الصفقة النهائية (ر.س)", defaultValue: String(d.value), inputMode: "numeric", required: true }} />
                        <ConfirmButton action={cancelDeal} hidden={{ id: d.id }} label="إلغاء" className="btn btn-o btn-sm" confirm="تعود الوحدة متاحة ويعود العميل لمرحلة المعاينة مع حماية جديدة للوسيط." field={{ name: "note", label: "السبب" }} />
                      </>}
                      {d.status === "SOLD" && d.commissionStatus === "APPROVED" && (
                        d.broker.broker?.iban
                          ? <ConfirmButton action={markPaid} hidden={{ id: d.id }} label="تسجيل الصرف" className="btn btn-dark btn-sm" confirm={`حوّل ${sar(d.commission + d.vat)} إلى الآيبان ${d.broker.broker.iban}${d.vat ? " مقابل فاتورة ضريبية" : ""}.`} field={{ name: "ref", label: "رقم الحوالة / المرجع", required: true }} />
                          : <span className="xs err">لا آيبان</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="لا عناصر في هذا القسم" />}
    </>
  );
}
