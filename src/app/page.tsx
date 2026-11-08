import Link from "next/link";
import { Logo } from "@/components/Logo";
import { db, getSettings } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { TIERS, PROJECT_STATUS } from "@/lib/constants";
import { sar, pct, plusPct, num } from "@/lib/format";
import { computeCommission } from "@/lib/rules";
import { Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const [user, settings, projects] = await Promise.all([
    currentUser(),
    getSettings(),
    db.project.findMany({ where: { status: { in: ["ACTIVE", "SOON"] } }, orderBy: { createdAt: "desc" }, take: 6, include: { _count: { select: { units: { where: { status: "AVAILABLE" } } } } } }),
  ]);
  const home = user ? (user.role === "ADMIN" ? "/admin" : "/broker") : null;
  const sample = computeCommission(1_850_000, 2.5, 0.25, false);

  return (
    <div className="lp">
      <header className="lp-top">
        <div className="lp-in row-between">
          <Link href="/" aria-label="إزدان"><Logo height={34} /></Link>
          <nav className="row">
            {home ? (
              <Link className="btn btn-p btn-sm" href={home}>لوحتي</Link>
            ) : (
              <>
                <Link className="lp-link" href="/login">دخول</Link>
                <Link className="btn btn-p btn-sm" href="/register">انضم كوسيط</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-in lp-hero-grid">
          <div className="stack">
            <span className="eyebrow lp-eyebrow">برنامج وسطاء إزدان</span>
            <h1 className="lp-h1">سوّق مشاريع إزدان<br />بعمولة معلنة وعميل محمي باسمك</h1>
            <p className="lp-lead">منصة واحدة للوسيط المرخّص: مخزون الوحدات المتاحة لحظيًا، حماية العميل {settings.protectDays} يومًا من تسجيله، وكشف عمولة واضح من الحجز حتى الصرف.</p>
            <div className="row">
              <Link className="btn btn-p" href={home ?? "/register"}>{home ? "الدخول إلى لوحتي" : "ابدأ التسجيل"}</Link>
              <a className="btn btn-o lp-btn-o" href="#how">كيف يعمل البرنامج</a>
            </div>
            <p className="xs lp-fine">يشترط رخصة فال سارية من الهيئة العامة للعقار.</p>
          </div>

          <figure className="slip" aria-label="مثال على كشف عمولة">
            <div className="slip-h">
              <span>كشف عمولة · مثال توضيحي</span>
              <Pill tone="ok">معتمدة</Pill>
            </div>
            <dl>
              <div><dt>المشروع</dt><dd>فلل إزدان · حي الملقا</dd></div>
              <div><dt>قيمة الصفقة</dt><dd className="num">{sar(1_850_000)}</dd></div>
              <div><dt>عمولة المشروع</dt><dd className="num">{pct(2.5)}</dd></div>
              <div><dt>مكافأة الفئة (فضي)</dt><dd className="num">{plusPct(0.25)}</dd></div>
            </dl>
            <div className="slip-total">
              <span>صافي العمولة</span>
              <b className="num">{sar(sample.commission)}</b>
            </div>
            <p className="xs">تُصرف خلال {settings.payoutDays} يومًا من اعتمادها على الآيبان المسجل باسمك.</p>
          </figure>
        </div>
      </section>

      <section className="lp-sec" id="how">
        <div className="lp-in stack">
          <div className="stack-sm">
            <span className="eyebrow">من التسجيل إلى الصرف</span>
            <h2 className="lp-h2">أربع خطوات، وكل خطوة لها حالة تراها</h2>
          </div>
          <ol className="steps">
            <li><b>سجّل وارفع وثائقك</b><span>الهوية، رخصة فال، وشهادة الآيبان. نتحقق منها خلال يومي عمل.</span></li>
            <li><b>وقّع اتفاقية الوساطة</b><span>توقيع إلكتروني من داخل المنصة، ويُفعّل حسابك فورًا.</span></li>
            <li><b>سجّل عميلك واحجز وحدته</b><span>يُحمى العميل باسمك {settings.protectDays} يومًا، وتطلب حجز الوحدة المتاحة مباشرة.</span></li>
            <li><b>تابع عمولتك حتى الصرف</b><span>متوقعة عند الحجز، معتمدة بعد البيع، ثم مصروفة مع رقم الحوالة.</span></li>
          </ol>
        </div>
      </section>

      <section className="lp-sec lp-alt">
        <div className="lp-in grid-3">
          <div className="feat">
            <h3>حماية العميل</h3>
            <p>رقم جوال العميل يُقفل باسم أول وسيط يسجله، ولا يستطيع غيره تسجيله طوال مدة الحماية. عند الحجز تمتد الحماية حتى إغلاق الصفقة.</p>
          </div>
          <div className="feat">
            <h3>عمولة معلنة لكل مشروع</h3>
            <p>تعرف النسبة قبل أن تبدأ، وتحسب المنصة عمولتك المتوقعة من سعر الوحدة. الوسيط المسجل ضريبيًا تُضاف له ضريبة القيمة المضافة 15%.</p>
          </div>
          <div className="feat">
            <h3>مخزون محدّث لحظيًا</h3>
            <p>كل وحدة بحالتها: متاحة، محجوزة، مباعة. مع المساحات والأسعار ورقم ترخيص الإعلان لكل مشروع لتسويق نظامي.</p>
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-in stack">
          <div className="stack-sm">
            <span className="eyebrow">فئات الوسطاء</span>
            <h2 className="lp-h2">كلما بعت أكثر، ارتفعت نسبتك</h2>
          </div>
          <div className="tiers">
            {TIERS.map((t) => (
              <div key={t.name} className="tier">
                <span className="tier-n">{t.name}</span>
                <span className="tier-v num">{t.bonus ? plusPct(t.bonus) : "النسبة الأساسية"}</span>
                <span className="xs muted">{t.min === 0 ? "من أول صفقة" : `من ${num(t.min)} صفقات مباعة`}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {projects.length > 0 && (
        <section className="lp-sec lp-alt">
          <div className="lp-in stack">
            <div className="row-between">
              <div className="stack-sm">
                <span className="eyebrow">المشاريع المتاحة للتسويق</span>
                <h2 className="lp-h2">مشاريع إزدان الحالية</h2>
              </div>
            </div>
            <div className="grid-3">
              {projects.map((p) => (
                <article key={p.id} className="pcard">
                  <div className="pcard-art" aria-hidden="true"><Logo height={22} /></div>
                  <div className="stack-sm" style={{ padding: 18 }}>
                    <div className="row-between"><h3>{p.name}</h3><Pill tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Pill></div>
                    <p className="small muted">{[p.type, p.district, p.city].filter(Boolean).join(" · ")}</p>
                    <div className="row-between small">
                      <span>عمولة <b className="num">{pct(p.commissionRate)}</b></span>
                      <span className="muted">{p.priceFrom ? <>تبدأ من <span className="num">{sar(p.priceFrom)}</span></> : "الأسعار قريبًا"}</span>
                    </div>
                    {p.status === "ACTIVE" && <span className="xs muted">{num(p._count.units)} وحدة متاحة</span>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="lp-sec">
        <div className="lp-in grid-2">
          <div className="stack-sm">
            <span className="eyebrow">متطلبات الانضمام</span>
            <h2 className="lp-h2">جهّز هذه الوثائق</h2>
            <p className="muted">التسجيل يستغرق أقل من خمس دقائق إذا كانت الوثائق جاهزة بصيغة PDF أو صورة.</p>
          </div>
          <ul className="reqs">
            <li><b>رخصة فال سارية</b><span>رقم الرخصة وتاريخ انتهائها وصورة منها.</span></li>
            <li><b>الهوية الوطنية أو الإقامة</b><span>صورة واضحة للوجهين.</span></li>
            <li><b>شهادة الآيبان</b><span>باسم الوسيط أو المنشأة. يمكن إرفاقها لاحقًا قبل أول صرف.</span></li>
            <li><b>للمنشآت: السجل التجاري</b><span>والرقم الضريبي إن كانت مسجلة في ضريبة القيمة المضافة.</span></li>
          </ul>
        </div>
      </section>

      <section className="lp-sec lp-alt">
        <div className="lp-in stack" style={{ maxWidth: 820 }}>
          <h2 className="lp-h2">أسئلة متكررة</h2>
          <details className="disclose"><summary>متى أستحق العمولة؟</summary><div className="body muted">بعد توقيع عقد البيع واستلام الدفعة المقررة من العميل، تعتمد الإدارة العمولة ثم تُصرف خلال {settings.payoutDays} يومًا.</div></details>
          <details className="disclose"><summary>ماذا لو سجّل وسيط آخر نفس العميل؟</summary><div className="body muted">لا يمكن ذلك. أول وسيط يسجل رقم جوال العميل يحصل على حمايته {settings.protectDays} يومًا، وتظهر للوسيط الآخر رسالة بأن العميل محمي حتى تاريخ محدد.</div></details>
          <details className="disclose"><summary>هل أستطيع التسويق في وسائل التواصل؟</summary><div className="body muted">نعم، وفق ضوابط الإعلان العقاري. تعرض المنصة رقم ترخيص الإعلان لكل مشروع ونصًا تسويقيًا جاهزًا يتضمن رقم رخصة فال الخاصة بك.</div></details>
          <details className="disclose"><summary>هل يمكن للشركات الانضمام؟</summary><div className="body muted">نعم. اختر «منشأة» عند إكمال البيانات وأرفق السجل التجاري. تُحتسب ضريبة القيمة المضافة على العمولة إن كانت المنشأة مسجلة.</div></details>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-in row-between">
          <Logo height={28} />
          <nav className="row small">
            <Link className="lp-link" href="/terms">شروط البرنامج</Link>
            <Link className="lp-link" href="/privacy">الخصوصية</Link>
            {settings.supportPhone && <span className="ltr">{settings.supportPhone}</span>}
          </nav>
        </div>
      </footer>
    </div>
  );
}
