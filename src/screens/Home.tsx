import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Info,
  Map,
  RotateCcw,
  ScanLine,
  Warehouse,
} from "lucide-react";
import { useNav } from "../App";
import {
  SITES,
  STOCK_TAKE,
  expectedLots,
  iberoAssignment,
  linesAt,
  myAreaWords,
  mySites,
  myStacks,
  site,
  zoneWords,
} from "../data/repository";
import type { Site } from "../data/types";
import { useStore } from "../data/store";
import { SLOGAN } from "../shared/brand";
import { useWho } from "../PowerProvider";
import { Code, Ring, Row, Section, StatusIcon, n } from "../ui/kit";

const SHOW = 8;

/** By the phone's clock: morning until noon, afternoon until 17:00, then evening. */
const greeting = (h = new Date().getHours()) =>
  h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

export default function Home() {
  const go = useNav();
  const who = useWho();
  const store = useStore();
  const [all, setAll] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const ibero = !!iberoAssignment();
  const tpMine = mySites();

  // Checklist: every stack in my area, with how many of its lots have been counted (never quantities).
  const mine = myStacks().map((z) => {
    const lots = expectedLots("IBR", z);
    const here = store.entriesAt("IBR", z);
    return {
      z,
      s: store.stackStatus("IBR", z),
      lots: lots.length,
      counted: lots.filter((l) => here.some((e) => e.batch === l.batch)).length,
    };
  });
  const order = { variance: 0, active: 1, todo: 2, done: 3 } as const;
  const open = mine
    .filter((x) => x.s !== "done")
    .sort((a, b) => order[a.s] - order[b.s]);
  const done = mine.filter((x) => x.s === "done");
  const recounts = store.recountsOpen();
  const tpOther = SITES.filter((s) => s.thirdParty && !tpMine.includes(s.code));

  const siteRow = (s: Site, sub: string) => (
    <Row
      key={s.code}
      lead={
        <span className="avatar-icon">
          <Warehouse size={18} aria-hidden />
        </span>
      }
      title={s.name}
      sub={sub}
      onClick={() => go({ tab: "count", view: "site", site: s.code })}
    />
  );
  const lotsAt = (s: Site) =>
    `${n(linesAt(s.code).filter((l) => l.t === "W").length)} lots`;

  const stackRow = ({ z, s, lots, counted }: (typeof mine)[number]) => (
    <Row
      key={z}
      lead={<StatusIcon s={s} />}
      title={<Code>{z}</Code>}
      sub={
        s === "variance" ? (
          <span className="t-crit">Sent back — open it to see why</span>
        ) : (
          zoneWords(z)
        )
      }
      trail={
        <span className="muted">
          {s === "done" ? `${lots} lots` : `${counted} of ${lots} lots`}
        </span>
      }
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
        <p className="subtitle">{myAreaWords()}</p>
      </header>

      {store.closedNote() && (
        <div className="notice notice-info">
          <span className="notice-icon">
            <Info size={18} aria-hidden />
          </span>
          <span className="notice-body">
            <strong className="notice-title">Demonstration</strong>
            <span className="notice-text">{store.closedNote()}</span>
          </span>
        </div>
      )}

      {recounts.length > 0 && (
        <button
          className="notice notice-warn notice-btn"
          onClick={() => go({ tab: "recounts" })}
        >
          <span className="notice-icon">
            <RotateCcw size={18} aria-hidden />
          </span>
          <span className="notice-body">
            <strong className="notice-title">
              {recounts.length} recount{recounts.length === 1 ? "" : "s"} from
              your supervisor
            </strong>
            <span className="notice-text">Do these first</span>
          </span>
          <ArrowRight size={18} aria-hidden />
        </button>
      )}

      {ibero && (
        <section className="hero" aria-labelledby="count-h">
          <div className="hero-top">
            <div>
              <h2 id="count-h" className="hero-eyebrow">
                Read the tag
              </h2>
              <div className="hero-title">Count an outturn</div>
              <p className="hero-meta">
                Type the outturn, say where it is, count the bags.
              </p>
            </div>
            <Ring value={done.length} max={mine.length} light />
          </div>
          <p className="hero-facts">
            <span>
              <strong>{done.length}</strong> of {mine.length} stacks submitted
            </span>
          </p>
          <button
            className="btn btn-light btn-lg btn-block"
            onClick={() => go({ tab: "count", view: "find" })}
          >
            <ScanLine size={20} aria-hidden />
            Count an outturn
          </button>
        </section>
      )}

      {!ibero && tpMine.length > 0 && (
        <section className="hero" aria-labelledby="count-h">
          <div className="hero-top">
            <div>
              <h2 id="count-h" className="hero-eyebrow">
                Your site
              </h2>
              <div className="hero-title">Count at {site(tpMine[0]).short}</div>
              <p className="hero-meta">
                Record each stack with a landmark, then count its lots.
              </p>
            </div>
          </div>
          <button
            className="btn btn-light btn-lg btn-block"
            onClick={() => go({ tab: "count", view: "site", site: tpMine[0] })}
          >
            <Warehouse size={20} aria-hidden />
            Open {site(tpMine[0]).short}
          </button>
        </section>
      )}

      {ibero && (
        <Section
          title={`Checklist · ${open.length} stack${open.length === 1 ? "" : "s"} to finish`}
          action={
            <button
              className="text-btn"
              onClick={() => go({ tab: "count", view: "site", site: "IBR" })}
            >
              <Map size={16} aria-hidden /> Floor map
            </button>
          }
        >
          {(all ? open : open.slice(0, SHOW)).map(stackRow)}
          {!open.length && (
            <p className="empty">Every stack in your area is submitted.</p>
          )}
          {open.length > SHOW && (
            <button
              type="button"
              className="text-btn center"
              onClick={() => setAll((v) => !v)}
            >
              {all ? "Show fewer" : `Show all ${open.length}`}
            </button>
          )}
        </Section>
      )}

      {ibero && done.length > 0 && (
        <section className="section">
          <button
            type="button"
            className="disclosure"
            aria-expanded={showDone}
            onClick={() => setShowDone((v) => !v)}
          >
            <span>Submitted · {done.length}</span>
            <ChevronDown size={18} aria-hidden />
          </button>
          {showDone && <div className="group">{done.map(stackRow)}</div>}
        </section>
      )}

      {tpMine.length > 0 && (
        <Section title={ibero ? "Your third-party sites" : "Your sites"}>
          {tpMine.map((c) =>
            siteRow(site(c), `Assigned to you · ${lotsAt(site(c))}`),
          )}
        </Section>
      )}

      {tpOther.length > 0 && (
        <section className="section">
          <button
            type="button"
            className="disclosure"
            aria-expanded={showOther}
            onClick={() => setShowOther((v) => !v)}
          >
            <span>Other sites · {tpOther.length}</span>
            <ChevronDown size={18} aria-hidden />
          </button>
          {showOther && (
            <div className="group">
              {tpOther.map((s) =>
                siteRow(s, `Not assigned to you · ${lotsAt(s)}`),
              )}
            </div>
          )}
        </section>
      )}

      <p className="footnote">
        {store.source === "mock"
          ? `Design preview · expected stock from the ${STOCK_TAKE.snapshot} · counts stay in this tab. Tap “Online” to try offline mode.`
          : `Expected stock from the ${STOCK_TAKE.snapshot} · counts are saved to Dataverse.`}
      </p>
      <p className="slogan">{SLOGAN}</p>
    </div>
  );
}
