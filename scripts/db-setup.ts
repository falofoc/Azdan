// يُشغَّل أثناء البناء: يتحقق من روابط قاعدة البيانات، ثم ينشئ الجداول ويهيئ البيانات
import { execSync } from "node:child_process";
import { cleanDbUrl } from "../src/lib/dburl";

const db = cleanDbUrl(process.env.DATABASE_URL, "DATABASE_URL");
const direct = cleanDbUrl(process.env.DIRECT_URL || process.env.DATABASE_URL, "DIRECT_URL");
for (const [name, r] of [["DATABASE_URL", db], ["DIRECT_URL", direct]] as const) {
  console.log(`${r.ok ? "✓" : "✗"} ${name}: ${r.summary}`);
  for (const n of r.notes) console.log(`   - ${n}`);
}
if (!db.ok || !direct.ok) {
  console.error("\n✗ أصلح قيم قاعدة البيانات في Render → Environment ثم أعد النشر.");
  process.exit(1);
}
const env = { ...process.env, DATABASE_URL: db.url, DIRECT_URL: direct.url };
execSync("npx prisma db push --skip-generate", { stdio: "inherit", env });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
