import { useMemo, useState } from "react";
import { Lock, MapPin, MapPinOff, Plus, Search } from "lucide-react";
import { useNav } from "../App";
import { bayCode, gridCode, iberoAssignment, iberoGrid, isMyBay, isMyStack, linesAt, myRows, parseZone, readLocation, site, zoneWords } from "../data/repository";
import { useStore } from "../data/store";
import type { SiteCode, StackStatus, ZoneCell } from "../data/types";
import { Code, Notice, PageHead, Pill, Row, STATUS_LABEL, Section, Sheet, StatusIcon, n } from "../ui/kit";

export default function SiteView({ code }: { code: SiteCode }) {
  const go = useNav();
  const back = { label: "Home", onClick: () => go({ tab: "count", view: "home" }) };
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
      <PageHead back={back} title="Floor map" sub="Ibero Export Warehouse" />

      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          if (jumpCell) setSel(jumpCell);
        }}
      >
        <Search size={18} aria-hidden />
        <input value={jump} onChange={(e) => setJump(e.target.value)} placeholder="Go to a bay: D-05, D5 or D005" aria-label="Go to a bay" autoComplete="off" />
        {jumpCell && <button className="text-btn">Go</button>}
      </form>
      {jump.trim() && (
        <p className={loc ? "hint" : "hint hint-warn"}>
          {loc
            ? `Row ${loc.row}, bay ${loc.bay} — ${bayCode(loc.row, loc.bay)} on monthly sheets, ${gridCode(loc.row, loc.bay)} on 100% count sheets.${jumpCell && !jumpCell.zones.length ? " No stock here in XBS." : ""}`
            : "Type a row A–G and a bay 1–14, e.g. D5."}
        </p>
      )}

      <div className="card map-card">
        <div className="floor" role="grid" aria-label="Warehouse floor map">
          <div />
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="floor-bay">
              {i + 1}
            </div>
          ))}
          {"ABCDEFG".split("").map((r) => (
            <div className="floor-row" role="row" key={r}>
              <div className={"floor-rowlabel" + (myRows().includes(r) ? " mine" : "")}>{r}</div>
              {cells
                .filter((c) => c.row === r)
                .map((c) => {
                  const st = c.zones.length ? cellStatus(c) : "empty";
                  return (
                    <button
                      key={c.bay}
                      role="gridcell"
                      className={
                        `cell s-${st}` +
                        (isMyBay(r, c.bay) || c.zones.some(isMyStack) ? " cell-mine" : "") +
                        (c.between?.up ? " between-up" : "") +
                        (c.between?.down ? " between-down" : "")
                      }
                      aria-pressed={sel === c}
                      disabled={!c.zones.length}
                      aria-label={`${bayCode(r, c.bay)}: ${c.zones.length} stack${c.zones.length === 1 ? "" : "s"}${c.between ? ", includes a stack between rows" : ""}`}
                      onClick={() => setSel(c)}
                    />
                  );
                })}
            </div>
          ))}
        </div>
        <div className="legend">
          {(["done", "active", "variance", "todo"] as StackStatus[]).map((st) => (
            <span key={st}>
              <span className={`swatch s-${st}`} /> {STATUS_LABEL[st]}
            </span>
          ))}
          <span>
            <span className="swatch s-empty" /> No stock
          </span>
          <span>
            <span className="swatch swatch-between" /> Stack between two rows
          </span>
        </div>
      </div>

      {sel && (
        <Section title={`Bay ${bayCode(sel.row, sel.bay)} · ${sel.zones.length} stack${sel.zones.length === 1 ? "" : "s"}`}>
          {sel.zones.map((z) => {
            const st = store.stackStatus("IBR", z);
            const p = parseZone(z);
            return (
              <Row
                key={z}
                lead={<StatusIcon s={st} />}
                title={<Code>{z}</Code>}
                sub={zoneWords(z)}
                trail={
                  p?.between && iberoAssignment() && !isMyStack(z) ? (
                    <Pill>Another counter's</Pill>
                  ) : p?.between ? (
                    <Pill tone="warn">
                      Between {p.row} &amp; {p.rowTo}
                    </Pill>
                  ) : (
                    <span className="muted">{STATUS_LABEL[st]}</span>
                  )
                }
                onClick={() => go({ tab: "count", view: "stack", site: "IBR", stack: z })}
              />
            );
          })}
        </Section>
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
  const counted = new Set(store.counts.filter((c) => c.site === code).map((c) => c.outturn));
  const t = q.trim().toUpperCase();
  const shown = lots.filter((l) => !t || l.o.includes(t) || (l.g ?? "").includes(t) || l.i.includes(t));

  return (
    <div className="page">
      <PageHead back={back} title={s.name} sub={`Third party · ${n(lots.length)} lots`} />

      <Notice tone="neutral" icon={<MapPinOff size={18} />} title="No stack locations in XBS">
        Record each stack with a landmark before you count it.
      </Notice>

      <Section
        title="Stacks"
        action={
          <button className="text-btn" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden /> Record a stack
          </button>
        }
      >
        {stacks.map((st) => (
          <Row
            key={st.name}
            lead={
              <span className="avatar-icon">
                <MapPin size={18} aria-hidden />
              </span>
            }
            title={st.name}
            sub={st.note || "No landmark"}
            trail={<span className="muted">{store.entriesAt(code, st.name).length} lots</span>}
            onClick={() => go({ tab: "count", view: "stack", site: code, stack: st.name })}
          />
        ))}
        {!stacks.length && <p className="empty">No stacks yet. Record the first one to start.</p>}
      </Section>

      <Section
        title="Lots XBS expects here"
        action={
          <span className="section-meta">
            <Lock size={13} aria-hidden /> Pick from list only
          </span>
        }
      >
        <div className="searchbar searchbar-inset">
          <Search size={18} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Outturn, grower or grade" aria-label="Search lots" />
        </div>
        {shown.slice(0, 25).map((l) => (
          <Row
            key={l.b}
            lead={<StatusIcon s={counted.has(l.o) ? "match" : "todo"} />}
            title={<Code>{l.o}</Code>}
            sub={`${l.i}${l.g ? " · " + l.g : ""}`}
            trail={counted.has(l.o) ? <span className="muted">Counted</span> : undefined}
          />
        ))}
        {shown.length > 25 && <p className="empty">{n(shown.length - 25)} more — search to narrow.</p>}
      </Section>

      {adding && (
        <Sheet title="Record a stack" onClose={() => setAdding(false)}>
          <label className="field">
            <span className="label">Stack name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Site 2 · Stack 3" />
          </label>
          <label className="field">
            <span className="label">Landmark</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Next to the north door" />
          </label>
          <button
            className="btn btn-primary btn-lg"
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
