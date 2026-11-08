import "server-only";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");
export const MAX_UPLOAD = 5 * 1024 * 1024;

/** يتحقق من نوع الملف من بصمته الفعلية لا من امتداده */
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

export async function saveUpload(file: File) {
  if (!file || file.size === 0) throw new Error("لم يُختر ملف.");
  if (file.size > MAX_UPLOAD) throw new Error("حجم الملف أكبر من 5 ميجابايت.");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) throw new Error("الصيغ المقبولة: PDF أو JPG أو PNG.");
  const key = crypto.randomBytes(16).toString("hex");
  await mkdir(ROOT, { recursive: true });
  await writeFile(path.join(ROOT, key), buf, { mode: 0o600 });
  const name = (file.name || "file").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
  return { storageKey: key, mime, size: buf.length, fileName: name };
}

export async function readUpload(key: string) {
  if (!/^[a-f0-9]{32}$/.test(key)) throw new Error("bad key");
  return readFile(path.join(ROOT, key));
}

export async function removeUpload(key: string) {
  if (!/^[a-f0-9]{32}$/.test(key)) return;
  await unlink(path.join(ROOT, key)).catch(() => {});
}
