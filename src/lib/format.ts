const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
export const num = (n: number | null | undefined) => nf.format(Number(n ?? 0));
// عزل الأرقام اتجاهيًا (LRI…PDI) كي لا تنقلب العلامات في السياق العربي
const iso = (s: string) => `\u2066${s}\u2069`;
export const sar = (n: number | null | undefined) => `${iso(nf.format(Math.round(Number(n ?? 0))))} ر.س`;
export const pct = (n: number) => iso(`${nf.format(n)}%`);
export const plusPct = (n: number) => iso(`+${nf.format(n)}%`);

const df = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", year: "numeric" });
export const date = (d: Date | string | null | undefined) => (d ? df.format(new Date(d)) : "—");

const dtf = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const dateTime = (d: Date | string | null | undefined) => (d ? dtf.format(new Date(d)) : "—");

export function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 864e5);
}

export function relDays(d: Date | null | undefined, now = new Date()) {
  if (!d) return "—";
  const n = daysBetween(new Date(now.toDateString()), new Date(new Date(d).toDateString()));
  if (n === 0) return "اليوم";
  if (n === 1) return "غدًا";
  if (n === -1) return "أمس";
  if (n > 1) return n <= 10 ? `بعد ${n} أيام` : `بعد ${n} يومًا`;
  return -n <= 10 ? `متأخر ${-n} أيام` : `متأخر ${-n} يومًا`;
}

export const toDateInput = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
