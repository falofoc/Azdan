import Link from "next/link";
import { Logo } from "@/components/Logo";
import { db, getSettings } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { pct, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const [user, settings, top] = await Promise.all([
    currentUser(),
    getSettings(),
    db.project.aggregate({ where: { status: "ACTIVE" }, _max: { commissionRate: true } }),
  ]);
  const home = user ? (user.role === "ADMIN" ? "/admin" : "/broker") : null;
  const maxRate = top._max.commissionRate ?? 0;

  return (
    <div className="lp2">
      <header className="lp2-top">
        <div className="lp-in row-between">
          <Link href="/" aria-label="ازدان"><Logo height={30} /></Link>
          <nav className="row">
            {home ? (
              <Link className="btn btn-light btn-sm" href={home}>لوحتي</Link>
            ) : (
              <>
                <Link className="lp2-link" href="/login">دخول</Link>
                <Link className="btn btn-light btn-sm" href="/register">انضم</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="lp2-hero">
        <div className="lp-in lp2-hero-in">
          <p className="lp2-kicker">برنامج وسطاء ازدان</p>
          <h1 className="lp2-h1">سوّق بثقة.<br /><span>عميلك محمي، وعمولتك واضحة.</span></h1>
          <div className="row lp2-cta">
            <Link className="btn btn-p" href={home ?? "/register"}>{home ? "لوحتي" : "انضم كوسيط"}</Link>
            {!home && <Link className="lp2-link" href="/login">لدي حساب</Link>}
          </div>
        </div>
        <div className="lp-in">
          <dl className="lp2-facts">
            <div><dt>حماية العميل</dt><dd><b className="num">{num(settings.protectDays)}</b> يومًا</dd></div>
            <div><dt>عمولة حتى</dt><dd><b>{pct(maxRate || 2.5)}</b></dd></div>
            <div><dt>صرف العمولة</dt><dd>خلال <b className="num">{num(settings.payoutDays)}</b> يومًا</dd></div>
          </dl>
        </div>
      </section>

      <section className="lp2-sec">
        <div className="lp-in">
          <ol className="lp2-steps" aria-label="مراحل الانضمام">
            <li><b>تسجيل</b><span>رخصة فال ووثائقك</span></li>
            <li><b>تحقق</b><span>خلال يومي عمل</span></li>
            <li><b>تفعيل</b><span>توقيع إلكتروني</span></li>
            <li><b>بداية</b><span>سجّل عملاءك</span></li>
          </ol>
        </div>
      </section>

      <section className="lp2-end">
        <div className="lp-in lp2-end-in">
          <h2 className="lp2-h2">ابدأ اليوم.</h2>
          <Link className="btn btn-p" href={home ?? "/register"}>{home ? "لوحتي" : "انضم كوسيط"}</Link>
        </div>
      </section>

      <footer className="lp2-foot">
        <div className="lp-in row-between">
          <Logo height={22} />
          <nav className="row xs">
            <Link href="/terms">الشروط</Link>
            <Link href="/privacy">الخصوصية</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
