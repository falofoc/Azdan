import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ProjectForm } from "../ProjectForm";

export const metadata = { title: "مشروع جديد" };

export default async function NewProject() {
  await requireAdmin();
  return (
    <>
      <Link className="link small" href="/admin/projects">→ المشاريع</Link>
      <PageHeader title="مشروع جديد" sub="بعد الإنشاء أضف الوحدات من صفحة المشروع." />
      <section className="card"><ProjectForm /></section>
    </>
  );
}
