import { useState } from "react";
import { HelpCircle, Lock, Search } from "lucide-react";
import { useNav } from "../App";
import { allLines, closestOutturn, expectedLots, groupByBatch, linesAt, site } from "../data/repository";
import type { SiteCode } from "../data/types";
import { Code, Notice, PageHead, Pill, Row, Section } from "../ui/kit";

export default function AddLot({ site: code, stack }: { site: SiteCode; stack: string }) {
  const go = useNav();
  const s = site(code);
  const [q, setQ] = useState("");
  const t = q.trim().toUpperCase().replace(/\s+/g, "");
  const here = expectedLots(code, stack);

  // Manual entry off (NKG_config, e.g. third parties): only lots XBS holds at this site can be picked.
  const locked = !s.manualEntry;
  const pool = groupByBatch(locked ? linesAt(code).filter((l) => l.t === "W") : allLines());
  const matches = t.length >= 2 ? pool.filter((l) => l.head.o.includes(t) || (l.head.g ?? "").toUpperCase().includes(t)).slice(0, 8) : [];
  const exact = pool.some((l) => l.head.o === t);
  const suggestion = t.length >= 5 && !exact ? closestOutturn(t, here.map((l) => l.head.o)) : null;
  const open = (batch: string) => go({ tab: "count", view: "lot", site: code, stack, batch });

  return (
    <div className="page">
      <PageHead back={{ label: stack, onClick: () => go({ tab: "count", view: "stack", site: code, stack }) }} title="Add a lot" sub="Type the outturn on the bag tag" />

      <div className="searchbar searchbar-lg">
        <Search size={20} aria-hidden />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 12KN0015" aria-label="Outturn" autoComplete="off" spellCheck={false} />
      </div>

      {locked && (
        <Notice tone="neutral" icon={<Lock size={18} />}>
          Only lots XBS holds at {s.short} can be picked. Missing one? Report it.
        </Notice>
      )}

      {suggestion && (
        <Notice
          tone="warn"
          icon={<HelpCircle size={18} />}
          title={
            <>
              Did you mean <Code>{suggestion}</Code>?
            </>
          }
          action={
            <button className="btn btn-primary btn-sm" onClick={() => open(here.find((l) => l.head.o === suggestion)!.batch)}>
              Use it
            </button>
          }
        >
          It's on this stack and differs by a character or two.
        </Notice>
      )}

      {matches.length > 0 && (
        <Section title="Matches in XBS">
          {matches.map((l) => {
            const isHere = here.some((h) => h.batch === l.batch);
            const where = [...new Set(l.parts.map((p) => site(p.wh).short + (p.wh === "IBR" ? " " + p.z : "")))].join(", ");
            return (
              <Row
                key={l.batch}
                title={<Code>{l.head.o}</Code>}
                sub={`${l.head.i} · ${where}`}
                trail={isHere ? <Pill tone="ok">Here</Pill> : <Pill tone="warn">Elsewhere</Pill>}
                onClick={() => open(l.batch)}
              />
            );
          })}
        </Section>
      )}

      {!locked && t.length >= 5 && !exact && (
        <Section title={`${t} isn't in XBS`}>
          <Row title="Count it as found stock" sub="Your supervisor will look it up" onClick={() => open("FOUND:" + t)} />
        </Section>
      )}

      {t.length < 2 && !s.thirdParty && (
        <Section title="On this stack">
          {here.map((l) => (
            <Row key={l.batch} title={<Code>{l.head.o}</Code>} sub={[l.head.i, l.head.g].filter(Boolean).join(" · ")} onClick={() => open(l.batch)} />
          ))}
        </Section>
      )}
    </div>
  );
}
