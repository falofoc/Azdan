import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Empty, StatusPill } from "@/components/ui";
import { STAGES, STAGE_MAP } from "@/lib/constants";
import { date, num } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "العملاء" };

export default async function AdminLeads({ searchParams }: { searchParams: Promise<{ q?: string; s?: string }> }) {
  await requireAdmin();
  const { q = "", s = "all" } = await searchParams;
  const term = q.trim();
  const where: Prisma.LeadWhereInput = {};
  if (s !== "all") where.stage = s;
  if (term) where.OR = [{ name: { contains: term } }, { phone: { contains: term.replace(/\D/g, "") || term } }];
  const [leads, counts] = await Promise.all([
    db.lead.findMany({ where, include: { broker: { select: { id: true, name: true } }, project: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 300 }),
    db.lead.groupBy({ by: ["stage"], _count: true }),
  ]);
  return (
    <>
      <PageHeader title="العملاء" sub="كل العملاء المسجلين عبر الوسطاء. للبحث عن صاحب حماية رقم معين، ابحث بالجوال. لإسناد عميل جديد افتح ملف الوسيط." />
      <form className="row" role="search">
        <input type="hidden" name="s" value={s} />
        <input className="input" style={{ flex: 1, minWidth: 0 }} name="q" defaultValue={term} placeholder="الاسم أو رقم الجوال" aria-label="بحث" />
        <button className="btn btn-o">بحث</button>
      </form>
      <div className="chips">
        <Link className="chip" href="?s=all" aria-current={s === "all" ? "true" : undefined}>الكل <span className="c">{num(counts.reduce((a, c) => a + c._count, 0))}</span></Link>
        {STAGES.map((st) => <Link key={st.key} className="chip" href={`?s=${st.key}`} aria-current={s === st.key ? "true" : undefined}>{st.label} <span className="c">{num(counts.find((c) => c.stage === st.key)?._count ?? 0)}</span></Link>)}
      </div>
      {leads.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>العميل</th><th>الوسيط</th><th>المرحلة</th><th>المشروع</th><th>المصدر</th><th>سُجّل</th><th>الحماية حتى</th></tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td><b>{l.name}</b><div className="xs muted ltr">{l.phone}</div></td>
                  <td><Link className="link" href={`/admin/brokers/${l.broker.id}`}>{l.broker.name}</Link></td>
                  <td><StatusPill map={STAGE_MAP} value={l.stage} /></td>
                  <td className="small">{l.project?.name ?? "—"}</td>
                  <td className="small">{l.source ?? "—"}</td>
                  <td className="small num">{date(l.createdAt)}</td>
                  <td className="small num">{["RESERVED", "SOLD"].includes(l.stage) ? "حتى الإغلاق" : date(l.protectedUntil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="لا نتائج" />}
    </>
  );
}
