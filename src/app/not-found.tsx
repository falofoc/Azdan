import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="nf">
      <div className="stack" style={{ alignItems: "center" }}>
        <Logo height={40} />
        <h1>الصفحة غير موجودة</h1>
        <p className="muted">ربما نُقلت أو لم تعد متاحة.</p>
        <Link className="btn btn-p" href="/">العودة للرئيسية</Link>
      </div>
    </main>
  );
}
