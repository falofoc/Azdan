import Link from "next/link";
import { requireBroker } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Empty, initials, StatusPill } from "@/components/ui";
import { STAGES, STAGE_MAP } from "@/lib/constants";
import { relDays, date, num } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "عملائي" };

export default async function Clients({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const u = await requireBroker();
  const { f = "open", q = "" } = await searchParams;
  const now = new Date();
  const endToday = new Date(now.toDateString()); endToday.setDate(endToday.getDate() + 1);

  const counts = await db.lead.groupBy({ by: ["stage"], where: { brokerId: u.id }, _count: true });
  const countOf = (k: string) => counts.find((c) => c.stage === k)?._count ?? 0;
  const total = counts.reduce((s, c) => s + c._count, 0);
  const openCount = total - countOf("SOLD") - countOf("LOST");

  const where: Prisma.LeadWhereInput = { brokerId: u.id };
  if (f === "open") where.stage = { notIn: ["SOLD", "LOST"] };
  else if (f === "due") Object.assign(where, { stage: { notIn: ["SOLD", "LOST"] }, nextFollowUp: { lt: endToday } });
  else if (STAGES.some((s) => s.key === f)) where.stage = f;
  const term = q.trim();
  if (term) where.OR = [{ name: { contains: term } }, { phone: { contains: term.replace(/\D/g, "") || term } }];

  const leads = await db.lead.findMany({ where, include: { project: { select: { name: true } }, deal: { select: { status: true } } }, orderBy: f === "due" ? { nextFollowUp: "asc" } : { updatedAt: "desc" }, take: 300 });
  const chip = (key: string, label: string, n: number) => (
    <Link key={key} className="chip" aria-current={f === key ? "true" : undefined} href={`/broker/clients?f=${key}${term ? `&q=${encodeURIComponent(term)}` : ""}`}>
      {label} <span className="c">{num(n)}</span>
    </Link>
  );

  return (
    <>
      <PageHeader title="عملائي" sub={`${num(total)} عميل مسجل باسمك`} actions={<Link className="btn btn-p" href="/broker/clients/new">تسجيل عميل</Link>} />
      <form className="row" role="search" action="/broker/clients">
        <input type="hidden" name="f" value={f} />
        <input className="input" style={{ flex: 1, minWidth: 0 }} name="q" id="q" defaultValue={term} placeholder="ابحث بالاسم أو رقم الجوال" aria-label="بحث" />
        <button className="btn btn-o" type="submit">بحث</button>
      </form>
      <div className="chips">
        {chip("open", "النشطون", openCount)}
        {chip("due", "متابعات مستحقة", await db.lead.count({ where: { brokerId: u.id, stage: { notIn: ["SOLD", "LOST"] }, nextFollowUp: { lt: endToday } } }))}
        {STAGES.map((s) => chip(s.key, s.label, countOf(s.key)))}
        {chip("all", "الكل", total)}
      </div>

      {leads.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>العميل</th><th>المرحلة</th><th>المشروع</th><th>المتابعة القادمة</th><th>الحماية حتى</th></tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/broker/clients/${l.id}`} className="row" style={{ textDecoration: "none", flexWrap: "nowrap" }}>
                      <span className="av">{initials(l.name)}</span>
                      <span className="stack-sm" style={{ gap: 0 }}><b>{l.name}</b><span className="xs muted ltr">{l.phone}</span></span>
                    </Link>
                  </td>
                  <td><StatusPill map={STAGE_MAP} value={l.stage} />{l.deal?.status === "REQUESTED" && <span className="xs muted"> · طلب حجز</span>}</td>
                  <td className="small">{l.project?.name ?? <span className="muted">—</span>}</td>
                  <td className={`small ${l.nextFollowUp && l.nextFollowUp < new Date(now.toDateString()) && !["SOLD", "LOST"].includes(l.stage) ? "err" : ""}`}>{["SOLD", "LOST"].includes(l.stage) ? "—" : relDays(l.nextFollowUp)}</td>
                  <td className="small num">{l.stage === "RESERVED" || l.stage === "SOLD" ? "حتى الإغلاق" : date(l.protectedUntil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : total ? (
        <Empty title="لا نتائج">لا يوجد عملاء بهذا البحث أو التصفية.</Empty>
      ) : (
        <Empty title="لم تسجّل أي عميل بعد" action={<Link className="btn btn-p" href="/broker/clients/new">سجّل عميلك الأول</Link>}>
          سجّل عميلك برقم جواله ليُحمى باسمك، ولا يستطيع وسيط آخر تسجيله.
        </Empty>
      )}
    </>
  );
}
