import { CircleCheck, EyeOff } from "lucide-react";
import { useNav } from "../App";
import { unitsOf } from "../data/calc";
import { site, zoneWords } from "../data/repository";
import { useStore } from "../data/store";
import { Code, PageHead, Row, Section, StatusIcon } from "../ui/kit";

export default function Recounts() {
  const go = useNav();
  const store = useStore();
  const open = store.recountsOpen();
  const done = store.recountsDone();

  return (
    <div className="page">
      <PageHead title="Recounts" sub="Counted blind — you won't see the earlier figure." />

      {open.length === 0 ? (
        <div className="empty-state">
          <CircleCheck size={36} aria-hidden />
          <strong>All caught up</strong>
          <span>No recounts waiting.</span>
        </div>
      ) : (
        open.map((r) => (
          <article key={r.id} className="card task">
            <div className="task-head">
              <div>
                <p className="eyebrow">
                  {r.site === "IBR" ? zoneWords(r.stack) : site(r.site).name}
                </p>
                <h2 className="task-title">
                  <Code>{r.outturn}</Code> <span className="muted">at</span> <Code>{r.stack}</Code>
                </h2>
              </div>
            </div>
            <p className="task-why">{r.why}</p>
            <p className="task-meta">
              {r.askedBy.replace(" (Supervisor)", "")} · {r.at}
            </p>
            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={() => go({ tab: "count", view: "lot", site: r.site, stack: r.stack, batch: r.batch, recount: r.id })}
            >
              <EyeOff size={18} aria-hidden /> Start blind recount
            </button>
          </article>
        ))
      )}

      {done.length > 0 && (
        <Section title="Done today">
          {done.map((r) => {
            const e = store.entry(r.site, r.stack, r.batch);
            const counted = e ? unitsOf(e) : 0;
            return (
              <Row
                key={r.id}
                lead={<StatusIcon s="match" />}
                title={
                  <>
                    <Code>{r.outturn}</Code> <span className="row-tag">{r.stack}</span>
                  </>
                }
                sub={`You counted ${counted} units — your supervisor will review it`}
              />
            );
          })}
        </Section>
      )}
    </div>
  );
}
