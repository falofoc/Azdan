import Link from "next/link";
import { requireBroker } from "@/lib/session";
import { db, getSettings } from "@/lib/db";
import { PageHeader, Stat, Empty, StatusPill } from "@/components/ui";
import { COMMISSION_STATUS, DEAL_STATUS } from "@/lib/constants";
import { computeCommission, tierFor } from "@/lib/rules";
import { sar, pct, date } from "@/lib/format";

export const metadata = { title: "عمولاتي" };

export default async function Earnings() {
  const u = await requireBroker();
  const [deals, settings, iban] = await Promise.all([
    db.deal.findMany({ where: { brokerId: u.id, status: { in: ["REQUESTED", "RESERVED", "SOLD"] } }, include: { lead: { select: { id: true, name: true } }, project: { select: { name: true } }, unit: { select: { code: true } } }, orderBy: { requestedAt: "desc" } }),
    getSettings(),
    db.document.findFirst({ where: { userId: u.id, kind: "IBAN" }, select: { id: true } }),
  ]);
  const sold = deals.filter((d) => d.status === "SOLD").length;
  const tier = tierFor(sold);
  const vatReg = !!u.broker!.vatNumber;
  const rows = deals.map((d) => {
    const c = d.status === "SOLD" ? { commission: d.commission, vat: d.vat, total: d.commission + d.vat } : computeCommission(d.value, d.baseRate, tier.bonus, vatReg);
    const state = d.status === "SOLD" ? d.commissionStatus : "EXPECTED";
    return { d, c, state, rate: d.baseRate + (d.status === "SOLD" ? d.bonusRate : tier.bonus) };
  });
  const sum = (st: string) => rows.filter((r) => r.state === st).reduce((s, r) => s + r.c.total, 0);
  const needIban = !u.broker!.iban || !iban;

  return (
    <>
      <PageHeader title="عمولاتي" sub={`العمولة تُحتسب على قيمة الصفقة بنسبة المشروع مضافًا إليها مكافأة الفئة وقت البيع${vatReg ? "، وتشمل ضريبة القيمة المضافة 15%" : ""}.`} />
      {needIban && <div className="note n-warn"><b>أكمل بيانات الصرف:</b> أضف رقم الآيبان وأرفق شهادته من <Link className="link" href="/broker/account">حسابي</Link> قبل صرف أول عمولة.</div>}
      <div className="stats">
        <Stat k="متوقعة" v={sar(sum("EXPECTED"))} s="حجوزات لم تُغلق بعد" />
        <Stat k="معتمدة" v={sar(sum("APPROVED"))} s={`تُصرف خلال ${settings.payoutDays} يومًا`} hl />
        <Stat k="مصروفة" v={sar(sum("PAID"))} />
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>العميل</th><th>المشروع / الوحدة</th><th>الصفقة</th><th>قيمة الصفقة</th><th>النسبة</th><th>العمولة</th>{vatReg && <th>الضريبة</th>}<th>الإجمالي</th><th>حالة العمولة</th><th>التاريخ</th></tr></thead>
            <tbody>
              {rows.map(({ d, c, state, rate }) => (
                <tr key={d.id}>
                  <td><Link className="link" href={`/broker/clients/${d.lead.id}`}>{d.lead.name}</Link></td>
                  <td className="small">{d.project.name}{d.unit ? ` · ${d.unit.code}` : ""}</td>
                  <td><StatusPill map={DEAL_STATUS} value={d.status} /></td>
                  <td className="num">{sar(d.value)}</td>
                  <td className="num">{pct(rate)}</td>
                  <td className="num">{sar(c.commission)}</td>
                  {vatReg && <td className="num">{sar(c.vat)}</td>}
                  <td className="num"><b>{sar(c.total)}</b></td>
                  <td><StatusPill map={COMMISSION_STATUS} value={state} />{d.paymentRef && <div className="xs muted ltr">{d.paymentRef}</div>}</td>
                  <td className="small num">{date(d.paidAt ?? d.approvedAt ?? d.soldAt ?? d.reservedAt ?? d.requestedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="لا عمولات بعد">تظهر هنا العمولة المتوقعة فور طلب حجز وحدة لعميلك، ثم تتحول إلى معتمدة بعد البيع.</Empty>
      )}
    </>
  );
}
