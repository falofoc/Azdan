// ينزّل خطوط هوية إزدان من مجلد الهوية على Google Drive إلى public/fonts.
// الخطوط مرخّصة تجاريًا لإزدان، لذلك لا تُحفظ في المستودع العام.
import { mkdir, writeFile, access } from "node:fs/promises";

const FONTS = {
  "Doran-VF.ttf": "1HtDnm8YuxBxlHFQBNAK4tuoBgL0z9wZJ",
  "HTRakik-Regular.otf": "1OJ3PYJrF1uynbDKLmSkNPEhdI2JMrY_Q",
  "HTRakik-SemiBold.otf": "1syc6N639EFscL9bBqYRGUfJBUDWOb8qu",
  "29LTZaridDisplayVF.ttf": "13zhlvu66nc3afj-zZ-s49X490h5zUmtJ",
};

await mkdir("public/fonts", { recursive: true });
for (const [name, id] of Object.entries(FONTS)) {
  const dest = `public/fonts/${name}`;
  try { await access(dest); console.log("موجود:", name); continue; } catch {}
  try {
    const res = await fetch(`https://drive.google.com/uc?export=download&id=${id}`);
    if (!res.ok) throw new Error(String(res.status));
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    console.log("تم تنزيل:", name);
  } catch (e) {
    console.warn(`تعذر تنزيل ${name} (${e.message}). ستُستخدم الخطوط البديلة.`);
  }
}
