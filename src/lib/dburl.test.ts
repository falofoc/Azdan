import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDbUrl } from "./dburl";

const H = "aws-0-eu-central-1.pooler.supabase.com:5432/postgres";
test("cleans common paste mistakes", () => {
  assert.equal(cleanDbUrl(`  "postgresql://postgres.abc:pass123@${H}"\n`).url, `postgresql://postgres.abc:pass123@${H}`);
  assert.equal(cleanDbUrl(`DATABASE_URL=postgresql://postgres.abc:[pass123]@${H}`).url, `postgresql://postgres.abc:pass123@${H}`);
  assert.equal(cleanDbUrl(`postgresql://postgres.abc:p@ss#w/rd?1@${H}`).url, `postgresql://postgres.abc:p%40ss%23w%2Frd%3F1@${H}`);
  assert.equal(cleanDbUrl(`postgresql://postgres.abc:p%40ss@${H}`).url, `postgresql://postgres.abc:p%40ss@${H}`);
  assert.equal(cleanDbUrl(`postgres://postgres.abc:x@${H}`).url, `postgresql://postgres.abc:x@${H}`);
});
test("rejects wrong values without leaking", () => {
  const r = cleanDbUrl("https://hbaxufkdfufcetsyghny.supabase.co");
  assert.equal(r.ok, false);
  assert.equal(cleanDbUrl(`postgresql://postgres.abc:[YOUR-PASSWORD]@${H}`).ok, false);
  assert.ok(!cleanDbUrl(`postgresql://postgres.abc:secret99@${H}`).summary.includes("secret99"));
  assert.equal(cleanDbUrl("").ok, false);
});
