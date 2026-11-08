import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBroker } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Pill, StatusPill } from "@/components/ui";
import { CopyButton } from "@/components/forms";
import { PROJECT_STATUS, UNIT_STATUS } from "@/lib/constants";
import { tierFor, computeCommission } from "@/lib/rules";
import { sar, pct, num } from "@/lib/format";

export const metadata = { title: "تفاصيل المشروع" };

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ s?: string }> }) {
  const u = await requireBroker();
  const { slug } = await params;
  const { s = "AVAILABLE" } = await searchParams;
  const p = await db.project.findFirst({ where: { slug: decodeURIComponent(slug), status: { not: "HIDDEN" } }, include: { units: { orderBy: [{ code: "asc" }] } } });
  if (!p) notFound();
  const sold = await db.deal.count({ where: { brokerId: u.id, status: "SOLD" } });
  const tier = tierFor(sold);
  const rate = p.commissionRate + tier.bonus;
  const vatReg = !!u.broker!.vatNumber;
  const units = s === "all" ? p.units : p.units.filter((x) => x.status === s);
  const counts = Object.keys(UNIT_STATUS).map((k) => ({ k, n: p.units.filter((x) => x.status === k).length }));
  const avail = p.units.filter((x) => x.status === "AVAILABLE");
  const minPrice = avail.length ? Math.min(...avail.map((x) => x.price)) : p.priceFrom;

  const ad = [
    `${p.name} من ازدان`,
    [p.type, p.district, p.city].filter(Boolean).join(" – "),
    minPrice ? `الأسعار تبدأ من ${num(minPrice)} ريال` : null,
    p.highlights ? p.highlights.split("\n").filter(Boolean).map((h) => `• ${h.trim()}`).join("\n") : p.description,
    "",
    `للحجز والاستفسار: ${u.name} ${u.phone}`,
    `رخصة فال: ${u.broker!.falNumber ?? "—"}`,
    p.adLicense ? `رقم ترخيص الإعلان: ${p.adLicense}` : null,
  ].filter((x) => x !== null).join("\n");

  return (
    <>
      <Link href="/broker/projects" className="link small">→ المشاريع</Link>
      <PageHeader
        title={p.name}
        sub={[p.type, p.district, p.city].filter(Boolean).join(" · ")}
        actions={<><Pill tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Pill>{p.status === "ACTIVE" && <Link className="btn btn-p" href={`/broker/clients/new?project=${p.id}`}>تسجيل عميل لهذا المشروع</Link>}</>}
      />

      <div className="stats">
        <Stat2 k="عمولتك" v={pct(rate)} s={tier.bonus ? `${pct(p.commissionRate)} + ${pct(tier.bonus)} فئة ${tier.name}` : "نسبة المشروع"} hl />
        <Stat2 k="تبدأ الأسعار من" v={minPrice ? sar(minPrice) : "—"} />
        <Stat2 k="الوحدات المتاحة" v={`${num(avail.length)} من ${num(p.units.length)}`} />
        <Stat2 k="التسليم" v={p.deliveryDate || "—"} />
      </div>

      <div className="detail">
        <section className="stack" style={{ minWidth: 0 }}>
          <div className="chips">
            {counts.filter((c) => c.n).map((c) => (
              <Link key={c.k} className="chip" aria-current={s === c.k ? "true" : undefined} href={`?s=${c.k}`}>{UNIT_STATUS[c.k].label} <span className="c">{num(c.n)}</span></Link>
            ))}
            <Link className="chip" aria-current={s === "all" ? "true" : undefined} href="?s=all">الكل <span className="c">{num(p.units.length)}</span></Link>
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>الوحدة</th><th>النوع</th><th>الغرف</th><th>مسطح البناء</th><th>الأرض</th><th>السعر</th><th>عمولتك</th><th>الحالة</th></tr></thead>
              <tbody>
                {units.map((x) => (
                  <tr key={x.id}>
                    <td><b>{x.code}</b>{x.floor && <span className="xs muted"> · الدور {x.floor}</span>}</td>
                    <td>{x.type}</td>
                    <td className="num">{x.bedrooms ?? "—"}{x.bathrooms ? <span className="xs muted"> / {x.bathrooms} دورات</span> : null}</td>
                    <td className="num">{x.builtArea ? `${num(x.builtArea)} م²` : "—"}</td>
                    <td className="num">{x.landArea ? `${num(x.landArea)} م²` : "—"}</td>
                    <td className="num">{sar(x.price)}</td>
                    <td className="num" style={{ color: "var(--accent)" }}>{sar(computeCommission(x.price, p.commissionRate, tier.bonus, vatReg).total)}</td>
                    <td><StatusPill map={UNIT_STATUS} value={x.status} /></td>
                  </tr>
                ))}
                {!units.length && <tr><td colSpan={8} className="muted small">لا وحدات بهذه الحالة.</td></tr>}
              </tbody>
            </table>
          </div>
          {p.description && <section className="card stack-sm"><h3>عن المشروع</h3><p className="small" style={{ whiteSpace: "pre-line" }}>{p.description}</p></section>}
        </section>

        <aside className="stack" style={{ minWidth: 0 }}>
          <section className="card stack-sm">
            <h3>بيانات نظامية</h3>
            <dl className="kv small">
              <dt>ترخيص الإعلان</dt><dd className="num">{p.adLicense ?? <span className="muted">غير مضاف</span>}</dd>
              {p.waflLicense && <><dt>ترخيص وافي</dt><dd className="num">{p.waflLicense}</dd></>}
              <dt>رخصة فال</dt><dd className="num">{u.broker!.falNumber}</dd>
            </dl>
            {!p.adLicense && <p className="xs err">لا تنشر إعلانًا عن هذا المشروع قبل إضافة رقم ترخيص الإعلان.</p>}
            <div className="row">
              {p.locationUrl && <a className="btn btn-o btn-sm" href={p.locationUrl} target="_blank" rel="noreferrer">الموقع على الخريطة</a>}
              {p.brochureUrl && <a className="btn btn-o btn-sm" href={p.brochureUrl} target="_blank" rel="noreferrer">الكتيّب التعريفي</a>}
            </div>
          </section>
          <section className="card stack-sm">
            <div className="row-between"><h3>نص تسويقي جاهز</h3><CopyButton text={ad} /></div>
            <pre className="adcopy">{ad}</pre>
            <p className="xs muted">يتضمن رقم رخصتك ورقم ترخيص الإعلان كما تتطلب ضوابط الإعلان العقاري.</p>
          </section>
        </aside>
      </div>
    </>
  );
}

function Stat2({ k, v, s, hl }: { k: string; v: string; s?: string; hl?: boolean }) {
  return <div className={`stat${hl ? " hl" : ""}`}><span className="k">{k}</span><span className="v">{v}</span>{s && <span className="s">{s}</span>}</div>;
}
