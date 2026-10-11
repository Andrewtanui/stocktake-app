import { useEffect, type ReactNode } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import type { StackStatus } from "../data/types";

export const n = (x: number, d = 0) =>
  x.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });

/* ---------- page structure ---------- */

export function PageHead({
  title,
  sub,
  back,
  code,
  aside,
}: {
  title: ReactNode;
  sub?: ReactNode;
  back?: { label: string; onClick: () => void };
  code?: boolean;
  aside?: ReactNode;
}) {
  return (
    <header className="page-head">
      {back && (
        <button className="back" onClick={back.onClick}>
          <ChevronLeft size={20} aria-hidden /> {back.label}
        </button>
      )}
      <div className="page-head-row">
        <div className="page-head-text">
          <h1 className={code ? "title code" : "title"}>{title}</h1>
          {sub && <p className="subtitle">{sub}</p>}
        </div>
        {aside}
      </div>
    </header>
  );
}

/** A titled group of rows or content: the one container pattern in the app. */
export function Section({ title, action, children, flush }: { title?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="section">
      {(title || action) && (
        <div className="section-head">
          {title && <h2 className="section-title">{title}</h2>}
          {action}
        </div>
      )}
      <div className={flush ? "group group-flush" : "group"}>{children}</div>
    </section>
  );
}

/** One list row. Tappable when onClick is given. */
export function Row({
  lead,
  title,
  sub,
  trail,
  onClick,
  chevron = !!onClick,
}: {
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  trail?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
}) {
  const body = (
    <>
      {lead && <span className="row-lead">{lead}</span>}
      <span className="row-main">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {trail && <span className="row-trail">{trail}</span>}
      {chevron && <ChevronRight size={18} className="row-chev" aria-hidden />}
    </>
  );
  return onClick ? (
    <button className="row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="row">{body}</div>
  );
}

/* ---------- status ---------- */

export type Tone = "ok" | "warn" | "crit" | "info" | "neutral";

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
/** Kept for screens that still label things; same look as Pill. */
export const Chip = Pill;

export const STATUS_LABEL: Record<StackStatus, string> = {
  todo: "Not started",
  active: "In progress",
  done: "Submitted",
  variance: "Sent back",
};
export const STATUS_TONE: Record<StackStatus, Tone> = { todo: "neutral", active: "info", done: "ok", variance: "crit" };

/** Small round status mark used as a row's leading element. */
export function StatusIcon({ s }: { s: StackStatus | "match" }) {
  if (s === "done" || s === "match")
    return (
      <span className="sicon sicon-ok" aria-label="Done">
        <Check size={14} strokeWidth={3} />
      </span>
    );
  if (s === "variance")
    return (
      <span className="sicon sicon-crit" aria-label="Sent back">
        <AlertCircle size={14} strokeWidth={2.6} />
      </span>
    );
  if (s === "active") return <span className="sicon sicon-active" aria-label="In progress" />;
  return <span className="sicon sicon-todo" aria-label="Not started" />;
}

export function Notice({ tone = "info", icon, title, children, action }: { tone?: Tone; icon: ReactNode; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "crit" ? "alert" : undefined}>
      <span className="notice-icon">{icon}</span>
      <div className="notice-body">
        {title && <strong className="notice-title">{title}</strong>}
        {children && <span className="notice-text">{children}</span>}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value, max, tone = "ok" }: { value: number; max: number; tone?: Tone }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill fill-${tone}`} style={{ width: pct + "%" }} />
    </div>
  );
}

/** Progress ring with the fraction in the middle. */
export function Ring({ value, max, size = 76, light }: { value: number; max: number; size?: number; light?: boolean }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = max ? Math.min(1, value / max) : 0;
  return (
    <span className={"ring" + (light ? " ring-light" : "")} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-label">
        <strong>{value}</strong>
        <span>of {max}</span>
      </span>
    </span>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <span className="code">{children}</span>;
}

/* ---------- inputs ---------- */

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, ReactNode][]; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([k, l]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Big minus / number / plus control for counting with gloves on. */
export function Stepper({
  id,
  label,
  value,
  onChange,
  step = 1,
  decimal,
  suffix,
  hint,
  size = "lg",
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  decimal?: boolean;
  suffix?: string;
  hint?: ReactNode;
  size?: "lg" | "md";
}) {
  const parse = (s: string) => Math.max(0, (decimal ? parseFloat(s) : parseInt(s, 10)) || 0);
  return (
    <div className={`stepper stepper-${size}`}>
      <div className="stepper-head">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        {hint && <span className="stepper-hint">{hint}</span>}
      </div>
      <div className="stepper-row">
        <button type="button" className="step" aria-label={`${label}: one less`} onClick={() => onChange(Math.max(0, value - step))}>
          <Minus size={22} aria-hidden />
        </button>
        <div className="step-value">
          <input
            id={id}
            inputMode={decimal ? "decimal" : "numeric"}
            value={value}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onChange(parse(e.target.value))}
          />
          {suffix && <span className="step-suffix">{suffix}</span>}
        </div>
        <button type="button" className="step step-plus" aria-label={`${label}: one more`} onClick={() => onChange(value + step)}>
          <Plus size={22} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Bottom sheet for short confirmations (submit a stack, record a stack). */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={20} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Action bar pinned above the tab bar. */
export function ActionBar({ children, summary }: { children: ReactNode; summary?: ReactNode }) {
  return (
    <div className="actionbar">
      {summary && <div className="actionbar-summary">{summary}</div>}
      <div className="actionbar-buttons">{children}</div>
    </div>
  );
}
