import { useMemo, useState } from "react";
import { ChevronRight, Lock, MapPin, MapPinOff, Plus, Search } from "lucide-react";
import { useNav } from "../App";
import { ASSIGNMENT, bayCode, gridCode, iberoGrid, linesAt, readLocation, site, zoneWords } from "../data/repository";
import { useStore } from "../data/store";
import type { SiteCode, StackStatus, ZoneCell } from "../data/types";
import { Chip, Code, PageHead, STATUS_LABEL, STATUS_TONE, Sheet, n } from "../ui/kit";

export default function SiteView({ code }: { code: SiteCode }) {
  const go = useNav();
  const back = { label: "Count", onClick: () => go({ tab: "count", view: "home" }) };
  return site(code).thirdParty ? <ThirdParty code={code} back={back} /> : <FloorMap back={back} />;
}

const RANK: StackStatus[] = ["todo", "done", "active", "variance"];

function FloorMap({ back }: { back: { label: string; onClick: () => void } }) {
  const go = useNav();
  const store = useStore();
  const cells = useMemo(iberoGrid, []);
  const cellStatus = (c: ZoneCell): StackStatus => {
    const st = c.zones.map((z) => store.stackStatus("IBR", z));
    if (st.length && st.every((s) => s === "done")) return "done";
    return st.reduce((a, s) => (RANK.indexOf(s) > RANK.indexOf(a) ? s : a), "todo" as StackStatus);
  };
  const [sel, setSel] = useState<ZoneCell | undefined>(() => cells.find((c) => c.row === "D" && c.bay === 5));
  const [jump, setJump] = useState("");
  const loc = jump.trim() ? readLocation(jump) : null;
  const jumpCell = loc && cells.find((c) => c.row === loc.row && c.bay === loc.bay);

  return (
    <div className="page">
      <PageHead back={back} title="Ibero Export Warehouse" sub="Rows A–G, bays 1–14. Your rows are outlined. Tap a bay to see its stacks." />

      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (jumpCell) setSel(jumpCell);
        }}
      >
        <label className="field-label" htmlFor="jump">
          Go to a location
        </label>
        <div className="input-row">
          <input
            id="jump"
            className="input input-code"
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            placeholder="D-05, D5 or D005"
            autoComplete="off"
          />
          <button className="btn btn-primary" disabled={!jumpCell}>
            Go
          </button>
        </div>
        {jump.trim() && (
          <p className={loc ? "hint" : "hint hint-bad"}>
            {loc
              ? `Row ${loc.row}, bay ${loc.bay}. Monthly sheets call it ${bayCode(loc.row, loc.bay)}; 100% count sheets call it ${gridCode(loc.row, loc.bay)}.${jumpCell && !jumpCell.zones.length ? " XBS has no stock here." : ""}`
              : "Type a row letter A–G and a bay number 1–14, for example D5."}
          </p>
        )}
      </form>

      <div className="legend" aria-label="Legend">
        {(["done", "active", "variance", "todo"] as StackStatus[]).map((st) => (
          <span key={st} className="legend-item">
            <span className={`swatch s-${st}`} /> {STATUS_LABEL[st]}
          </span>
        ))}
      </div>

      <div className="map-scroll">
        <div className="floor" role="grid" aria-label="Warehouse floor map">
          <div />
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="floor-bay">
              {i + 1}
            </div>
          ))}
          {"ABCDEFG".split("").map((r) => (
            <div className="floor-row" role="row" key={r}>
              <div className={"floor-rowlabel" + (ASSIGNMENT.rows.includes(r) ? " mine" : "")}>{r}</div>
              {cells
                .filter((c) => c.row === r)
                .map((c) => {
                  const st = c.zones.length ? cellStatus(c) : "empty";
                  return (
                    <button
                      key={c.bay}
                      role="gridcell"
                      className={`cell s-${st}` + (ASSIGNMENT.rows.includes(r) ? " cell-mine" : "")}
                      aria-pressed={sel === c}
                      disabled={!c.zones.length}
                      aria-label={`${bayCode(r, c.bay)}: ${c.zones.length} stacks, ${c.bags} bags`}
                      onClick={() => setSel(c)}
                    />
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      {sel && (
        <section className="panel" aria-live="polite">
          <div className="row-between">
            <h2 className="h3">
              Bay <span className="code">{bayCode(sel.row, sel.bay)}</span>
            </h2>
            <span className="muted">
              {sel.zones.length} stacks · {n(sel.bags)} bags
            </span>
          </div>
          <ul className="list list-flush">
            {sel.zones.map((z) => {
              const st = store.stackStatus("IBR", z);
              return (
                <li key={z}>
                  <button className="list-row" onClick={() => go({ tab: "count", view: "stack", site: "IBR", stack: z })}>
                    <span className="list-main">
                      <Code>{z}</Code>
                      <span className="muted small">{zoneWords(z)}</span>
                    </span>
                    <Chip tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Chip>
                    <ChevronRight size={20} className="chev" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function ThirdParty({ code, back }: { code: SiteCode; back: { label: string; onClick: () => void } }) {
  const go = useNav();
  const store = useStore();
  const s = site(code);
  const lots = linesAt(code).filter((l) => l.t === "W");
  const stacks = store.tpStacksAt(code);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const countedOutturns = new Set(store.counts.filter((c) => c.site === code).map((c) => c.outturn));
  const shown = lots.filter((l) => {
    const t = q.trim().toUpperCase();
    return !t || l.o.includes(t) || (l.g ?? "").includes(t) || l.i.includes(t);
  });

  return (
    <div className="page">
      <PageHead back={back} title={s.name} sub={`Third-party warehouse · ${n(lots.length)} lots · ${n(lots.reduce((a, l) => a + l.bg, 0))} bags in XBS`} />

      <div className="callout callout-warn">
        <MapPinOff size={22} aria-hidden />
        <div>
          <strong>XBS has no stack locations here.</strong> Record each stack before you count it, with a landmark so the
          next team can find it.
        </div>
      </div>
      <div className="callout callout-info">
        <Lock size={22} aria-hidden />
        <div>
          <strong>Pick lots from the XBS list.</strong> Typing outturns is switched off at third-party sites, so other
          owners' coffee isn't counted by mistake.
        </div>
      </div>

      <section className="block">
        <div className="row-between">
          <h2 className="h3">Stacks recorded</h2>
          <button className="btn" onClick={() => setAdding(true)}>
            <Plus size={20} aria-hidden /> Record a stack
          </button>
        </div>
        {stacks.length ? (
          <ul className="list">
            {stacks.map((st) => {
              const es = store.entriesAt(code, st.name);
              return (
                <li key={st.name}>
                  <button className="list-row" onClick={() => go({ tab: "count", view: "stack", site: code, stack: st.name })}>
                    <MapPin size={22} aria-hidden className="list-icon" />
                    <span className="list-main">
                      <strong>{st.name}</strong>
                      <span className="muted small">{st.note || "No landmark"}</span>
                    </span>
                    <span className="muted small">{es.length} lots</span>
                    <ChevronRight size={20} className="chev" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty">No stacks recorded yet. Record the first one to start counting.</p>
        )}
      </section>

      <section className="block">
        <h2 className="h3">Lots XBS expects here</h2>
        <label className="search">
          <Search size={20} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Outturn, grower mark or grade" aria-label="Search lots" />
        </label>
        <ul className="list">
          {shown.slice(0, 30).map((l) => (
            <li key={l.b} className="list-row list-static">
              <span className="list-main">
                <Code>{l.o}</Code>
                <span className="muted small">
                  {l.i}
                  {l.g ? ` · ${l.g}` : ""}
                </span>
              </span>
              <span className="num">{l.u} units</span>
              {countedOutturns.has(l.o) ? <Chip tone="ok">Counted</Chip> : <Chip>Not counted</Chip>}
            </li>
          ))}
        </ul>
        {shown.length > 30 && <p className="muted small">Showing 30 of {n(shown.length)}. Search to narrow the list.</p>}
      </section>

      {adding && (
        <Sheet title="Record a stack" onClose={() => setAdding(false)}>
          <label className="field">
            <span className="field-label">Stack name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Site 2 · Stack 3" />
          </label>
          <label className="field">
            <span className="field-label">Landmark</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Next to the north door" />
          </label>
          <button
            className="btn btn-primary btn-xl"
            disabled={!name.trim()}
            onClick={() => {
              store.addTpStack(code, { name: name.trim(), note: note.trim() });
              setAdding(false);
              go({ tab: "count", view: "stack", site: code, stack: name.trim() });
            }}
          >
            Save and start counting
          </button>
        </Sheet>
      )}
    </div>
  );
}
