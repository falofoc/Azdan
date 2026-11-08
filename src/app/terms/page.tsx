import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getSettings } from "@/lib/db";
import { contractClauses, contractVersion } from "@/lib/contract";

export const metadata = { title: "شروط برنامج الوسطاء" };
export const dynamic = "force-dynamic";

export default async function Terms() {
  const s = await getSettings();
  return (
    <main className="doc">
      <Link href="/" aria-label="إزدان"><Logo height={34} /></Link>
      <h1>شروط برنامج وسطاء إزدان</h1>
      <p className="muted small">إصدار {contractVersion()}. هذه البنود هي نفسها اتفاقية الوساطة التي يوقعها الوسيط إلكترونيًا عند تفعيل حسابه.</p>
      <ol>{contractClauses(s.protectDays, s.payoutDays).map((c, i) => <li key={i}>{c}</li>)}</ol>
    </main>
  );
}
