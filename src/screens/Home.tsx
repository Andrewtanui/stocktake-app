import { ArrowRight, Map, RotateCcw, Users, Warehouse } from "lucide-react";
import { useNav } from "../App";
import { ASSIGNMENT, SITES, STOCK_TAKE, TEAMMATE, expectedLots, linesAt, zoneWords, zonesInRows } from "../data/repository";
import { useStore } from "../data/store";
import { useWho } from "../PowerProvider";
import { Code, Ring, Row, Section, StatusIcon, n } from "../ui/kit";

export default function Home() {
  const go = useNav();
  const who = useWho();
  const store = useStore();

  const mine = zonesInRows(ASSIGNMENT.rows);
  const status = mine.map((z) => ({ z, s: store.stackStatus("IBR", z) }));
  const submitted = status.filter((x) => x.s === "done" || x.s === "variance").length;
  const next = status.find((x) => x.s === "active" || x.s === "todo")?.z ?? mine[0];
  const nextLots = expectedLots("IBR", next);
  const teammateHere = store.entriesAt("IBR", next).some((e) => e.by !== store.me);
  const upNext = status.filter((x) => (x.s === "active" || x.s === "todo") && x.z !== next).slice(0, 4);
  const recounts = store.recountsOpen();

  return (
    <div className="page">
      <header className="greeting">
        <p className="eyebrow">{STOCK_TAKE.countDate}</p>
        <h1 className="title">Good morning, {who.name.split(" ")[0]}</h1>
        <p className="subtitle">Ibero Export Warehouse · rows D and E</p>
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
            <span className="notice-text">Do these before your next stack</span>
          </span>
          <ArrowRight size={18} aria-hidden />
        </button>
      )}

      <section className="hero" aria-labelledby="next-h">
        <div className="hero-top">
          <div>
            <h2 id="next-h" className="hero-eyebrow">
              Next stack
            </h2>
            <div className="hero-code code">{next}</div>
            <p className="hero-meta">{zoneWords(next)}</p>
          </div>
          <Ring value={submitted} max={mine.length} light />
        </div>
        <p className="hero-facts">
          <span>
            <strong>{nextLots.length}</strong> lots
          </span>
          <span>
            <strong>{n(nextLots.reduce((a, l) => a + l.units, 0))}</strong> units expected
          </span>
        </p>
        {teammateHere && (
          <p className="hero-team">
            <Users size={16} aria-hidden /> {TEAMMATE} started this stack
          </p>
        )}
        <button className="btn btn-light btn-lg btn-block" onClick={() => go({ tab: "count", view: "stack", site: "IBR", stack: next })}>
          Start counting
          <ArrowRight size={20} aria-hidden />
        </button>
      </section>

      <Section
        title="Up next"
        action={
          <button className="text-btn" onClick={() => go({ tab: "count", view: "site", site: "IBR" })}>
            <Map size={16} aria-hidden /> Floor map
          </button>
        }
      >
        {upNext.map(({ z, s }) => (
          <Row
            key={z}
            lead={<StatusIcon s={s} />}
            title={<Code>{z}</Code>}
            sub={zoneWords(z)}
            trail={<span className="muted">{expectedLots("IBR", z).length} lots</span>}
            onClick={() => go({ tab: "count", view: "stack", site: "IBR", stack: z })}
          />
        ))}
      </Section>

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
              sub={`${n(lots.length)} lots · ${n(lots.reduce((a, l) => a + l.bg, 0))} bags`}
              onClick={() => go({ tab: "count", view: "site", site: s.code })}
            />
          );
        })}
      </Section>

      <p className="footnote">
        Design preview · expected stock from the {STOCK_TAKE.snapshot} · counts stay in this tab. Tap “Online” to try offline mode.
      </p>
    </div>
  );
}
