import { ChevronRight, Map, RotateCcw, ScanLine, Users } from "lucide-react";
import { useNav } from "../App";
import { ASSIGNMENT, SITES, STOCK_TAKE, TEAMMATE, expectedLots, linesAt, zoneWords, zonesInRows } from "../data/repository";
import { useStore } from "../data/store";
import { useWho } from "../PowerProvider";
import { Chip, Code, Progress, STATUS_LABEL, STATUS_TONE, n } from "../ui/kit";

export default function Home() {
  const go = useNav();
  const who = useWho();
  const store = useStore();

  const mine = zonesInRows(ASSIGNMENT.rows);
  const status = mine.map((z) => ({ z, s: store.stackStatus("IBR", z) }));
  const submitted = status.filter((x) => x.s === "done" || x.s === "variance").length;
  const sentBack = mine.filter((z) => store.stackState("IBR", z)?.state === "rejected");
  const next = status.find((x) => x.s === "active" || x.s === "todo")?.z ?? mine[0];
  const nextLots = expectedLots("IBR", next);
  const teammateHere = store.entriesAt("IBR", next).some((e) => e.by !== store.me);
  const upNext = status.filter((x) => x.s === "active" || x.s === "todo").slice(1, 6);
  const recounts = store.recountsOpen();

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="h1">Morning, {who.name.split(" ")[0]}</h1>
        <p className="sub">
          {STOCK_TAKE.type} · you're counting <strong>{ASSIGNMENT.label}</strong>
        </p>
      </header>

      {(recounts.length > 0 || sentBack.length > 0) && (
        <button className="alert-card" onClick={() => go({ tab: "recounts" })}>
          <RotateCcw size={24} aria-hidden />
          <span>
            <strong>
              Your supervisor asked for {recounts.length} recount{recounts.length === 1 ? "" : "s"}
            </strong>
            <span className="alert-sub">Do these before your next stack.</span>
          </span>
          <ChevronRight size={22} aria-hidden />
        </button>
      )}

      <section className="next-card" aria-labelledby="next-h">
        <h2 id="next-h" className="next-label">
          Next stack
        </h2>
        <div className="next-zone code">{next}</div>
        <p className="next-where">{zoneWords(next)}</p>
        <p className="next-meta">
          {nextLots.length} lots · {n(nextLots.reduce((a, l) => a + l.units, 0))} units expected
        </p>
        {teammateHere && (
          <p className="next-team">
            <Users size={18} aria-hidden /> {TEAMMATE} has started this stack. Count the lots they haven't done.
          </p>
        )}
        <button className="btn btn-primary btn-xl" onClick={() => go({ tab: "count", view: "stack", site: "IBR", stack: next })}>
          <ScanLine size={22} aria-hidden /> Count {next}
        </button>
      </section>

      <section className="panel" aria-labelledby="prog-h">
        <div className="row-between">
          <h2 id="prog-h" className="h3">
            Your progress
          </h2>
          <span className="big-num">
            {submitted}
            <span className="muted"> of {mine.length} stacks</span>
          </span>
        </div>
        <Progress value={submitted} max={mine.length} />
        <button className="btn btn-block" onClick={() => go({ tab: "count", view: "site", site: "IBR" })}>
          <Map size={20} aria-hidden /> Open the floor map
        </button>
      </section>

      <section className="block" aria-labelledby="up-h">
        <h2 id="up-h" className="h3">
          After that
        </h2>
        <ul className="list">
          {upNext.map(({ z, s }) => (
            <li key={z}>
              <button className="list-row" onClick={() => go({ tab: "count", view: "stack", site: "IBR", stack: z })}>
                <span className="list-main">
                  <Code>{z}</Code>
                  <span className="muted small">{zoneWords(z)}</span>
                </span>
                <Chip tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Chip>
                <ChevronRight size={20} className="chev" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" aria-labelledby="sites-h">
        <h2 id="sites-h" className="h3">
          Counting somewhere else today?
        </h2>
        <ul className="list">
          {SITES.filter((s) => s.code !== "IBR").map((s) => {
            const lots = linesAt(s.code).filter((l) => l.t === "W");
            return (
              <li key={s.code}>
                <button className="list-row" onClick={() => go({ tab: "count", view: "site", site: s.code })}>
                  <span className="list-main">
                    <strong>{s.name}</strong>
                    <span className="muted small">
                      Third party · {n(lots.length)} lots · {n(lots.reduce((a, l) => a + l.bg, 0))} bags
                    </span>
                  </span>
                  <ChevronRight size={20} className="chev" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
