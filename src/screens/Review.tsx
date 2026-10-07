import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Camera, Check, Inbox, Sparkles } from "lucide-react";
import { VARIANCES, site } from "../data/repository";
import type { RootCause, Variance } from "../data/types";
import { Code, PageHead, n } from "../ui/kit";

const CAUSES: RootCause[] = [
  "Duplicate entry",
  "Unposted gate-out",
  "Unposted delivery",
  "Outturn mismatch",
  "Part lot",
  "Cancelled contract",
  "Not yet known",
];

const STATE: Record<Variance["state"], { label: string; className: string }> = {
  open: { label: "Needs a decision", className: "status-needs-decision" },
  recount: { label: "Recount sent", className: "status-recount" },
  ticket: { label: "Ticket raised", className: "status-ticket" },
  accepted: { label: "Count accepted", className: "status-accepted" },
};

type Filter = "open" | "recount" | "ticket" | "all";

export default function Review() {
  const [items, setItems] = useState(VARIANCES);
  const [filter, setFilter] = useState<Filter>("open");
  const [selId, setSelId] = useState(VARIANCES[0].id);
  const [cause, setCause] = useState<Record<string, RootCause>>({});
  const shown = items.filter((v) => filter === "all" || v.state === filter);
  const sel = selId ? items.find((v) => v.id === selId) ?? shown[0] : undefined;

  const act = (state: Variance["state"]) => {
    if (!sel) return;
    setItems((xs) => xs.map((x) => (x.id === sel.id ? { ...x, state } : x)));
  };
  const netUnits = items.reduce((a, v) => a + (v.counted - v.expected), 0);

  const openCount = items.filter((v) => v.state === "open").length;
  const netSign = netUnits > 0 ? "+" : netUnits < 0 ? "−" : "";

  return (
    <div className="page page-wide review-page">
      <PageHead title="Review variances" />

      <div className="review-stats" aria-label="Variance review summary">
        <div className="review-stat">
          <span className="review-stat-label">Waiting for you</span>
          <strong className="review-stat-value">{n(openCount)}</strong>
        </div>
        <div className="review-stat">
          <span className="review-stat-label">Net variance</span>
          <strong className="review-stat-value">{netSign}{n(Math.abs(netUnits))} units</strong>
        </div>
        <div className="review-stat">
          <span className="review-stat-label">Close deadline</span>
          <strong className="review-stat-value">5 working days</strong>
        </div>
      </div>

      <div className="review-tabs" role="group" aria-label="Filter variances">
        {(
          [
            ["open", "Needs a decision"],
            ["recount", "Recount sent"],
            ["ticket", "Ticket raised"],
            ["all", "All"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {label} <span className="review-tab-count">{k === "all" ? items.length : items.filter((v) => v.state === k).length}</span>
          </button>
        ))}
      </div>

      <div className={`review-layout${sel ? " detail-open" : ""}`}>
        <ul className="vlist" id="variance-list" aria-label="Variances">
          {shown.length === 0 && (
            <li className="variance-empty">
              <Inbox size={24} aria-hidden />
              <span>Nothing here. Pick another filter to see other variances.</span>
            </li>
          )}
          {shown.map((v) => {
            const d = v.counted - v.expected;
            const big = Math.abs(d) >= 10;
            const shortage = d < 0;
            const direction = d === 0 ? null : shortage ? "shortage" : "overage";
            const currentCause = cause[v.id] ?? v.cause;
            const status = STATE[v.state];
            return (
              <li key={v.id}>
                <button className={`vrow ${big ? "sev-high" : "sev-med"}`} aria-pressed={sel?.id === v.id} onClick={() => setSelId(v.id)}>
                  <div className="vrow-top">
                    <Code>{v.outturn}</Code>
                    <span className="vrow-diff">
                      {direction === "shortage" ? <ArrowDown className="variance-direction shortage" size={16} aria-label="Shortage" /> : direction === "overage" ? <ArrowUp className="variance-direction overage" size={16} aria-label="Overage" /> : null}
                      {d > 0 ? "+" : d < 0 ? "−" : ""}
                      {Math.abs(d)} units
                    </span>
                  </div>
                  <div className="vrow-where">
                    {v.site === "IBR" ? `Ibero ${v.zone}` : v.zone} · {v.grade}
                  </div>
                  <div className="vrow-foot">
                    <span className={`cause-tag${currentCause === "Not yet known" ? " unresolved" : ""}`}>{currentCause}</span>
                    <span className="vrow-person">{v.counter} · {v.at}</span>
                    <span className={`status-badge ${status.className}`}>{status.label}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {sel && (
          <article className="panel vdetail" aria-labelledby="vd-h">
            <div className="vdetail-head">
              <button className="review-back" onClick={() => setSelId("")}>
                <ArrowLeft size={18} aria-hidden /> Back to list
              </button>
              <div>
                <div className="vdetail-meta">{sel.id} · {site(sel.site).name}</div>
                <h2 id="vd-h" className="vdetail-title">
                  <Code>{sel.outturn}</Code>
                </h2>
                <div className="vdetail-location">{sel.zone} · {sel.grade}</div>
              </div>
              <span className={`status-badge ${STATE[sel.state].className}`}>{STATE[sel.state].label}</span>
            </div>

            <div className="vdetail-body">
              <div className="compare">
                <div className="compare-item">
                  <div className="stat-label">XBS expects</div>
                  <div className="compare-num">{n(sel.expected)}</div>
                </div>
                <div className="compare-item">
                  <div className="stat-label">Counted</div>
                  <div className="compare-num">{n(sel.counted)}</div>
                </div>
                <div className={`compare-item compare-difference ${sel.counted < sel.expected ? "shortage" : "overage"}`}>
                  <div className="stat-label">Difference</div>
                  <div className="compare-num">
                    {sel.counted - sel.expected > 0 ? "+" : sel.counted < sel.expected ? "−" : ""}
                    {n(Math.abs(sel.counted - sel.expected))}
                    {sel.counted < sel.expected ? <ArrowDown size={16} aria-label="Shortage" /> : sel.counted > sel.expected ? <ArrowUp size={16} aria-label="Overage" /> : null}
                  </div>
                </div>
              </div>

              <div className="assist">
                <div className="assist-head">
                  <Sparkles size={18} aria-hidden />
                  <span className="assist-label">Suggestion</span>
                  <strong>{sel.cause}</strong>
                </div>
                <p className="assist-explanation">{sel.why}</p>
                <p className="assist-foot">You decide the cause and the action.</p>
              </div>

              <fieldset className="causes">
                <legend className="field-label">Root cause</legend>
                <div className="cause-chips" role="radiogroup" aria-label="Root cause">
                  {CAUSES.map((c) => {
                    const chosen = (cause[sel.id] ?? sel.cause) === c;
                    const suggested = sel.cause === c;
                    return (
                      <label key={c} className={`cause${suggested ? " cause-suggested" : ""}`}>
                        <input
                          type="radio"
                          name={`cause-${sel.id}`}
                          checked={chosen}
                          onChange={() => setCause((m) => ({ ...m, [sel.id]: c }))}
                        />
                        <span>
                          {suggested && <Sparkles className="cause-sparkle" size={14} aria-label="Suggested" />}
                          {chosen && <Check className="cause-check" size={16} aria-hidden />}
                          {c}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <section className="evidence" aria-labelledby="evidence-h">
                <h3 id="evidence-h" className="field-label">From the count</h3>
                <dl className="evidence-list">
                  <div><dt>Counter</dt><dd>{sel.counter}</dd></div>
                  <div><dt>Counted at</dt><dd>{sel.at}</dd></div>
                  <div><dt>Open for</dt><dd>{n(sel.ageHours, 1)} hours</dd></div>
                </dl>
                <div className="photo-evidence"><Camera size={18} aria-hidden /> <span>1 photo of the bag tag</span></div>
              </section>
            </div>

            <div className="btn-row review-actions">
              <button className="btn btn-primary" onClick={() => act("recount")}>
                Send for recount
              </button>
              <button className="btn btn-accept" onClick={() => act("accepted")}>
                Accept the count
              </button>
              <button className="btn" onClick={() => act("ticket")}>
                Raise a ticket
              </button>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
