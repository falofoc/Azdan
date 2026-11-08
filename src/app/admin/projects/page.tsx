import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Empty, StatusPill } from "@/components/ui";
import { PROJECT_STATUS } from "@/lib/constants";
import { num, pct, sar } from "@/lib/format";

export const metadata = { title: "المشاريع" };

export default async function AdminProjects() {
  await requireAdmin();
  const projects = await db.project.findMany({ orderBy: { createdAt: "desc" }, include: { units: { select: { status: true, price: true } } } });
  return (
    <>
      <PageHeader title="المشاريع" sub="المشاريع ووحداتها كما تظهر للوسطاء." actions={<Link className="btn btn-p" href="/admin/projects/new">مشروع جديد</Link>} />
      {projects.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>المشروع</th><th>الحالة</th><th>العمولة</th><th>متاحة</th><th>محجوزة</th><th>مباعة</th><th>قيمة المباع</th><th>ترخيص الإعلان</th></tr></thead>
            <tbody>
              {projects.map((p) => {
                const c = (k: string) => p.units.filter((u) => u.status === k);
                return (
                  <tr key={p.id}>
                    <td><Link className="link" href={`/admin/projects/${p.id}`}>{p.name}</Link><div className="xs muted">{[p.type, p.district, p.city].filter(Boolean).join(" · ")}</div></td>
                    <td><StatusPill map={PROJECT_STATUS} value={p.status} /></td>
                    <td className="num">{pct(p.commissionRate)}</td>
                    <td className="num">{num(c("AVAILABLE").length)}</td>
                    <td className="num">{num(c("RESERVED").length)}</td>
                    <td className="num">{num(c("SOLD").length)}</td>
                    <td className="num">{sar(c("SOLD").reduce((s, u) => s + u.price, 0))}</td>
                    <td className="small num">{p.adLicense ?? <span className="err">غير مضاف</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title="لا مشاريع بعد" action={<Link className="btn btn-p" href="/admin/projects/new">أضف أول مشروع</Link>} />}
    </>
  );
}
