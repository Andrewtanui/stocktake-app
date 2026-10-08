import { useState } from "react";
import { ChevronRight, CircleAlert, Lock, Search } from "lucide-react";
import { useNav } from "../App";
import { allLines, closestOutturn, expectedLots, groupByBatch, linesAt, site } from "../data/repository";
import type { SiteCode } from "../data/types";
import { Chip, Code, PageHead } from "../ui/kit";

export default function AddLot({ site: code, stack }: { site: SiteCode; stack: string }) {
  const go = useNav();
  const s = site(code);
  const [q, setQ] = useState("");
  const t = q.trim().toUpperCase().replace(/\s+/g, "");
  const here = expectedLots(code, stack);

  // Third parties: only lots XBS holds at this site. Ibero: any lot in XBS.
  const pool = groupByBatch(s.thirdParty ? linesAt(code).filter((l) => l.t === "W") : allLines());
  const matches = t.length >= 2 ? pool.filter((l) => l.head.o.includes(t) || (l.head.g ?? "").toUpperCase().includes(t)).slice(0, 8) : [];
  const exact = pool.some((l) => l.head.o === t);
  const suggestion = t.length >= 5 && !exact ? closestOutturn(t, here.map((l) => l.head.o)) : null;
  const open = (batch: string) => go({ tab: "count", view: "lot", site: code, stack, batch });

  return (
    <div className="page">
      <PageHead
        back={{ label: s.thirdParty ? stack : `Stack ${stack}`, onClick: () => go({ tab: "count", view: "stack", site: code, stack }) }}
        title="Add a lot"
        sub={s.thirdParty ? `Pick from the lots XBS holds at ${s.short}.` : "Find the outturn on the bag tag. Pick it from the list, or type it if it isn't there."}
      />

      {s.thirdParty && (
        <div className="callout callout-info">
          <Lock size={22} aria-hidden />
          <div>Typing outturns is switched off at {s.short}. If the lot isn't on the list, report it as a problem.</div>
        </div>
      )}

      <label className="search search-lg">
        <Search size={22} aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Outturn, e.g. 12KN0015"
          aria-label="Outturn"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      {matches.length > 0 && (
        <ul className="list">
          {matches.map((l) => {
            const isHere = here.some((h) => h.batch === l.batch);
            const where = [...new Set(l.parts.map((p) => site(p.wh).short + (p.wh === "IBR" ? " " + p.z : "")))].join(", ");
            return (
              <li key={l.batch}>
                <button className="list-row" onClick={() => open(l.batch)}>
                  <span className="list-main">
                    <Code>{l.head.o}</Code>
                    <span className="muted small">
                      {l.head.i} · {l.units} units · XBS: {where}
                    </span>
                  </span>
                  {isHere ? <Chip tone="ok">Expected here</Chip> : <Chip tone="warn">Expected elsewhere</Chip>}
                  <ChevronRight size={20} className="chev" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!s.thirdParty && t.length >= 5 && !exact && (
        <section className="panel">
          <div className="result-head">
            <CircleAlert size={22} aria-hidden />
            <strong>
              <Code>{t}</Code> isn't in XBS
            </strong>
          </div>
          {suggestion ? (
            <>
              <p>
                Did you mean <Code>{suggestion}</Code>? It's on this stack and differs by a character or two. Tags are easy to misread.
              </p>
              <button className="btn btn-primary btn-xl" onClick={() => open(here.find((l) => l.head.o === suggestion)!.batch)}>
                Count {suggestion}
              </button>
            </>
          ) : (
            <p>Check the tag again. If it's right, count it as found stock and the supervisor will look it up.</p>
          )}
          <button className="btn btn-xl" onClick={() => open("FOUND:" + t)}>
            Keep {t} and count it as found stock
          </button>
        </section>
      )}

      {t.length < 2 && !s.thirdParty && (
        <section className="block">
          <h2 className="h3">On this stack</h2>
          <ul className="list">
            {here.map((l) => (
              <li key={l.batch}>
                <button className="list-row" onClick={() => open(l.batch)}>
                  <span className="list-main">
                    <Code>{l.head.o}</Code>
                    <span className="muted small">
                      {l.head.i} · {l.units} units
                    </span>
                  </span>
                  <ChevronRight size={20} className="chev" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
