// منطق الأعمال الخالص (قابل للاختبار دون قاعدة بيانات)
import { TIERS, VAT_RATE } from "./constants";

export function tierFor(sold: number) {
  let t: (typeof TIERS)[number] = TIERS[0];
  for (const x of TIERS) if (sold >= x.min) t = x;
  return t;
}

export function nextTier(sold: number) {
  return TIERS.find((x) => x.min > sold) ?? null;
}

/** العمولة = قيمة الصفقة × (نسبة المشروع + مكافأة الفئة) ؛ والضريبة 15% لمن لديه رقم ضريبي */
export function computeCommission(value: number, baseRate: number, bonusRate: number, vatRegistered: boolean) {
  const commission = Math.round((value * (baseRate + bonusRate)) / 100);
  const vat = vatRegistered ? Math.round(commission * VAT_RATE) : 0;
  return { commission, vat, total: commission + vat };
}

/** يحوّل الأرقام العربية-الهندية ويوحّد الجوال السعودي إلى 05xxxxxxxx */
export function normalizePhone(input: string): string {
  let d = String(input ?? "")
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/\D/g, "");
  if (d.startsWith("00966")) d = d.slice(5);
  else if (d.startsWith("966")) d = d.slice(3);
  if (d.length === 9 && d.startsWith("5")) d = "0" + d;
  return d;
}

export const isValidSaudiMobile = (p: string) => /^05\d{8}$/.test(p);

/** رخصة فال: أرقام فقط (عادةً 10 خانات تبدأ بـ 11 أو 12) */
export const isValidFal = (s: string) => /^\d{7,12}$/.test(s);

/** آيبان سعودي: SA + 22 رقمًا مع التحقق بخوارزمية mod-97 */
export function normalizeIban(input: string) {
  return String(input ?? "").replace(/\s+/g, "").toUpperCase();
}
export function isValidSaudiIban(input: string) {
  const iban = normalizeIban(input);
  if (!/^SA\d{22}$/.test(iban)) return false;
  const re = iban.slice(4) + iban.slice(0, 4);
  const digits = re.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}

export const DAY_MS = 864e5;

/** هل الرقم محمي لوسيط آخر؟ */
export function claimBlocks(claim: { brokerId: string; expiresAt: Date } | null, brokerId: string, now = new Date()) {
  return !!claim && claim.brokerId !== brokerId && claim.expiresAt.getTime() > now.getTime();
}

export function maskPhone(p: string) {
  return p.length >= 10 ? `${p.slice(0, 3)}•••${p.slice(-4)}` : p;
}
