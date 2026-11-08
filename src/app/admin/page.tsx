import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Stat, Empty, StatusPill } from "@/components/ui";
import { DEAL_STATUS } from "@/lib/constants";
import { sar, num, dateTime } from "@/lib/format";

export const metadata = { title: "نظرة عامة" };

export default async function AdminHome() {
  await requireAdmin();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [apps, reqs, activeBrokers, soldMonth, toPay, units, recent, topBrokers] = await Promise.all([
    db.brokerProfile.findMany({ where: { status: "SUBMITTED" }, include: { user: { select: { name: true, phone: true } } }, orderBy: { submittedAt: "asc" }, take: 6 }),
    db.deal.findMany({ where: { status: "REQUESTED" }, include: { lead: { select: { name: true } }, broker: { select: { name: true } }, project: { select: { name: true } }, unit: { select: { code: true } } }, orderBy: { requestedAt: "asc" }, take: 6 }),
    db.brokerProfile.count({ where: { status: "ACTIVE" } }),
    db.deal.aggregate({ where: { status: "SOLD", soldAt: { gte: monthStart } }, _sum: { value: true }, _count: true }),
    db.deal.aggregate({ where: { status: "SOLD", commissionStatus: "APPROVED" }, _sum: { commission: true, vat: true }, _count: true }),
    db.unit.groupBy({ by: ["status"], _count: true }),
    db.deal.findMany({ where: { status: { in: ["RESERVED", "SOLD"] } }, include: { lead: { select: { name: true } }, broker: { select: { name: true } }, project: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 6 }),
    db.deal.groupBy({ by: ["brokerId"], where: { status: "SOLD" }, _count: true, _sum: { value: true }, orderBy: { _sum: { value: "desc" } }, take: 5 }),
  ]);
  const uc = (k: string) => units.find((x) => x.status === k)?._count ?? 0;
  const names = Object.fromEntries((await db.user.findMany({ where: { id: { in: topBrokers.map((t) => t.brokerId) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));

  return (
    <>
      <PageHeader title="نظرة عامة" sub="ما يحتاج قرارك اليوم، ثم أداء البرنامج." />
      <div className="stats">
        <Stat hl k="عمولات معتمدة بانتظار الصرف" v={sar((toPay._sum.commission ?? 0) + (toPay._sum.vat ?? 0))} s={`${num(toPay._count)} صفقة`} />
        <Stat k="مبيعات الشهر عبر الوسطاء" v={sar(soldMonth._sum.value)} s={`${num(soldMonth._count)} صفقة`} />
        <Stat k="وسطاء نشطون" v={num(activeBrokers)} />
        <Stat k="الوحدات" v={`${num(uc("AVAILABLE"))} متاحة`} s={`${num(uc("RESERVED"))} محجوزة · ${num(uc("SOLD"))} مباعة`} />
      </div>
      <div className="grid-2">
        <section className="card">
          <div className="card-h"><h2>طلبات حجز بانتظار التأكيد</h2><Link className="link small" href="/admin/deals">كل الحجوزات</Link></div>
          {reqs.length ? <div className="list">{reqs.map((d) => (
            <Link key={d.id} className="li" href="/admin/deals?tab=REQUESTED">
              <span className="grow"><span className="title">{d.lead.name}</span><span className="xs muted">{d.project.name} · وحدة {d.unit?.code} · عبر {d.broker.name}</span></span>
              <span className="xs muted">{dateTime(d.requestedAt)}</span>
            </Link>))}</div> : <Empty title="لا طلبات معلقة" />}
        </section>
        <section className="card">
          <div className="card-h"><h2>طلبات انضمام للمراجعة</h2><Link className="link small" href="/admin/brokers?s=SUBMITTED">الكل</Link></div>
          {apps.length ? <div className="list">{apps.map((b) => (
            <Link key={b.userId} className="li" href={`/admin/brokers/${b.userId}`}>
              <span className="grow"><span className="title">{b.user.name}</span><span className="xs muted">{b.type === "COMPANY" ? b.companyName : "فرد"} · {b.city} · فال {b.falNumber}</span></span>
              <span className="xs muted">{dateTime(b.submittedAt)}</span>
            </Link>))}</div> : <Empty title="لا طلبات جديدة" />}
        </section>
        <section className="card">
          <div className="card-h"><h2>آخر الحجوزات والمبيعات</h2></div>
          {recent.length ? <div className="list">{recent.map((d) => (
            <div key={d.id} className="li">
              <span className="grow"><span className="title">{d.lead.name}</span><span className="xs muted">{d.project.name} · {d.broker.name} · <span className="num">{sar(d.value)}</span></span></span>
              <StatusPill map={DEAL_STATUS} value={d.status} />
            </div>))}</div> : <Empty title="لا صفقات بعد" />}
        </section>
        <section className="card">
          <div className="card-h"><h2>أعلى الوسطاء مبيعًا</h2></div>
          {topBrokers.length ? <div className="list">{topBrokers.map((t, i) => (
            <Link key={t.brokerId} className="li" href={`/admin/brokers/${t.brokerId}`}>
              <span className="av">{i + 1}</span>
              <span className="grow"><span className="title">{names[t.brokerId]}</span><span className="xs muted">{num(t._count)} صفقة</span></span>
              <b className="num small">{sar(t._sum.value)}</b>
            </Link>))}</div> : <Empty title="لا مبيعات بعد" />}
        </section>
      </div>
    </>
  );
}
