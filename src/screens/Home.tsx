import { useState } from "react";
import { ArrowRight, ChevronDown, Map, RotateCcw, ScanLine, Warehouse } from "lucide-react";
import { useNav } from "../App";
import { ASSIGNMENT, SITES, STOCK_TAKE, expectedLots, linesAt, zoneWords, zonesInRows } from "../data/repository";
import { useStore } from "../data/store";
import { useWho } from "../PowerProvider";
import { Code, Ring, Row, Section, StatusIcon, n } from "../ui/kit";

const SHOW = 8;

/** By the phone's clock: morning until noon, afternoon until 17:00, then evening. */
const greeting = (h = new Date().getHours()) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

export default function Home() {
  const go = useNav();
  const who = useWho();
  const store = useStore();
  const [all, setAll] = useState(false);
  const [showDone, setShowDone] = useState(false);

  // Checklist: every stack in my rows, with how many of its lots have been counted (never quantities).
  const mine = zonesInRows(ASSIGNMENT.rows).map((z) => {
    const lots = expectedLots("IBR", z);
    const here = store.entriesAt("IBR", z);
    return { z, s: store.stackStatus("IBR", z), lots: lots.length, counted: lots.filter((l) => here.some((e) => e.batch === l.batch)).length };
  });
  const order = { variance: 0, active: 1, todo: 2, done: 3 } as const;
  const open = mine.filter((x) => x.s !== "done").sort((a, b) => order[a.s] - order[b.s]);
  const done = mine.filter((x) => x.s === "done");
  const recounts = store.recountsOpen();
  const rows = ASSIGNMENT.rows.join(" and ");

  const stackRow = ({ z, s, lots, counted }: (typeof mine)[number]) => (
    <Row
      key={z}
      lead={<StatusIcon s={s} />}
      title={<Code>{z}</Code>}
      sub={s === "variance" ? <span className="t-crit">Sent back — open it to see why</span> : zoneWords(z)}
      trail={<span className="muted">{s === "done" ? `${lots} lots` : `${counted} of ${lots} lots`}</span>}
      onClick={() => go({ tab: "count", view: "stack", site: "IBR", stack: z })}
    />
  );

  return (
    <div className="page">
      <header className="greeting">
        <p className="eyebrow">{STOCK_TAKE.countDate}</p>
        <h1 className="title">
          {greeting()}, {who.name.split(" ")[0]}
        </h1>
        <p className="subtitle">Ibero Export Warehouse · rows {rows}</p>
      </header>

      {recounts.length > 0 && (
        <button className="notice notice-warn notice-btn" onClick={() => go({ tab: "recounts" })}>
          <span className="notice-icon">
            <RotateCcw size={18} aria-hidden />
          </span>
          <span className="notice-body">
            <strong className="notice-title">
              {recounts.length} recount{recounts.length === 1 ? "" : "s"} from your supervisor
            </strong>
            <span className="notice-text">Do these first</span>
          </span>
          <ArrowRight size={18} aria-hidden />
        </button>
      )}

      <section className="hero" aria-labelledby="count-h">
        <div className="hero-top">
          <div>
            <h2 id="count-h" className="hero-eyebrow">
              Read the tag
            </h2>
            <div className="hero-title">Count an outturn</div>
            <p className="hero-meta">Type the outturn, say where it is, count the bags.</p>
          </div>
          <Ring value={done.length} max={mine.length} light />
        </div>
        <p className="hero-facts">
          <span>
            <strong>{done.length}</strong> of {mine.length} stacks submitted
          </span>
        </p>
        <button className="btn btn-light btn-lg btn-block" onClick={() => go({ tab: "count", view: "find" })}>
          <ScanLine size={20} aria-hidden />
          Count an outturn
        </button>
      </section>

      <Section
        title={`Checklist · ${open.length} stack${open.length === 1 ? "" : "s"} to finish`}
        action={
          <button className="text-btn" onClick={() => go({ tab: "count", view: "site", site: "IBR" })}>
            <Map size={16} aria-hidden /> Floor map
          </button>
        }
      >
        {(all ? open : open.slice(0, SHOW)).map(stackRow)}
        {!open.length && <p className="empty">Every stack in your rows is submitted.</p>}
        {open.length > SHOW && (
          <button type="button" className="text-btn center" onClick={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `Show all ${open.length}`}
          </button>
        )}
      </Section>

      {done.length > 0 && (
        <section className="section">
          <button type="button" className="disclosure" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            <span>Submitted · {done.length}</span>
            <ChevronDown size={18} aria-hidden />
          </button>
          {showDone && <div className="group">{done.map(stackRow)}</div>}
        </section>
      )}

      <Section title="Third-party sites">
        {SITES.filter((s) => s.thirdParty).map((s) => {
          const lots = linesAt(s.code).filter((l) => l.t === "W");
          return (
            <Row
              key={s.code}
              lead={
                <span className="avatar-icon">
                  <Warehouse size={18} aria-hidden />
                </span>
              }
              title={s.name}
              sub={`${n(lots.length)} lots`}
              onClick={() => go({ tab: "count", view: "site", site: s.code })}
            />
          );
        })}
      </Section>

      <p className="footnote">
        {store.source === "mock"
          ? `Design preview · expected stock from the ${STOCK_TAKE.snapshot} · counts stay in this tab. Tap “Online” to try offline mode.`
          : `Expected stock from the ${STOCK_TAKE.snapshot} · counts are saved to Dataverse.`}
      </p>
    </div>
  );
}
