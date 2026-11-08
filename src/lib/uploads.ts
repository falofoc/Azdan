import "server-only";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * تخزين وثائق الوسطاء.
 * - إن وُجد SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY: تُحفظ في حاوية خاصة (غير عامة) في Supabase Storage.
 * - وإلا: تُحفظ على قرص الخادم في UPLOAD_DIR (للتشغيل المحلي أو خادم بقرص دائم).
 * لا يُعرض أي ملف إلا عبر /api/files/[id] بعد التحقق من الصلاحية.
 */

export const MAX_UPLOAD = 5 * 1024 * 1024;
const KEY_RE = /^[a-f0-9]{32}$/;

const SB_URL = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_BUCKET = process.env.SUPABASE_BUCKET || "broker-documents";
const useSupabase = !!(SB_URL && SB_KEY);
const ROOT = path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");

/** يتحقق من نوع الملف من بصمته الفعلية لا من امتداده */
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

/* ───── Supabase Storage (REST) ───── */
const sbHeaders = (extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY!, ...extra });
let bucketReady: Promise<void> | null = null;
function ensureBucket() {
  bucketReady ??= (async () => {
    const r = await fetch(`${SB_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: sbHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: SB_BUCKET, name: SB_BUCKET, public: false, file_size_limit: MAX_UPLOAD }),
    });
    // موجودة مسبقًا = نجاح
    if (!r.ok && r.status !== 409 && !/exist/i.test(await r.text())) throw new Error("تعذر تجهيز مساحة التخزين.");
  })().catch((e) => { bucketReady = null; throw e; });
  return bucketReady;
}
async function sbPut(key: string, buf: Buffer, mime: string) {
  await ensureBucket();
  const r = await fetch(`${SB_URL}/storage/v1/object/${SB_BUCKET}/${key}`, {
    method: "POST",
    headers: sbHeaders({ "Content-Type": mime, "x-upsert": "false" }),
    body: new Uint8Array(buf),
  });
  if (!r.ok) throw new Error("تعذر حفظ الملف، حاول مرة أخرى.");
}
async function sbGet(key: string) {
  const r = await fetch(`${SB_URL}/storage/v1/object/${SB_BUCKET}/${key}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error("not found");
  return Buffer.from(await r.arrayBuffer());
}
async function sbDelete(key: string) {
  await fetch(`${SB_URL}/storage/v1/object/${SB_BUCKET}`, {
    method: "DELETE",
    headers: sbHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [key] }),
  }).catch(() => {});
}

/* ───── الواجهة العامة ───── */
export async function saveUpload(file: File) {
  if (!file || file.size === 0) throw new Error("لم يُختر ملف.");
  if (file.size > MAX_UPLOAD) throw new Error("حجم الملف أكبر من 5 ميجابايت.");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) throw new Error("الصيغ المقبولة: PDF أو JPG أو PNG.");
  const key = crypto.randomBytes(16).toString("hex");
  if (useSupabase) {
    await sbPut(key, buf, mime);
  } else {
    await mkdir(ROOT, { recursive: true });
    await writeFile(path.join(ROOT, key), buf, { mode: 0o600 });
  }
  const name = (file.name || "file").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
  return { storageKey: key, mime, size: buf.length, fileName: name };
}

export async function readUpload(key: string) {
  if (!KEY_RE.test(key)) throw new Error("bad key");
  return useSupabase ? sbGet(key) : readFile(path.join(ROOT, key));
}

export async function removeUpload(key: string) {
  if (!KEY_RE.test(key)) return;
  if (useSupabase) await sbDelete(key);
  else await unlink(path.join(ROOT, key)).catch(() => {});
}
