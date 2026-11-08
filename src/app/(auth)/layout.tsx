import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-art">
        <Link href="/" aria-label="إزدان"><Logo height={46} /></Link>
        <div className="stack-sm">
          <p className="auth-quote">كل عميل تسجّله محمي باسمك،<br />وكل عمولة تعرف حالتها.</p>
          <p className="xs">برنامج الوسطاء المعتمدين لدى إزدان · رخصة فال سارية شرط للانضمام</p>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-box">{children}</div>
      </main>
    </div>
  );
}
