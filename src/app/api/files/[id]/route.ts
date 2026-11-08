import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { readUpload } from "@/lib/uploads";

// تُعرض الوثيقة لصاحبها أو للإدارة فقط
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return new Response("غير مصرح", { status: 401 });
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || (doc.userId !== u.id && u.role !== "ADMIN")) return new Response("غير موجود", { status: 404 });
  try {
    const buf = await readUpload(doc.storageKey);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": doc.mime,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new Response("الملف غير متاح", { status: 404 });
  }
}
