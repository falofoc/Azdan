import Link from "next/link";
import { requireBroker } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Empty, Pill } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { PROJECT_STATUS } from "@/lib/constants";
import { tierFor } from "@/lib/rules";
import { sar, pct, plusPct, num } from "@/lib/format";

export const metadata = { title: "المشاريع" };

export default async function Projects() {
  const u = await requireBroker();
  const [projects, sold] = await Promise.all([
    db.project.findMany({ where: { status: { not: "HIDDEN" } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { units: { select: { status: true, price: true } } } }),
    db.deal.count({ where: { brokerId: u.id, status: "SOLD" } }),
  ]);
  const tier = tierFor(sold);
  return (
    <>
      <PageHeader title="المشاريع" sub={tier.bonus ? `النسب المعروضة تشمل مكافأة فئتك (${tier.name} ${plusPct(tier.bonus)}).` : "نسبة العمولة معلنة لكل مشروع قبل البيع."} />
      {projects.length ? (
        <div className="grid-3">
          {projects.map((p) => {
            const avail = p.units.filter((x) => x.status === "AVAILABLE");
            const minPrice = avail.length ? Math.min(...avail.map((x) => x.price)) : p.priceFrom;
            return (
              <Link key={p.id} href={`/broker/projects/${p.slug}`} className="pcard">
                <div className="pcard-art" aria-hidden="true"><Logo height={22} /></div>
                <div className="stack-sm" style={{ padding: 18 }}>
                  <div className="row-between"><h3>{p.name}</h3><Pill tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Pill></div>
                  <p className="small muted">{[p.type, p.district, p.city].filter(Boolean).join(" · ")}</p>
                  <div className="pmeta">
                    <div><span className="xs muted">عمولتك</span><b className="num">{pct(p.commissionRate + tier.bonus)}</b></div>
                    <div><span className="xs muted">تبدأ من</span><b className="num">{minPrice ? sar(minPrice) : "—"}</b></div>
                    <div><span className="xs muted">متاح</span><b className="num">{num(avail.length)} / {num(p.units.length)}</b></div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty title="لا مشاريع متاحة حاليًا">ستظهر المشاريع هنا فور إضافتها من فريق ازدان.</Empty>
      )}
    </>
  );
}
