import { FINANCING, SOURCES } from "@/lib/constants";
import { toDateInput } from "@/lib/format";

type P = { id: string; name: string };
type L = { name?: string; projectId?: string | null; financing?: string | null; source?: string | null; budget?: number | null; nextFollowUp?: Date | null };

export function LeadFields({ projects, lead = {}, lockProject }: { projects: P[]; lead?: L; lockProject?: boolean }) {
  return (
    <div className="form-2">
      <label className="f">اسم العميل
        <input name="name" id="lead-name" defaultValue={lead.name ?? ""} required />
      </label>
      <label className="f">المشروع المهتم به
        <select name="projectId" id="lead-project" defaultValue={lead.projectId ?? ""} disabled={lockProject}>
          <option value="">لم يحدد بعد</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="f">طريقة الشراء
        <select name="financing" id="lead-fin" defaultValue={lead.financing ?? "لم يحدد"}>{FINANCING.map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      <label className="f">الميزانية التقريبية (ر.س)
        <input name="budget" id="lead-budget" inputMode="numeric" dir="ltr" defaultValue={lead.budget ?? ""} placeholder="1,500,000" />
      </label>
      <label className="f">مصدر العميل
        <select name="source" id="lead-source" defaultValue={lead.source ?? "معارف"}>{SOURCES.filter((s) => s !== "إسناد من الشركة" || lead.source === s).map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      <label className="f">موعد المتابعة القادم
        <input name="nextFollowUp" id="lead-follow" type="date" defaultValue={toDateInput(lead.nextFollowUp)} />
      </label>
    </div>
  );
}
