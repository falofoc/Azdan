import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await requireAdmin();
  const [apps, reqs] = await Promise.all([
    db.brokerProfile.count({ where: { status: "SUBMITTED" } }),
    db.deal.count({ where: { status: "REQUESTED" } }),
  ]);
  const items = [
    { href: "/admin", label: "نظرة عامة", icon: "home" },
    { href: "/admin/deals", label: "الحجوزات", icon: "deal", badge: reqs },
    { href: "/admin/brokers", label: "الوسطاء", icon: "users", badge: apps },
    { href: "/admin/projects", label: "المشاريع", icon: "building" },
    { href: "/admin/leads", label: "العملاء", icon: "inbox" },
    { href: "/admin/settings", label: "الإعدادات", icon: "gear" },
  ];
  return <AppShell items={items} role="إدارة برنامج الوسطاء" user={{ name: u.name, sub: "مدير", avatar: "م" }}>{children}</AppShell>;
}
