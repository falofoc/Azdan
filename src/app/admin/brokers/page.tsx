import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Empty, StatusPill, Pill } from "@/components/ui";
import { BROKER_STATUS } from "@/lib/constants";
import { tierFor } from "@/lib/rules";
import { date, num, sar } from "@/lib/format";

export const metadata = { title: "الوسطاء" };

export default async function Brokers({ searchParams }: { searchParams: Promise<{ s?: string; q?: string }> }) {
  await requireAdmin();
  const { s = "all", q = "" } = await searchParams;
  const counts = await db.brokerProfile.groupBy({ by: ["status"], _count: true });
  const term = q.trim();
  const brokers = await db.brokerProfile.findMany({
    where: { ...(s !== "all" ? { status: s } : {}), ...(term ? { OR: [{ user: { name: { contains: term } } }, { user: { phone: { contains: term } } }, { falNumber: { contains: term } }, { companyName: { contains: term } }] } : {}) },
    include: { user: { select: { name: true, phone: true, isDemo: true, _count: { select: { leads: true } } } } },
    orderBy: [{ submittedAt: "desc" }],
    take: 300,
  });
  const sales = await db.deal.groupBy({ by: ["brokerId"], where: { status: "SOLD", brokerId: { in: brokers.map((b) => b.userId) } }, _count: true, _sum: { value: true } });
  const saleOf = (id: string) => sales.find((x) => x.brokerId === id);
  const now = Date.now();
  return (
    <>
      <PageHeader title="الوسطاء" sub="طلبات الانضمام والوسطاء المعتمدون." />
      <form className="row" role="search">
        <input type="hidden" name="s" value={s} />
        <input className="input" style={{ flex: 1, minWidth: 0 }} name="q" defaultValue={term} placeholder="الاسم، الجوال، رقم فال، أو المنشأة" aria-label="بحث" />
        <button className="btn btn-o">بحث</button>
      </form>
      <div className="chips">
        <Link className="chip" href="?s=all" aria-current={s === "all" ? "true" : undefined}>الكل <span className="c">{num(counts.reduce((a, c) => a + c._count, 0))}</span></Link>
        {Object.entries(BROKER_STATUS).map(([k, v]) => <Link key={k} className="chip" href={`?s=${k}`} aria-current={s === k ? "true" : undefined}>{v.label} <span className="c">{num(counts.find((c) => c.status === k)?._count ?? 0)}</span></Link>)}
      </div>
      {brokers.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>الوسيط</th><th>النوع</th><th>رخصة فال</th><th>الحالة</th><th>العملاء</th><th>المبيعات</th><th>الفئة</th></tr></thead>
            <tbody>
              {brokers.map((b) => {
                const sale = saleOf(b.userId);
                const exp = b.falExpiry ? +b.falExpiry < now : false;
                return (
                  <tr key={b.userId}>
                    <td><Link className="link" href={`/admin/brokers/${b.userId}`}>{b.user.name}</Link>{b.user.isDemo && <span className="pill t-warn" style={{ marginInlineStart: 6 }}>تجريبي</span>}<div className="xs muted ltr">{b.user.phone}</div></td>
                    <td className="small">{b.type === "COMPANY" ? b.companyName : "فرد"}<div className="xs muted">{b.city}</div></td>
                    <td className="small num">{b.falNumber ?? "—"}{b.falExpiry && <div className={`xs ${exp ? "err" : "muted"}`}>{exp ? "منتهية " : "حتى "}{date(b.falExpiry)}</div>}</td>
                    <td><StatusPill map={BROKER_STATUS} value={b.status} /></td>
                    <td className="num">{num(b.user._count.leads)}</td>
                    <td className="num">{num(sale?._count ?? 0)}<div className="xs muted">{sar(sale?._sum.value ?? 0)}</div></td>
                    <td><Pill>{tierFor(sale?._count ?? 0).name}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title="لا نتائج" />}
    </>
  );
}
