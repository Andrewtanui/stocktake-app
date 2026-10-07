import { useState } from "react";
import { Camera, CircleAlert, Minus, Plus, ScanLine, Shuffle, TriangleAlert } from "lucide-react";
import { useNav } from "../App";
import { closestOutturn, demoCount, elsewhere, linesInZone, site } from "../data/repository";
import { BagTiers, Chip, Code, PageHead, n } from "../ui/kit";
import { groupByBatch } from "./ZoneView";

const PACK = 60;

export default function CountLine({ zone, batch, typo }: { zone: string; batch: string; typo?: boolean }) {
  const go = useNav();
  const groups = groupByBatch(linesInZone(zone));
  const g = groups.find((x) => x.batch === batch) ?? groups[0];
  const l = g.head;
  const prior = typo ? null : demoCount(l, zone);
  const pockets0 = g.parts.reduce((a, p) => a + p.pk, 0);

  const [tag, setTag] = useState(typo ? "12KP0015" : l.o);
  const [units, setUnits] = useState(prior?.units ?? (typo ? g.units : Math.max(0, g.units - 4)));
  const [bags, setBags] = useState(prior?.bags ?? (typo ? g.bags : Math.max(0, g.bags - 4)));
  const [pockets, setPockets] = useState(prior?.pockets ?? (typo ? pockets0 : 0));

  const kg = bags * PACK + pockets;
  const diffKg = kg - g.kg;
  const diffUnits = units - g.units;
  const expectedHere = groups.map((x) => x.head.o);
  const tagKnown = expectedHere.includes(tag.trim().toUpperCase());
  const suggestion = !tagKnown && tag.trim() ? closestOutturn(tag.trim().toUpperCase(), expectedHere) : null;
  const others = elsewhere(l).filter((x) => !(x.wh === "IBR" && x.z === zone));
  const summaryTone = Math.abs(diffUnits) <= 2 ? "warn" : "crit";
  const summaryLabel = diffUnits === 0 ? "Exact match" : Math.abs(diffUnits) <= 2 ? "Near match" : "Needs review";

  return (
    <div className="page">
      <PageHead
        back={{ label: `Stack ${zone}`, onClick: () => go({ tab: "count", view: "zone", zone }) }}
        title={l.o}
        code
        sub={[l.i, l.bn, l.g].filter(Boolean).join(" · ")}
        actions={
          <div className="page-actions-inline">
            <Chip tone={tagKnown ? "ok" : "warn"}>{tagKnown ? "Tag expected" : "Tag review"}</Chip>
            <Chip tone={diffUnits === 0 ? "ok" : summaryTone}>{summaryLabel}</Chip>
          </div>
        }
      />

      <section className="panel summary-strip" aria-label="Lot status summary">
        <div className="summary-grid">
          <div className="summary-card">
            <span className="summary-label">Tag</span>
            <div className="summary-value code wrap">{tag.trim().toUpperCase() || "—"}</div>
            <span className={tagKnown ? "summary-meta ok" : "summary-meta warn"}>{tagKnown ? "Expected here" : "Not expected on this stack"}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Units</span>
            <div className="summary-value num">{n(units, 0)}</div>
            <span className={diffUnits === 0 ? "summary-meta ok" : Math.abs(diffUnits) <= 2 ? "summary-meta warn" : "summary-meta crit"}>
              {diffUnits === 0 ? "Matches XBS" : `${diffUnits > 0 ? "+" : "−"}${n(Math.abs(diffUnits), 0)} vs expected`}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Weight</span>
            <div className="summary-value num">{n(kg, 1)} kg</div>
            <span className={Math.abs(diffKg) < 0.05 ? "summary-meta ok" : "summary-meta warn"}>
              {Math.abs(diffKg) < 0.05 ? "Same as XBS" : `${diffKg > 0 ? "+" : "−"}${n(Math.abs(diffKg), 1)} kg`}
            </span>
          </div>
        </div>
      </section>

      <div className="count-layout">
        <div className="count-main">
          <section className="panel">
            <label className="field-label" htmlFor="tag">
              Outturn on the bag tag
            </label>
            <div className="tag-row">
              <input
                id="tag"
                className={"input input-code" + (tagKnown ? "" : " input-bad")}
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn btn-icon-text">
                <ScanLine size={18} aria-hidden /> Scan
              </button>
            </div>
            {suggestion && (
              <div className="mismatch" role="alert">
                <CircleAlert size={20} aria-hidden />
                <div>
                  <p>
                    <strong>
                      <Code>{tag.toUpperCase()}</Code> isn't expected at {zone}
                    </strong>{" "}
                    and XBS doesn't hold it anywhere else. The closest match on this stack is{" "}
                    <Code>{suggestion}</Code> ({groups.find((x) => x.head.o === suggestion)?.head.g}).
                  </p>
                  <div className="btn-row">
                    <button className="btn btn-primary" onClick={() => setTag(suggestion)}>
                      Use {suggestion}
                    </button>
                    <button className="btn">Keep {tag.toUpperCase()} and flag it</button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="panel tally" aria-labelledby="tally-h">
            <div className="tally-head">
              <h2 id="tally-h" className="field-label">
                Units on the stack
              </h2>
              {diffUnits === 0 ? (
                <Chip tone="ok">Matches XBS</Chip>
              ) : (
                <Chip tone={Math.abs(diffUnits) <= 2 ? "warn" : "crit"}>
                  {Math.abs(diffUnits)} {diffUnits < 0 ? "short" : "over"}
                </Chip>
              )}
            </div>
            <div className="stepper">
              <button className="step" aria-label="One less unit" onClick={() => setUnits((u) => Math.max(0, u - 1))}>
                <Minus size={28} aria-hidden />
              </button>
              <div className="tally-num">
                <input
                  id="units"
                  aria-label="Units counted"
                  inputMode="numeric"
                  value={units}
                  onChange={(e) => setUnits(Math.max(0, parseInt(e.target.value || "0", 10) || 0))}
                />
                <span className="tally-of">of {g.units} expected</span>
              </div>
              <button className="step step-plus" aria-label="One more unit" onClick={() => setUnits((u) => u + 1)}>
                <Plus size={28} aria-hidden />
              </button>
            </div>
            <BagTiers expected={g.units} counted={units} />
          </section>

          <section className="panel">
            <h2 className="field-label">Weight</h2>
            <div className="weight-grid">
              <label className="field">
                <span>Full {PACK} kg bags</span>
                <input
                  id="bags"
                  className="input"
                  inputMode="numeric"
                  value={bags}
                  onChange={(e) => setBags(Math.max(0, parseInt(e.target.value || "0", 10) || 0))}
                />
              </label>
              <label className="field">
                <span>Pockets (loose kg)</span>
                <input
                  id="pockets"
                  className="input"
                  inputMode="decimal"
                  value={pockets}
                  onChange={(e) => setPockets(Math.max(0, parseFloat(e.target.value || "0") || 0))}
                />
              </label>
              <div className="field field-calc">
                <span>Total</span>
                <div className="calc">
                  {n(kg, 1)} kg
                  <span className={"calc-diff " + (Math.abs(diffKg) < 0.05 ? "t-ok" : "t-crit")}>
                    {Math.abs(diffKg) < 0.05 ? "same as XBS" : `${diffKg > 0 ? "+" : "−"}${n(Math.abs(diffKg), 1)} kg vs XBS`}
                  </span>
                </div>
              </div>
            </div>
            {pockets >= PACK && (
              <p className="field-error">
                <TriangleAlert size={16} aria-hidden /> Pockets must be under {PACK} kg. Add a full bag instead.
              </p>
            )}
          </section>

          {others.length > 0 && (
            <div className="callout callout-jute">
              <Shuffle size={20} aria-hidden />
              <div>
                <strong>This outturn is split.</strong> XBS also expects{" "}
                {others
                  .map((x) => `${x.bg} bag${x.bg === 1 ? "" : "s"} at ${site(x.wh).short}${x.wh === "IBR" ? " " + x.z : ""}`)
                  .join(" and ")}
                . If those bags are on this stack, count them here and say so in the note.
              </div>
            </div>
          )}

          <section className="panel">
            <label className="field-label" htmlFor="note">
              Note for the supervisor
            </label>
            <textarea id="note" className="input" rows={2} placeholder="Torn bags, re-stacked, tags missing…" />
            <button className="btn btn-quiet">
              <Camera size={18} aria-hidden /> Add a photo of the tag
            </button>
          </section>

          <div className="sticky-actions">
            <button className="btn">Can't find this lot</button>
            <button className="btn btn-primary" onClick={() => go({ tab: "count", view: "zone", zone })}>
              Save count
            </button>
          </div>
        </div>

        <aside className="panel xbs-card" aria-labelledby="xbs-h">
          <h2 id="xbs-h" className="h3">
            What XBS says
          </h2>
          <dl className="kv">
            <dt>Batch</dt>
            <dd className="code wrap">{g.batch}</dd>
            <dt>Warrant</dt>
            <dd className="code">{l.wr ?? "—"}</dd>
            <dt>Basket</dt>
            <dd>{l.bc ? `${l.bc} ${l.bn}` : "—"}</dd>
            <dt>Cup score</dt>
            <dd>{l.cs?.split("--")[0] ?? "—"}</dd>
            <dt>Certification</dt>
            <dd>{l.c ?? "None"}</dd>
            <dt>Crop year</dt>
            <dd>{l.cy}</dd>
            <dt>In stock</dt>
            <dd>{l.d !== undefined ? `${l.d} days` : "—"}</dd>
            {l.so && (
              <>
                <dt>Contract</dt>
                <dd>{l.so}</dd>
              </>
            )}
          </dl>
          <table className="table table-tight">
            <thead>
              <tr>
                <th>Stock type</th>
                <th className="num">Units</th>
                <th className="num">kg</th>
              </tr>
            </thead>
            <tbody>
              {g.parts.map((p, i) => (
                <tr key={i}>
                  <td>{p.t === "W" ? "Warehouse" : `Processing ${p.in}`}</td>
                  <td className="num">{p.u}</td>
                  <td className="num">{n(p.kg, 1)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Expected here</td>
                <td className="num">{g.units}</td>
                <td className="num">{n(g.kg, 1)}</td>
              </tr>
            </tbody>
          </table>
        </aside>
      </div>
    </div>
  );
}
