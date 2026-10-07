import { useState } from "react";
import { Check } from "lucide-react";
import { CYCLE, VARIANCES, reconciliation } from "../data/repository";
import { Chip, PageHead, n } from "../ui/kit";

const TARGET_PCT = 0.1;

export default function SignOff() {
  const rows = reconciliation();
  const xbs = rows.reduce((a, r) => a + r.xbs, 0);
  const phys = rows.reduce((a, r) => a + r.physical, 0);
  const net = ((phys - xbs) / xbs) * 100;
  const resolved = VARIANCES.filter((v) => v.state !== "open").length;
  const [ack, setAck] = useState(false);

  const steps = [
    { who: "Count closed", detail: `${CYCLE.countDate}, 18:10`, state: "done" },
    { who: "Variances resolved", detail: `${resolved} of ${VARIANCES.length} closed`, state: "active" },
    { who: "Stock Control review", detail: "Waiting", state: "todo" },
    { who: "Operations Manager", detail: "Waiting", state: "todo" },
    { who: "Country Finance Manager", detail: "Final sign-off", state: "todo" },
  ];

  return (
    <div className="page page-wide">
      <PageHead
        title="Sign off the count"
        sub={`Shown as Stock Control will see it on Wed 4 Mar, day ${CYCLE.signOffDay} of ${CYCLE.signOffTarget}. The SOP asks for sign-off within ${CYCLE.signOffTarget} working days of the count.`}
      />

      <ol className="steps" aria-label="Sign-off steps">
        {steps.map((s, i) => (
          <li key={s.who} className={`step-item st-${s.state}`}>
            <span className="step-dot" aria-hidden>
              {s.state === "done" ? <Check size={16} /> : i + 1}
            </span>
            <div>
              <div className="step-who">{s.who}</div>
              <div className="muted small">{s.detail}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="board">
        <section className="panel" aria-labelledby="rec-h">
          <div className="block-head">
            <h2 id="rec-h" className="h3">
              Three-way reconciliation, bags
            </h2>
            <Chip tone="neutral">Physical and Comtras are sample figures</Chip>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Primary basket</th>
                  <th className="num">Physical</th>
                  <th className="num">XBS</th>
                  <th className="num">Comtras</th>
                  <th className="num">Physical vs XBS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = r.physical - r.xbs;
                  return (
                    <tr key={r.basket}>
                      <td>{r.basket}</td>
                      <td className="num">{n(r.physical)}</td>
                      <td className="num">{n(r.xbs)}</td>
                      <td className="num">{n(r.comtras)}</td>
                      <td className={"num " + (d === 0 ? "" : d < 0 ? "t-crit" : "t-warn")}>
                        {d > 0 ? "+" : d < 0 ? "−" : ""}
                        {n(Math.abs(d))}
                      </td>
                    </tr>
                  );
                })}
                <tr className="total">
                  <td>Total</td>
                  <td className="num">{n(phys)}</td>
                  <td className="num">{n(xbs)}</td>
                  <td className="num">{n(rows.reduce((a, r) => a + r.comtras, 0))}</td>
                  <td className="num">
                    {phys - xbs > 0 ? "+" : "−"}
                    {n(Math.abs(phys - xbs))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel gauge-panel" aria-labelledby="g-h">
          <h2 id="g-h" className="h3">
            Net variance
          </h2>
          <div className={"gauge-num " + (Math.abs(net) <= TARGET_PCT ? "t-ok" : "t-crit")}>
            {net > 0 ? "+" : "−"}
            {n(Math.abs(net), 2)}%
          </div>
          <div className="gauge-track" aria-hidden>
            <div className="gauge-band" style={{ width: (TARGET_PCT / 0.3) * 100 + "%" }} />
            <div className="gauge-dot" style={{ left: Math.min(100, (Math.abs(net) / 0.3) * 100) + "%" }} />
          </div>
          <p className="muted small">Target is within ±{TARGET_PCT}% of the XBS position.</p>
        </section>
      </div>

      <section className="panel signbox" aria-labelledby="sign-h">
        <h2 id="sign-h" className="h3">
          Your sign-off: Stock Control
        </h2>
        <label className="check-line">
          <input id="ack" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>I've reviewed the reconciliation and every variance has a recorded cause.</span>
        </label>
        <div className="btn-row">
          <button className="btn btn-primary" disabled={!ack || resolved < VARIANCES.length}>
            Sign and send to Operations
          </button>
          <button className="btn">Send back to the count team</button>
        </div>
        {resolved < VARIANCES.length && (
          <p className="small t-warn">
            {VARIANCES.length - resolved} variances are still open. Close them in Review before you sign.
          </p>
        )}
      </section>
    </div>
  );
}
