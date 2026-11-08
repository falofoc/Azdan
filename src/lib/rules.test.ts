import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCommission, normalizePhone, isValidSaudiMobile, isValidSaudiIban, tierFor, nextTier, claimBlocks } from "./rules";

test("normalizePhone", () => {
  assert.equal(normalizePhone("+966 55 123 4567"), "0551234567");
  assert.equal(normalizePhone("٠٥٥١٢٣٤٥٦٧"), "0551234567");
  assert.equal(normalizePhone("00966551234567"), "0551234567");
  assert.equal(normalizePhone("551234567"), "0551234567");
  assert.ok(isValidSaudiMobile("0551234567"));
  assert.ok(!isValidSaudiMobile("0451234567"));
});

test("tiers", () => {
  assert.equal(tierFor(0).name, "برونزي");
  assert.equal(tierFor(3).name, "فضي");
  assert.equal(tierFor(12).name, "ذهبي");
  assert.equal(nextTier(4)?.name, "ذهبي");
  assert.equal(nextTier(10), null);
});

test("commission", () => {
  assert.deepEqual(computeCommission(1_000_000, 2.5, 0.25, false), { commission: 27500, vat: 0, total: 27500 });
  assert.deepEqual(computeCommission(1_000_000, 2, 0, true), { commission: 20000, vat: 3000, total: 23000 });
});

test("iban", () => {
  assert.ok(isValidSaudiIban("SA03 8000 0000 6080 1016 7519"));
  assert.ok(!isValidSaudiIban("SA03 8000 0000 6080 1016 7518"));
});

test("claims", () => {
  const now = new Date("2026-01-10");
  assert.ok(claimBlocks({ brokerId: "a", expiresAt: new Date("2026-02-01") }, "b", now));
  assert.ok(!claimBlocks({ brokerId: "a", expiresAt: new Date("2026-02-01") }, "a", now));
  assert.ok(!claimBlocks({ brokerId: "a", expiresAt: new Date("2026-01-01") }, "b", now));
  assert.ok(!claimBlocks(null, "b", now));
});
