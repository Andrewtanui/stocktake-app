import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

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
          <ChevronLeft size={18} aria-hidden /> {back.label}
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

export type Tone = "ok" | "warn" | "crit" | "info" | "neutral" | "jute";
export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

export function Progress({ value, max, tone = "ok", marker }: { value: number; max: number; tone?: Tone; marker?: number }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill fill-${tone}`} style={{ width: pct + "%" }} />
      {marker !== undefined && max > 0 && (
        <div className="progress-marker" style={{ left: Math.min(100, (marker / max) * 100) + "%" }} />
      )}
    </div>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <span className="code">{children}</span>;
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
  return (
    <div className="tiers" aria-label={`${counted} of ${expected} units counted`}>
      {tiers.map((t, ti) => (
        <div className="tier" key={ti}>
          <span className="tier-no">{ti * 10 + 1}</span>
          {t.map((i) => (
            <span
              key={i}
              className={"bag " + (i < counted ? (i < expected ? "bag-in" : "bag-over") : "bag-out")}
            />
          ))}
        </div>
      ))}
      {total > max && <div className="tiers-more">+{total - max} more</div>}
    </div>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: Tone }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={"stat-value" + (tone ? ` t-${tone}` : "")}>{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}
