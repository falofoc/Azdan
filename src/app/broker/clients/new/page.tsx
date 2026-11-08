import Link from "next/link";
import { requireBroker } from "@/lib/session";
import { db, getSettings } from "@/lib/db";
import { ActionForm, Submit } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { createLead } from "../../actions";
import { LeadFields } from "../../LeadFields";

export const metadata = { title: "تسجيل عميل" };

export default async function NewClient({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  await requireBroker();
  const { project } = await searchParams;
  const [projects, s] = await Promise.all([db.project.findMany({ where: { status: { in: ["ACTIVE", "SOON"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }), getSettings()]);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    <>
      <PageHeader title="تسجيل عميل جديد" sub={`يُحمى العميل باسمك ${s.protectDays} يومًا من الآن. التحقق يتم برقم الجوال على مستوى جميع الوسطاء.`} />
      <section className="card" style={{ maxWidth: 780 }}>
        <ActionForm action={createLead}>
          <label className="f">رقم جوال العميل
            <input name="phone" id="lead-phone" inputMode="tel" dir="ltr" placeholder="05xxxxxxxx" required autoFocus />
          </label>
          <LeadFields projects={projects} lead={{ projectId: project, nextFollowUp: tomorrow }} />
          <label className="f">ملاحظة أولى <span className="hint">اختياري</span>
            <textarea name="note" id="lead-note" placeholder="مثال: يبحث عن فيلا 4 غرف شمال الرياض، يفضّل التسليم قبل نهاية العام" />
          </label>
          <label className="check"><input type="checkbox" name="consent" id="consent" /><span>أقر بأن العميل وافق على مشاركة اسمه ورقم جواله مع إزدان لغرض متابعة طلبه.</span></label>
          <div className="row"><Submit pending="جارٍ التحقق والتسجيل…">تسجيل وحماية العميل</Submit><Link className="btn btn-o" href="/broker/clients">إلغاء</Link></div>
        </ActionForm>
      </section>
    </>
  );
}
