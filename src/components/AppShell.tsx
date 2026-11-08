import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { SideNav, TabBar, type NavItem } from "./Nav";
import { logout } from "@/app/(auth)/actions";
import { initials } from "./ui";

export function AppShell({ items, user, role, children }: { items: NavItem[]; user: { name: string; sub?: string; avatar?: string }; role: string; children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="side">
        <Link href="/" className="side-logo" aria-label="إزدان — الرئيسية">
          <Logo height={40} />
          <span>{role}</span>
        </Link>
        <SideNav items={items} />
        <div className="side-user">
          <span className="av">{user.avatar ?? initials(user.name)}</span>
          <div className="grow">
            <div className="title">{user.name}</div>
            {user.sub && <div className="xs">{user.sub}</div>}
          </div>
          <form action={logout}>
            <button className="side-out" type="submit">خروج</button>
          </form>
        </div>
      </aside>
      <header className="topbar">
        <Link href="/" aria-label="إزدان"><Logo height={28} /></Link>
        <span className="xs">{role}</span>
        <form action={logout} style={{ marginInlineStart: "auto" }}>
          <button className="btn btn-o btn-sm" type="submit">خروج</button>
        </form>
      </header>
      <main className="main">{children}</main>
      <TabBar items={items} />
    </div>
  );
}
