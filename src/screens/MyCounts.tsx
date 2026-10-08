import { ChevronRight, CloudOff } from "lucide-react";
import { useNav } from "../App";
import { compare } from "../data/calc";
import { STOCK_TAKE, expectedLots, site } from "../data/repository";
import { useStore } from "../data/store";
import type { SiteCode } from "../data/types";
import { Chip, Code, PageHead, type Tone } from "../ui/kit";

const STATE: Record<string, { label: string; tone: Tone }> = {
  progress: { label: "In progress", tone: "info" },
  submitted: { label: "Submitted", tone: "neutral" },
  approved: { label: "Approved", tone: "ok" },
  rejected: { label: "Sent back", tone: "crit" },
};

export default function MyCounts() {
  const go = useNav();
  const store = useStore();
  const mine = store.counts.filter((c) => c.by === store.me);
  const stacks = [...new Map(mine.map((c) => [`${c.site}|${c.stack}`, { site: c.site, stack: c.stack }])).values()].reverse();

  return (
    <div className="page">
      <PageHead title="My counts" sub={`${STOCK_TAKE.title} · ${mine.length} lots on ${stacks.length} stacks`} />

      {store.pending > 0 && (
        <div className="callout callout-warn">
          <CloudOff size={22} aria-hidden />
          <div>
            <strong>{store.pending} counts are saved on this phone only.</strong> They'll send by themselves when you're back
            online. Don't log out until then.
          </div>
        </div>
      )}

      <ul className="list">
        {stacks.map(({ site: code, stack }: { site: SiteCode; stack: string }) => {
          const es = mine.filter((c) => c.site === code && c.stack === stack);
          const lots = expectedLots(code, stack);
          const off = es.filter((e) => {
            if (e.other) return false;
            const l = lots.find((x) => x.batch === e.batch);
            return e.found || !l || !compare(e, l).match;
          }).length;
          const st = store.stackState(code, stack);
          const meta = STATE[st?.state ?? "progress"];
          const unsent = es.filter((e) => !e.synced).length;
          return (
            <li key={code + stack}>
              <button className="list-row" onClick={() => go({ tab: "count", view: "stack", site: code, stack })}>
                <span className="list-main">
                  <span>
                    <Code>{stack}</Code> <span className="muted small">{site(code).short}</span>
                  </span>
                  <span className="muted small">
                    {es.length} lot{es.length === 1 ? "" : "s"} ·{off ? `${off} with a difference` : "all match"}
                    {st?.state === "rejected" && st.comment ? ` · “${st.comment}”` : ""}
                  </span>
                </span>
                {unsent > 0 && (
                  <Chip tone="warn">
                    <CloudOff size={14} aria-hidden /> {unsent}
                  </Chip>
                )}
                <Chip tone={meta.tone}>{meta.label}</Chip>
                <ChevronRight size={20} className="chev" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
