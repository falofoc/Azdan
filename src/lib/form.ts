// أدوات مشتركة لنماذج Server Actions
export type FormState = { ok?: boolean; error?: string; message?: string; fields?: Record<string, string> } | null;

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export function optInt(fd: FormData, k: string) {
  const v = str(fd, k).replace(/[,\s]/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
export function optFloat(fd: FormData, k: string) {
  const v = str(fd, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
export function optDate(fd: FormData, k: string) {
  const v = str(fd, k);
  if (!v) return null;
  const d = new Date(v + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}
