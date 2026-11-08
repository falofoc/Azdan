// القيم المرجعية للمنصة

export const BRAND = "إزدان";

export const STAGES = [
  { key: "NEW", label: "جديد", tone: "info" },
  { key: "CONTACTED", label: "تم التواصل", tone: "info" },
  { key: "QUALIFIED", label: "مؤهل", tone: "ok" },
  { key: "VISIT", label: "معاينة", tone: "ok" },
  { key: "RESERVED", label: "محجوز", tone: "accent" },
  { key: "SOLD", label: "تم البيع", tone: "accent" },
  { key: "LOST", label: "غير مهتم", tone: "muted" },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];
/** المراحل التي يحركها الوسيط بنفسه؛ الحجز والبيع تعتمدهما الإدارة */
export const BROKER_STAGES: StageKey[] = ["NEW", "CONTACTED", "QUALIFIED", "VISIT", "LOST"];
export const OPEN_STAGES: StageKey[] = ["NEW", "CONTACTED", "QUALIFIED", "VISIT", "RESERVED"];
export const stageOf = (k: string) => STAGES.find((s) => s.key === k) ?? STAGES[0];

export const BROKER_STATUS: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "مسودة", tone: "muted" },
  SUBMITTED: { label: "قيد المراجعة", tone: "info" },
  NEEDS_CHANGES: { label: "مطلوب تعديل", tone: "warn" },
  VERIFIED: { label: "بانتظار التوقيع", tone: "info" },
  ACTIVE: { label: "نشط", tone: "ok" },
  SUSPENDED: { label: "موقوف", tone: "bad" },
};

export const DEAL_STATUS: Record<string, { label: string; tone: string }> = {
  REQUESTED: { label: "طلب حجز", tone: "info" },
  RESERVED: { label: "محجوز", tone: "accent" },
  SOLD: { label: "تم البيع", tone: "ok" },
  REJECTED: { label: "مرفوض", tone: "bad" },
  CANCELLED: { label: "ملغى", tone: "muted" },
};

export const COMMISSION_STATUS: Record<string, { label: string; tone: string }> = {
  EXPECTED: { label: "متوقعة", tone: "info" },
  APPROVED: { label: "معتمدة", tone: "accent" },
  PAID: { label: "مصروفة", tone: "ok" },
};

export const PROJECT_STATUS: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "متاح للبيع", tone: "ok" },
  SOON: { label: "قريبًا", tone: "info" },
  SOLD_OUT: { label: "مباع بالكامل", tone: "muted" },
  HIDDEN: { label: "مخفي", tone: "muted" },
};

export const UNIT_STATUS: Record<string, { label: string; tone: string }> = {
  AVAILABLE: { label: "متاحة", tone: "ok" },
  RESERVED: { label: "محجوزة", tone: "accent" },
  SOLD: { label: "مباعة", tone: "muted" },
  UNAVAILABLE: { label: "غير متاحة", tone: "muted" },
};

export const DOC_KINDS = {
  NATIONAL_ID: { label: "الهوية الوطنية / الإقامة", required: true },
  FAL: { label: "رخصة فال", required: true },
  IBAN: { label: "شهادة الآيبان", required: false },
  CR: { label: "السجل التجاري", required: false },
} as const;
export type DocKind = keyof typeof DOC_KINDS;

export const CITIES = ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "الظهران", "القصيم", "أبها", "تبوك", "أخرى"];
export const SOURCES = ["معارف", "سناب شات", "إنستغرام", "تيك توك", "إكس", "واتساب", "زيارة موقع", "إسناد من الشركة", "أخرى"];
export const FINANCING = ["كاش", "تمويل بنكي", "دعم سكني", "لم يحدد"];
export const PROJECT_TYPES = ["فلل", "شقق", "أدوار", "تاون هاوس", "أراضٍ"];
export const UNIT_TYPES = ["فيلا", "شقة", "دور", "تاون هاوس", "أرض"];
export const LOST_REASONS = ["السعر", "الموقع", "التمويل لم يُعتمد", "اشترى من مكان آخر", "لا يرد", "غير جاد", "أخرى"];

export const TIERS = [
  { name: "برونزي", min: 0, bonus: 0 },
  { name: "فضي", min: 3, bonus: 0.25 },
  { name: "ذهبي", min: 10, bonus: 0.5 },
] as const;

export const VAT_RATE = 0.15;
export const CONTRACT_VERSION = "2026.1";

export const STAGE_MAP: Record<string, { label: string; tone: string }> = Object.fromEntries(STAGES.map((s) => [s.key, { label: s.label, tone: s.tone }]));
