import { useEffect, type ReactNode } from "react";
import { ChevronLeft, Minus, Plus, X } from "lucide-react";
import type { StackStatus } from "../data/types";

export const n = (x: number, d = 0) =>
  x.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });

export function PageHead({
  title,
  sub,
  back,
  actions,
  code,
}: {
  title: ReactNode;
  sub?: ReactNode;
  back?: { label: string; onClick: () => void };
  actions?: ReactNode;
  code?: boolean;
}) {
  return (
    <header className="page-head">
      {back && (
        <button className="back" onClick={back.onClick}>
          <ChevronLeft size={22} aria-hidden /> {back.label}
        </button>
      )}
      <div className="page-head-row">
        <div className="page-head-text">
          <h1 className={code ? "h1 code-title" : "h1"}>{title}</h1>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </header>
  );
}

export type Tone = "ok" | "warn" | "crit" | "info" | "neutral";
export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

export const STATUS_LABEL: Record<StackStatus, string> = {
  todo: "Not started",
  active: "Being counted",
  done: "Submitted",
  variance: "Has a variance",
};
export const STATUS_TONE: Record<StackStatus, Tone> = { todo: "neutral", active: "info", done: "ok", variance: "crit" };

export function Progress({ value, max, tone = "ok" }: { value: number; max: number; tone?: Tone }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill fill-${tone}`} style={{ width: pct + "%" }} />
    </div>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <span className="code">{children}</span>;
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
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  decimal?: boolean;
  suffix?: string;
}) {
  const parse = (s: string) => Math.max(0, (decimal ? parseFloat(s) : parseInt(s, 10)) || 0);
  return (
    <div className="stepper-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="stepper">
        <button type="button" className="step" aria-label={`${label}: one less`} onClick={() => onChange(Math.max(0, value - step))}>
          <Minus size={26} aria-hidden />
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
          <Plus size={26} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * Bags drawn the way a stack is counted: in tiers of ten. Outlined bags are
 * expected, filled bags are counted, red bags are counted beyond expected.
 */
export function BagTiers({ expected, counted, max = 120 }: { expected: number; counted: number; max?: number }) {
  const total = Math.max(expected, counted);
  const shown = Math.min(total, max);
  const tiers: number[][] = [];
  for (let i = 0; i < shown; i += 10) tiers.push(Array.from({ length: Math.min(10, shown - i) }, (_, k) => i + k));
  if (!tiers.length) return null;
  return (
    <div className="tiers" aria-label={`${counted} of ${expected} units counted`}>
      {tiers.map((t, ti) => (
        <div className="tier" key={ti}>
          <span className="tier-no">{ti * 10 + 1}</span>
          {t.map((i) => (
            <span key={i} className={"bag " + (i < counted ? (i < expected ? "bag-in" : "bag-over") : "bag-out")} />
          ))}
        </div>
      ))}
      {total > max && <div className="tiers-more">+{total - max} more</div>}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={"stat-value" + (tone ? ` t-${tone}` : "")}>{value}</div>
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
        <div className="sheet-head">
          <h2 className="h3">{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={22} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
