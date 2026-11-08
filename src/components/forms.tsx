"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form";

export function Submit({ children, className = "btn btn-p", pending }: { children: ReactNode; className?: string; pending?: string }) {
  const { pending: p } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={p} aria-busy={p}>
      {p ? pending ?? "جارٍ الحفظ…" : children}
    </button>
  );
}

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** نموذج مربوط بـ Server Action يعرض الأخطاء والنجاح في مكانه */
export function ActionForm({ action, children, className = "form", resetOnOk, id }: { action: Action; children: ReactNode; className?: string; resetOnOk?: boolean; id?: string }) {
  const [state, run] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);
  return (
    <form ref={ref} action={run} className={className} id={id} noValidate>
      {children}
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.ok && state.message && <p className="note n-ok" role="status">{state.message}</p>}
    </form>
  );
}

/** زر إجراء مفرد (اعتماد، صرف، …) مع تأكيد داخل الصفحة */
type Field = { name: string; label: string; placeholder?: string; defaultValue?: string; inputMode?: "numeric" | "text"; required?: boolean };

export function ConfirmButton({ action, label, confirm, className = "btn btn-sm", hidden, field }: { action: Action; label: string; confirm?: string; className?: string; hidden?: Record<string, string>; field?: Field }) {
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className="confirm-form">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {confirm ? (
        <details className="confirm">
          <summary className={className}>{label}</summary>
          <div className="confirm-pop">
            <p className="small">{confirm}</p>
            {field && (
              <label className="f">{field.label}
                <input name={field.name} defaultValue={field.defaultValue} placeholder={field.placeholder} inputMode={field.inputMode} dir={field.inputMode === "numeric" ? "ltr" : undefined} required={field.required} />
              </label>
            )}
            <Submit className="btn btn-p btn-sm" pending="…">تأكيد</Submit>
          </div>
        </details>
      ) : (
        <Submit className={className} pending="…">{label}</Submit>
      )}
      {state?.error && <span className="err xs" role="alert">{state.error}</span>}
      {state?.ok && state.message && <span className="xs" role="status" style={{ color: "var(--ok)" }}>{state.message}</span>}
    </form>
  );
}

export function CopyButton({ text, label = "نسخ" }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      className="btn btn-o btn-sm"
      onClick={async (e) => {
        const b = e.currentTarget;
        try {
          await navigator.clipboard.writeText(text);
          b.textContent = "تم النسخ ✓";
        } catch {
          b.textContent = "تعذر النسخ";
        }
        setTimeout(() => (b.textContent = label), 1800);
      }}
    >
      {label}
    </button>
  );
}
