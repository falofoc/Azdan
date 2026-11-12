// تنظيف رابط قاعدة البيانات من أخطاء اللصق الشائعة دون كشف كلمة المرور
export type DbUrlReport = { ok: boolean; url: string; notes: string[]; summary: string };

export function cleanDbUrl(raw: string | undefined, name = "DATABASE_URL"): DbUrlReport {
  const notes: string[] = [];
  let s = String(raw ?? "");
  if (!s.trim()) return { ok: false, url: "", notes: [`${name} فارغ أو غير موجود.`], summary: "(فارغ)" };
  const t = s.replace(/[‎‏‪-‮⁦-⁩﻿]/g, "").trim();
  if (t !== s) notes.push("أُزيلت مسافات أو رموز خفية من الطرفين.");
  s = t;
  const pre = s.match(/^(DATABASE_URL|DIRECT_URL)\s*=\s*/i);
  if (pre) { s = s.slice(pre[0].length); notes.push("أُزيل اسم المتغير الملصوق قبل الرابط."); }
  if (/^["'`].*["'`]$/.test(s)) { s = s.slice(1, -1).trim(); notes.push("أُزيلت علامات التنصيص."); }
  const m = s.match(/^([a-z+]+):\/\/(.*)$/i);
  if (!m) {
    const start = s.slice(0, 12).replace(/[^\x20-\x7e]/g, "?");
    return { ok: false, url: s, notes: [...notes, `${name} لا يبدأ بـ mysql:// (يبدأ بـ «${start}…»). مثال: mysql://user:pass@127.0.0.1:3306/azdan_brokers`], summary: start };
  }
  let [, scheme, rest] = m;
  if (/^mysql$/i.test(scheme)) scheme = "mysql";
  else if (/^postgres(ql)?$/i.test(scheme)) scheme = "postgresql";
  else return { ok: false, url: s, notes: [...notes, `${name} نوعه «${scheme}» وليس mysql أو postgresql.`], summary: scheme };
  const at = rest.lastIndexOf("@");
  if (at < 0) return { ok: false, url: s, notes: [...notes, `${name} لا يحتوي اسم مستخدم وكلمة مرور.`], summary: "بلا بيانات دخول" };
  const creds = rest.slice(0, at);
  const host = rest.slice(at + 1);
  const colon = creds.indexOf(":");
  const user = colon < 0 ? creds : creds.slice(0, colon);
  let pass = colon < 0 ? "" : creds.slice(colon + 1);
  if (/YOUR-PASSWORD/i.test(pass)) return { ok: false, url: s, notes: [...notes, `${name} ما زال يحتوي [YOUR-PASSWORD]. ضع كلمة مرور قاعدة البيانات مكانه.`], summary: host };
  if (/^\[.*\]$/.test(pass)) { pass = pass.slice(1, -1); notes.push("أُزيل القوسان [ ] حول كلمة المرور."); }
  let decoded = pass;
  try { decoded = decodeURIComponent(pass); } catch { /* يحتوي % غير مرمّزة */ }
  const encoded = encodeURIComponent(decoded);
  if (encoded !== pass) notes.push("رُمّزت الرموز الخاصة في كلمة المرور.");
  if (!pass) notes.push("تحذير: لا توجد كلمة مرور في الرابط.");
  const url = `${scheme}://${user}:${encoded}@${host}`;
  const hostOnly = host.split(/[/?]/)[0];
  return { ok: true, url, notes, summary: `${scheme}://${user}:•••@${hostOnly}` };
}
