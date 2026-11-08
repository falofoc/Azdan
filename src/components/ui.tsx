import type { ReactNode } from "react";

export function Pill({ tone = "muted", children }: { tone?: string; children: ReactNode }) {
  return <span className={`pill t-${tone}`}>{children}</span>;
}

export function StatusPill({ map, value }: { map: Record<string, { label: string; tone: string }>; value: string }) {
  const s = map[value] ?? { label: value, tone: "muted" };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-h">
      <div className="stack-sm" style={{ minWidth: 0 }}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function Stat({ k, v, s, hl }: { k: string; v: ReactNode; s?: ReactNode; hl?: boolean }) {
  return (
    <div className={`stat${hl ? " hl" : ""}`}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      {s && <span className="s">{s}</span>}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="stepper" style={{ ["--n" as string]: steps.length }} aria-label="مراحل الانضمام">
      {steps.map((s, i) => (
        <div key={s} className={i < current ? "done" : i === current ? "cur" : ""} aria-current={i === current ? "step" : undefined}>
          {s}
        </div>
      ))}
    </div>
  );
}

export const initials = (n: string) =>
  (n || "؟").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(" ");
