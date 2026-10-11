import { useState } from "react";
import { Lock, MapPin, PackageSearch, Search, TriangleAlert } from "lucide-react";
import { useNav } from "../App";
import { ASSIGNMENT, allLines, closestOutturn, groupByBatch, iberoLocationsOf, linesAt, locationCode, site, zoneRows, zoneWords, type Lot } from "../data/repository";
import { useStore } from "../data/store";
import { Code, Notice, PageHead, Pill, Row, Section, Stepper } from "../ui/kit";

// Outturn-first counting, as on the old count sheets (outturn → location → level):
// read the tag, type the outturn, say where it is, then count it blind.
// XBS locations are offered as suggestions — they say nothing about quantities.

export default function CountOutturn() {
  const go = useNav();
  const store = useStore();
  const s = site("IBR");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<{ lot?: Lot; outturn: string } | null>(null);
  const [where, setWhere] = useState("");
  const [level, setLevel] = useState(1);

  const t = q.trim().toUpperCase().replace(/\s+/g, "");
  // Manual entry off: only lots XBS holds at Ibero can be picked.
  const pool = groupByBatch(s.manualEntry ? allLines() : linesAt("IBR"));
  const matches = t.length >= 2 ? pool.filter((l) => l.head.o.includes(t) || (l.head.g ?? "").toUpperCase().includes(t)).slice(0, 8) : [];
  const exact = pool.some((l) => l.head.o === t);
  // Only once nothing matches what's typed, so it doesn't nag mid-typing.
  const nothing = t.length >= 5 && !exact && !matches.length;
  const suggestion = nothing ? closestOutturn(t, pool.map((l) => l.head.o)) : null;

  const count = (stack: string) => {
    if (!picked) return;
    go({ tab: "count", view: "lot", site: "IBR", stack, batch: picked.lot?.batch ?? "FOUND:" + picked.outturn, from: "find" });
  };

  /* ---------- step 2: where is it? ---------- */
  if (picked) {
    const known = picked.lot ? iberoLocationsOf(picked.lot) : [];
    const typed = where.trim() ? locationCode(where, level) : null;
    const state = (stack: string) => store.stackState("IBR", stack)?.state;
    const closed = (stack: string) => state(stack) === "submitted" || state(stack) === "approved";
    const counted = (stack: string) => !!picked.lot && !!store.entry("IBR", stack, picked.lot.batch);
    const outside = (stack: string) => !zoneRows(stack).some((r) => ASSIGNMENT.rows.includes(r));

    return (
      <div className="page">
        <PageHead
          back={{ label: "Outturn", onClick: () => setPicked(null) }}
          title={picked.outturn}
          code
          sub={picked.lot ? [picked.lot.head.i, picked.lot.head.bn, picked.lot.head.g].filter(Boolean).join(" · ") : "Not in XBS — found stock"}
        />

        {known.length > 0 && (
          <Section title="Where XBS has it">
            {known.map((z) => (
              <Row
                key={z}
                lead={
                  <span className="avatar-icon">
                    <MapPin size={18} aria-hidden />
                  </span>
                }
                title={<Code>{z}</Code>}
                sub={zoneWords(z)}
                trail={
                  closed(z) ? (
                    <Pill>
                      <Lock size={12} aria-hidden /> Submitted
                    </Pill>
                  ) : counted(z) ? (
                    <Pill tone="info">Counted</Pill>
                  ) : undefined
                }
                onClick={closed(z) ? undefined : () => count(z)}
              />
            ))}
          </Section>
        )}

        <Section title={known.length ? "Somewhere else" : "Where is it?"}>
          <div className="card">
            <label className="field">
              <span className="label">Bay</span>
              <input
                className="input code"
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                placeholder="e.g. D-05, D5, A/B-14 or D2/3"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <Stepper id="level" size="md" label="Level" value={level} onChange={(v) => setLevel(Math.max(1, Math.round(v)))} />
            {where.trim() && !typed && <p className="hint hint-warn">Type a row A–G and a bay 1–14, e.g. D5 or A/B-14.</p>}
            {typed && (
              <p className="hint">
                <MapPin size={15} aria-hidden /> {zoneWords(typed)} — <Code>{typed}</Code>
              </p>
            )}
            {typed && closed(typed) && (
              <p className="hint hint-crit" role="alert">
                <TriangleAlert size={15} aria-hidden /> {typed} is already submitted. Ask your supervisor to send it back to add this.
              </p>
            )}
            {typed && !closed(typed) && outside(typed) && (
              <p className="hint hint-warn">
                <TriangleAlert size={15} aria-hidden /> Not in your rows ({ASSIGNMENT.rows.join(", ")}). Count it only if it's really here.
              </p>
            )}
            <button className="btn btn-primary btn-lg btn-block" disabled={!typed || closed(typed)} onClick={() => typed && count(typed)}>
              Count it here
            </button>
          </div>
        </Section>
      </div>
    );
  }

  /* ---------- step 1: which outturn? ---------- */
  return (
    <div className="page">
      <PageHead back={{ label: "Home", onClick: () => go({ tab: "count", view: "home" }) }} title="Count an outturn" sub="Type the outturn on the bag tag" />

      <div className="searchbar searchbar-lg">
        <Search size={20} aria-hidden />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 12KN0015" aria-label="Outturn" autoComplete="off" spellCheck={false} />
      </div>

      {!s.manualEntry && (
        <Notice tone="neutral" icon={<Lock size={18} />}>
          Only outturns XBS holds at {s.short} can be picked. Missing one? Report it.
        </Notice>
      )}

      {suggestion && (
        <Notice tone="warn" icon={<PackageSearch size={18} />} title={<>Did you mean <Code>{suggestion}</Code>?</>}>
          It differs by a character or two. Check the tag.
        </Notice>
      )}

      {matches.length > 0 && (
        <Section title="Matches">
          {matches.map((l) => (
            <Row
              key={l.batch}
              title={<Code>{l.head.o}</Code>}
              sub={[l.head.i, l.head.g].filter(Boolean).join(" · ")}
              trail={<span className="muted">{iberoLocationsOf(l).slice(0, 2).join(", ") || "No location in XBS"}</span>}
              onClick={() => setPicked({ lot: l, outturn: l.head.o })}
            />
          ))}
        </Section>
      )}

      {s.manualEntry && nothing && (
        <Section title={`${t} isn't in XBS`}>
          <Row title="Count it as found stock" sub="Your supervisor will look it up" onClick={() => setPicked({ outturn: t })} />
        </Section>
      )}
    </div>
  );
}
