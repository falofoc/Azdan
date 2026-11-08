import { ActionForm, Submit } from "@/components/forms";
import { CITIES, PROJECT_STATUS, PROJECT_TYPES } from "@/lib/constants";
import { saveProject } from "../actions";
import type { Project } from "@prisma/client";

export function ProjectForm({ p }: { p?: Project }) {
  return (
    <ActionForm action={saveProject}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="form-2">
        <label className="f">اسم المشروع<input name="name" id="pj-name" defaultValue={p?.name} required /></label>
        <label className="f">الحالة<select name="status" id="pj-status" defaultValue={p?.status ?? "ACTIVE"}>{Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <label className="f">النوع<select name="type" id="pj-type" defaultValue={p?.type ?? "فلل"}>{PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="f">نسبة العمولة %<input name="commissionRate" id="pj-rate" type="number" min={0} max={10} step={0.05} defaultValue={p?.commissionRate ?? 2.5} required /></label>
        <label className="f">المدينة<select name="city" id="pj-city" defaultValue={p?.city ?? "الرياض"}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="f">الحي<input name="district" id="pj-district" defaultValue={p?.district ?? ""} /></label>
        <label className="f">تبدأ الأسعار من (ر.س)<input name="priceFrom" id="pj-price" inputMode="numeric" dir="ltr" defaultValue={p?.priceFrom ?? ""} /></label>
        <label className="f">موعد التسليم<input name="deliveryDate" id="pj-delivery" defaultValue={p?.deliveryDate ?? ""} placeholder="الربع الرابع 2027" /></label>
        <label className="f">رقم ترخيص الإعلان العقاري<input name="adLicense" id="pj-ad" dir="ltr" defaultValue={p?.adLicense ?? ""} /></label>
        <label className="f">ترخيص البيع على الخارطة (وافي) <span className="hint">إن وجد</span><input name="waflLicense" id="pj-wafi" dir="ltr" defaultValue={p?.waflLicense ?? ""} /></label>
        <label className="f">رابط الموقع على الخريطة<input name="locationUrl" id="pj-map" dir="ltr" type="url" defaultValue={p?.locationUrl ?? ""} placeholder="https://maps.google.com/…" /></label>
        <label className="f">رابط الكتيّب التعريفي<input name="brochureUrl" id="pj-brochure" dir="ltr" type="url" defaultValue={p?.brochureUrl ?? ""} placeholder="https://…" /></label>
      </div>
      <label className="f">وصف المشروع<textarea name="description" id="pj-desc" defaultValue={p?.description ?? ""} /></label>
      <label className="f">أبرز المزايا <span className="hint">سطر لكل ميزة؛ تظهر في النص التسويقي للوسطاء</span><textarea name="highlights" id="pj-hl" defaultValue={p?.highlights ?? ""} placeholder={"ضمان هيكلي 10 سنوات\nقريب من طريق الملك سلمان"} /></label>
      <div><Submit>{p ? "حفظ المشروع" : "إنشاء المشروع"}</Submit></div>
    </ActionForm>
  );
}
