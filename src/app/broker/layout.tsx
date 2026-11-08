import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { tierFor } from "@/lib/rules";

export default async function BrokerLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  if (u.role === "ADMIN") redirect("/admin");
  const active = u.broker?.status === "ACTIVE";
  let items;
  if (active) {
    const now = new Date();
    const end = new Date(now.toDateString()); end.setDate(end.getDate() + 1);
    const [due, sold] = await Promise.all([
      db.lead.count({ where: { brokerId: u.id, stage: { notIn: ["SOLD", "LOST"] }, nextFollowUp: { lt: end } } }),
      db.deal.count({ where: { brokerId: u.id, status: "SOLD" } }),
    ]);
    items = [
      { href: "/broker", label: "الرئيسية", icon: "home" },
      { href: "/broker/clients", label: "عملائي", icon: "users", badge: due },
      { href: "/broker/projects", label: "المشاريع", icon: "building" },
      { href: "/broker/earnings", label: "عمولاتي", icon: "wallet" },
      { href: "/broker/account", label: "حسابي", icon: "user" },
    ];
    return <AppShell items={items} role="بوابة الوسطاء" user={{ name: u.name, sub: `وسيط ${tierFor(sold).name}` }}>{children}</AppShell>;
  }
  items = [
    { href: "/broker/onboarding", label: "طلب الانضمام", icon: "inbox" },
    { href: "/broker/account", label: "حسابي", icon: "user" },
  ];
  return <AppShell items={items} role="بوابة الوسطاء" user={{ name: u.name, sub: "طلب انضمام" }}>{children}</AppShell>;
}
