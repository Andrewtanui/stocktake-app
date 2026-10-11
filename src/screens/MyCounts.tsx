import { CloudOff } from "lucide-react";
import { useNav } from "../App";
import { STOCK_TAKE, site } from "../data/repository";
import { useStore } from "../data/store";
import type { SiteCode, StackStatus } from "../data/types";
import { Code, Notice, PageHead, Pill, Row, Section, StatusIcon } from "../ui/kit";

const STATE: Record<string, { icon: StackStatus }> = {
  progress: { icon: "active" },
  submitted: { icon: "done" },
  approved: { icon: "done" },
  rejected: { icon: "variance" },
};

export default function MyCounts() {
  const go = useNav();
  const store = useStore();
  const mine = store.counts.filter((c) => c.by === store.me);
  const stacks = [...new Map(mine.map((c) => [`${c.site}|${c.stack}`, { site: c.site, stack: c.stack }])).values()].reverse();
  const groups = [
    { title: "Needs you", keys: ["rejected", "progress"] },
    { title: "With the supervisor", keys: ["submitted"] },
    { title: "Approved", keys: ["approved"] },
  ];

  return (
    <div className="page">
      <PageHead title="My counts" sub={`${mine.length} lots on ${stacks.length} stacks · ${STOCK_TAKE.title}`} />

      {store.pending > 0 && (
        <Notice tone="warn" icon={<CloudOff size={18} />} title={`${store.pending} counts saved on this phone`}>
          They send by themselves when you're back online. Don't log out until then.
        </Notice>
      )}

      {groups.map((g) => {
        const rows = stacks.filter((x) => g.keys.includes(store.stackState(x.site, x.stack)?.state ?? "progress"));
        if (!rows.length) return null;
        return (
          <Section key={g.title} title={`${g.title} · ${rows.length}`}>
            {rows.map(({ site: code, stack }: { site: SiteCode; stack: string }) => {
              const es = mine.filter((c) => c.site === code && c.stack === stack);
              const st = store.stackState(code, stack);
              const meta = STATE[st?.state ?? "progress"];
              const unsent = es.filter((e) => !e.synced).length;
              return (
                <Row
                  key={code + stack}
                  lead={<StatusIcon s={meta.icon} />}
                  title={
                    <>
                      <Code>{stack}</Code> <span className="row-tag">{site(code).short}</span>
                    </>
                  }
                  sub={
                    st?.state === "rejected" && st.comment
                      ? st.comment
                      : `${es.length} lot${es.length === 1 ? "" : "s"} counted`
                  }
                  trail={
                    unsent ? (
                      <Pill tone="warn">
                        <CloudOff size={12} aria-hidden /> {unsent}
                      </Pill>
                    ) : undefined
                  }
                  onClick={() => go({ tab: "count", view: "stack", site: code, stack })}
                />
              );
            })}
          </Section>
        );
      })}
    </div>
  );
}
