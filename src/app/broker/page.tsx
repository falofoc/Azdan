import Link from "next/link";
import { requireBroker } from "@/lib/session";
import { db, getSettings } from "@/lib/db";
import { PageHeader, Stat, Empty, StatusPill, initials } from "@/components/ui";
import { DEAL_STATUS, OPEN_STAGES, stageOf } from "@/lib/constants";
import { tierFor, nextTier, computeCommission } from "@/lib/rules";
import { sar, num, pct, plusPct, relDays, date } from "@/lib/format";

export const metadata = { title: "الرئيسية" };

export default async function BrokerHome({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const u = await requireBroker();
  const { welcome } = await searchParams;
  const now = new Date();
  const endToday = new Date(now.toDateString()); endToday.setDate(endToday.getDate() + 1);
  const soon = new Date(now.getTime() + 7 * 864e5);
  const vatReg = !!u.broker!.vatNumber;

  const [leads, deals, settings] = await Promise.all([
    db.lead.findMany({ where: { brokerId: u.id }, include: { project: { select: { name: true } } }, orderBy: { updatedAt: "desc" } }),
    db.deal.findMany({ where: { brokerId: u.id }, include: { project: { select: { name: true } }, unit: { select: { code: true } }, lead: { select: { name: true, id: true } } }, orderBy: { updatedAt: "desc" } }),
    getSettings(),
  ]);

  const sold = deals.filter((d) => d.status === "SOLD").length;
  const tier = tierFor(sold);
  const nt = nextTier(sold);
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage as never));
  const due = open.filter((l) => l.nextFollowUp && l.nextFollowUp < endToday).sort((a, b) => +a.nextFollowUp! - +b.nextFollowUp!);
  const expiring = open.filter((l) => l.stage !== "RESERVED" && l.protectedUntil > now && l.protectedUntil < soon);
  const expected = deals.filter((d) => ["REQUESTED", "RESERVED"].includes(d.status)).reduce((s, d) => s + computeCommission(d.value, d.baseRate, tier.bonus, vatReg).commission, 0);
  const approved = deals.filter((d) => d.status === "SOLD" && d.commissionStatus !== "PAID").reduce((s, d) => s + d.commission + d.vat, 0);
  const paid = deals.filter((d) => d.commissionStatus === "PAID").reduce((s, d) => s + d.commission + d.vat, 0);
  const funnel = ["NEW", "CONTACTED", "QUALIFIED", "VISIT", "RESERVED", "SOLD"].map((k) => ({ k, n: leads.filter((l) => l.stage === k).length }));
  const maxF = Math.max(1, ...funnel.map((f) => f.n));
  const falDays = u.broker!.falExpiry ? Math.ceil((+u.broker!.falExpiry - +now) / 864e5) : null;

  return (
    <>
      <PageHeader
        eyebrow={`وسيط ${tier.name}`}
        title={`مرحبًا ${u.name.split(" ")[0]}`}
        sub={due.length ? `لديك ${num(due.length)} ${due.length === 1 ? "متابعة مستحقة" : "متابعات مستحقة"} اليوم.` : "لا متابعات مستحقة اليوم."}
        actions={<Link className="btn btn-p" href="/broker/clients/new">تسجيل عميل</Link>}
      />

      {welcome && <div className="note n-ok"><b>تم تفعيل حسابك.</b> ابدأ بتسجيل أول عميل، وسيُحمى باسمك {settings.protectDays} يومًا.</div>}
      {falDays !== null && falDays <= 30 && (
        <div className={`note ${falDays < 0 ? "n-bad" : "n-warn"}`}>
          <b>{falDays < 0 ? "رخصة فال منتهية." : `رخصة فال تنتهي خلال ${num(falDays)} يومًا.`}</b> جدّدها وحدّث بياناتها من <Link className="link" href="/broker/account">حسابي</Link> {falDays < 0 ? "لتتمكن من تسجيل عملاء جدد." : "لتجنب إيقاف التسجيل."}
        </div>
      )}

      <div className="stats">
        <Stat hl k="عمولات معتمدة بانتظار الصرف" v={sar(approved)} s={`تُصرف خلال ${settings.payoutDays} يومًا من الاعتماد`} />
        <Stat k="عمولات متوقعة" v={sar(expected)} s="من الحجوزات القائمة" />
        <Stat k="عمولات مصروفة" v={sar(paid)} />
        <Stat k="عملاء نشطون" v={num(open.length)} s={`${num(leads.length)} إجمالي العملاء`} />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-h"><h2>متابعات اليوم</h2><Link className="link small" href="/broker/clients?f=due">عرض الكل</Link></div>
          {due.length ? (
            <div className="list">
              {due.slice(0, 6).map((l) => (
                <Link key={l.id} href={`/broker/clients/${l.id}`} className="li">
                  <span className="av">{initials(l.name)}</span>
                  <span className="grow">
                    <span className="title">{l.name}</span>
                    <span className="xs muted">{stageOf(l.stage).label}{l.project ? ` · ${l.project.name}` : ""}</span>
                  </span>
                  <span className={`xs ${l.nextFollowUp! < new Date(now.toDateString()) ? "err" : "muted"}`}>{relDays(l.nextFollowUp)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty title="لا متابعات مستحقة">حدّد «موعد المتابعة القادم» لكل عميل ليظهر هنا في يومه.</Empty>
          )}
        </section>

        <section className="card stack">
          <div className="card-h"><h2>فئتك</h2><span className="xs muted">{num(sold)} صفقة مباعة</span></div>
          <div className="row-between">
            <div className="stack-sm">
              <span style={{ fontFamily: "var(--f-display)", fontSize: "1.5rem" }}>{tier.name}</span>
              <span className="small muted">{tier.bonus ? `${plusPct(tier.bonus)} على نسبة كل مشروع` : "النسبة الأساسية لكل مشروع"}</span>
            </div>
            {nt && <span className="small muted">باقي {num(nt.min - sold)} للفئة {nt.name}</span>}
          </div>
          {nt && <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={nt.min} aria-valuenow={sold}><i style={{ width: `${Math.min(100, (sold / nt.min) * 100)}%` }} /></div>}
          <div className="stack-sm">
            <span className="small" style={{ fontWeight: 600 }}>مسار عملائك</span>
            <div className="funnel">
              {funnel.map((f) => (
                <div key={f.k}>
                  <span className="xs">{stageOf(f.k).label}</span>
                  <span className="fbar"><i style={{ width: `${(f.n / maxF) * 100}%` }} /></span>
                  <b className="xs num">{num(f.n)}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {expiring.length > 0 && (
        <section className="card">
          <div className="card-h"><h2>حماية تنتهي خلال 7 أيام</h2><span className="xs muted">بعد انتهاء الحماية يستطيع وسيط آخر تسجيل العميل</span></div>
          <div className="list">
            {expiring.map((l) => (
              <Link key={l.id} href={`/broker/clients/${l.id}`} className="li">
                <span className="av">{initials(l.name)}</span>
                <span className="grow"><span className="title">{l.name}</span><span className="xs muted">{stageOf(l.stage).label}</span></span>
                <span className="xs err">تنتهي {date(l.protectedUntil)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-h"><h2>آخر الحجوزات والصفقات</h2><Link className="link small" href="/broker/earnings">كشف العمولات</Link></div>
        {deals.length ? (
          <div className="list">
            {deals.slice(0, 5).map((d) => (
              <Link key={d.id} href={`/broker/clients/${d.lead.id}`} className="li">
                <span className="grow">
                  <span className="title">{d.lead.name}</span>
                  <span className="xs muted">{d.project.name}{d.unit ? ` · وحدة ${d.unit.code}` : ""} · <span className="num">{sar(d.value)}</span></span>
                </span>
                <StatusPill map={DEAL_STATUS} value={d.status} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="لا حجوزات بعد">عندما يقرر عميلك، افتح صفحته واطلب حجز الوحدة المتاحة.</Empty>
        )}
      </section>
    </>
  );
}
