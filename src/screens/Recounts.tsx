import { CircleCheck, EyeOff, RotateCcw } from "lucide-react";
import { useNav } from "../App";
import { unitsOf } from "../data/calc";
import { expectedLots, site, zoneWords } from "../data/repository";
import { useStore } from "../data/store";
import { Chip, Code, PageHead } from "../ui/kit";

export default function Recounts() {
  const go = useNav();
  const store = useStore();
  const open = store.recountsOpen();
  const done = store.recountsDone();

  return (
    <div className="page">
      <PageHead title="Recounts" sub="Lots your supervisor wants counted again. Recounts are blind: you won't see the earlier figure." />

      {open.length === 0 && (
        <p className="empty">
          <CircleCheck size={22} aria-hidden /> No recounts waiting. Nice work.
        </p>
      )}

      <ul className="cards">
        {open.map((r) => (
          <li key={r.id} className="card">
            <div className="row-between">
              <span>
                <Code>{r.outturn}</Code> <span className="muted">at</span> <Code>{r.stack}</Code>
              </span>
              <Chip tone="warn">To do</Chip>
            </div>
            <p className="muted small">{r.site === "IBR" ? zoneWords(r.stack) : site(r.site).name}</p>
            <p>{r.why}</p>
            <p className="muted small">
              Asked by {r.askedBy} at {r.at}
            </p>
            <button
              className="btn btn-primary btn-xl"
              onClick={() => go({ tab: "count", view: "lot", site: r.site, stack: r.stack, batch: r.batch, recount: r.id })}
            >
              <EyeOff size={20} aria-hidden /> Start blind recount
            </button>
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <section className="block">
          <h2 className="h3">Done today</h2>
          <ul className="cards">
            {done.map((r) => {
              const e = store.entry(r.site, r.stack, r.batch);
              const lot = expectedLots(r.site, r.stack).find((l) => l.batch === r.batch);
              const counted = e ? unitsOf(e) : 0;
              const same = lot && counted === lot.units;
              return (
                <li key={r.id} className="card">
                  <div className="row-between">
                    <span>
                      <Code>{r.outturn}</Code> <span className="muted">at</span> <Code>{r.stack}</Code>
                    </span>
                    <Chip tone="ok">
                      <RotateCcw size={14} aria-hidden /> Sent
                    </Chip>
                  </div>
                  <p>
                    You counted <strong>{counted} units</strong>. XBS expects {lot?.units ?? "—"}.{" "}
                    {same ? "Your recount matches XBS." : "The supervisor will decide what happens next."}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
