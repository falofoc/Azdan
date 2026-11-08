import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, StatusPill } from "@/components/ui";
import { ActionForm, Submit, ConfirmButton } from "@/components/forms";
import { PROJECT_STATUS, UNIT_STATUS, UNIT_TYPES } from "@/lib/constants";
import { num } from "@/lib/format";
import { addUnits, updateUnit, deleteUnit } from "../../actions";
import { ProjectForm } from "../ProjectForm";

export const metadata = { title: "تحرير المشروع" };

export default async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const p = await db.project.findUnique({ where: { id }, include: { units: { orderBy: { code: "asc" }, include: { _count: { select: { deals: true } } } } } });
  if (!p) notFound();
  return (
    <>
      <Link className="link small" href="/admin/projects">→ المشاريع</Link>
      <PageHeader title={p.name} sub={<StatusPill map={PROJECT_STATUS} value={p.status} />} actions={<span className="small muted">{num(p.units.length)} وحدة</span>} />

      <section className="card stack">
        <div className="card-h"><h2>الوحدات</h2><span className="xs muted">عدّل السعر أو الحالة ثم احفظ السطر</span></div>
        {p.units.length ? (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>الوحدة</th><th>المواصفات</th><th>السعر (ر.س)</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {p.units.map((u) => (
                  <tr key={u.id}>
                    <td><b>{u.code}</b><div className="xs muted">{u.type}{u.floor ? ` · الدور ${u.floor}` : ""}</div></td>
                    <td className="small num">{[u.bedrooms ? `${u.bedrooms} غرف` : null, u.builtArea ? `بناء ${num(u.builtArea)} م²` : null, u.landArea ? `أرض ${num(u.landArea)} م²` : null].filter(Boolean).join(" · ") || "—"}</td>
                    <td colSpan={2}>
                      <ActionForm action={updateUnit} className="row unit-edit">
                        <input type="hidden" name="id" value={u.id} />
                        <input className="input" name="price" defaultValue={u.price} inputMode="numeric" dir="ltr" aria-label="السعر" style={{ width: 140 }} />
                        <select className="input" name="status" defaultValue={u.status} aria-label="الحالة" style={{ width: 130 }}>{Object.entries(UNIT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                        <Submit className="btn btn-o btn-sm" pending="…">حفظ</Submit>
                      </ActionForm>
                    </td>
                    <td>{u._count.deals === 0 && <ConfirmButton action={deleteUnit} hidden={{ id: u.id }} label="حذف" className="btn btn-sm btn-danger" confirm={`حذف الوحدة ${u.code} نهائيًا؟`} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="small muted">لا وحدات بعد. أضفها من النموذج أدناه.</p>}
        <details className="disclose" open={!p.units.length}>
          <summary>إضافة وحدات</summary>
          <div className="body">
            <ActionForm action={addUnits} resetOnOk>
              <input type="hidden" name="projectId" value={p.id} />
              <label className="f">سطر لكل وحدة بالترتيب: رقم الوحدة، النوع، السعر، مسطح البناء، مساحة الأرض، الغرف، دورات المياه، الدور
                <span className="hint">الأنواع: {UNIT_TYPES.join("، ")}. يمكن لصق الأعمدة من Excel مباشرة.</span>
                <textarea name="rows" id="units-rows" dir="rtl" rows={6} placeholder={"V-01، فيلا، 1850000، 360، 300، 5، 6\nA-12، شقة، 780000، 145، ، 3، 3، 2"} style={{ fontFamily: "ui-monospace, monospace" }} />
              </label>
              <div><Submit>إضافة الوحدات</Submit></div>
            </ActionForm>
          </div>
        </details>
      </section>

      <section className="card stack">
        <h2>بيانات المشروع</h2>
        <ProjectForm p={p} />
      </section>
    </>
  );
}
