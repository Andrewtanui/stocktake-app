import { useMemo, useState } from "react";
import { MapPinOff, Plus, Search, Shuffle } from "lucide-react";
import { useNav } from "../App";
import { SITE_CEILING, elsewhere, iberoGrid, linesAt, linesInZone, site, sum, zoneStatus } from "../data/repository";
import type { SiteCode, ZoneCell, ZoneStatus } from "../data/types";
import { Chip, Code, PageHead, n } from "../ui/kit";

const STATUS_LABEL: Record<ZoneStatus, string> = {
  todo: "Not started",
  active: "Being counted",
  done: "Counted",
  variance: "Has a variance",
};

export default function SiteView({ code }: { code: SiteCode }) {
  const go = useNav();
  const s = site(code);
  const back = { label: "Count", onClick: () => go({ tab: "count", view: "home" }) };
  if (!s.thirdParty) return <FloorMap back={back} />;
  return <ThirdParty code={code} back={back} />;
}

function FloorMap({ back }: { back: { label: string; onClick: () => void } }) {
  const go = useNav();
  const cells = useMemo(iberoGrid, []);
  const [sel, setSel] = useState<ZoneCell | undefined>(() => cells.find((c) => c.row === "D" && c.bay === 5));
  const counts = cells.reduce(
    (a, c) => (c.zones.length ? { ...a, [c.status]: (a[c.status] ?? 0) + 1 } : a),
    {} as Record<string, number>,
  );

  return (
    <div className="page page-wide">
      <PageHead
        back={back}
        title="Ibero Export Warehouse"
        sub="Rows A to G, bays 1 to 14. Tap a bay to see its stacks."
      />
      <div className="legend" aria-label="Legend">
        {(["done", "active", "variance", "todo"] as ZoneStatus[]).map((st) => (
          <span key={st} className="legend-item">
            <span className={`swatch s-${st}`} /> {STATUS_LABEL[st]} <span className="muted">{counts[st] ?? 0}</span>
          </span>
        ))}
      </div>

      <div className="map-layout">
        <div className="map-scroll">
          <div className="floor" role="grid" aria-label="Warehouse floor map">
            <div className="floor-corner" />
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} className="floor-bay">
                {String(i + 1).padStart(2, "0")}
              </div>
            ))}
            {"ABCDEFG".split("").map((r) => (
              <div className="floor-row" role="row" key={r}>
                <div className="floor-rowlabel">{r}</div>
                {cells
                  .filter((c) => c.row === r)
                  .map((c) => (
                    <button
                      key={c.bay}
                      role="gridcell"
                      className={`cell s-${c.zones.length ? c.status : "empty"}`}
                      aria-pressed={sel === c}
                      disabled={!c.zones.length}
                      aria-label={`${r}-${String(c.bay).padStart(2, "0")}: ${c.zones.length} stacks, ${c.bags} bags, ${STATUS_LABEL[c.status]}`}
                      onClick={() => setSel(c)}
                    >
                      {c.zones.length > 0 && <span className="cell-bags">{c.bags >= 1000 ? n(c.bags / 1000, 1) + "k" : c.bags}</span>}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>

        <aside className="bay-panel" aria-live="polite">
          {sel ? (
            <>
              <h2 className="h2">
                Bay <span className="code">{sel.row}-{String(sel.bay).padStart(2, "0")}</span>
              </h2>
              <p className="muted">
                {sel.zones.length} stacks · {n(sel.bags)} bags
              </p>
              <ul className="stack-list">
                {sel.zones.map((z) => {
                  const ls = linesInZone(z);
                  const st = zoneStatus(z);
                  return (
                    <li key={z}>
                      <button className="stack-row" onClick={() => go({ tab: "count", view: "zone", zone: z })}>
                        <span className={`dot s-${st}`} aria-hidden />
                        <Code>{z}</Code>
                        <span className="stack-meta">
                          {ls.length} outturn{ls.length === 1 ? "" : "s"} · {n(sum(ls, (l) => l.u))} units
                        </span>
                        <span className="stack-state">{STATUS_LABEL[st]}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="muted">Select a bay on the map to see its stacks.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

const DEMO_STACKS = [
  { name: "Site 1 · Stack 1", note: "Left of gate, under the AGL banner", lots: 14, by: "Hassan J." },
  { name: "Site 1 · Stack 2", note: "Behind weighbridge office", lots: 9, by: "Hassan J." },
  { name: "Site 2 · Stack 1", note: "North wall, 3 tiers", lots: 21, by: "Irene K." },
];

function ThirdParty({ code, back }: { code: SiteCode; back: { label: string; onClick: () => void } }) {
  const s = site(code);
  const all = linesAt(code).filter((l) => l.t === "W");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "todo" | "counted" | "split">("all");
  const total = sum(all, (l) => l.bg);
  const countedIdx = (i: number) => code !== "AGL" || i % 2 === 0;

  const rows = all
    .map((l, i) => ({ l, counted: countedIdx(i), split: elsewhere(l).some((x) => x.wh !== code) }))
    .filter(({ l, counted, split }) => {
      if (filter === "todo" && counted) return false;
      if (filter === "counted" && !counted) return false;
      if (filter === "split" && !split) return false;
      const t = q.trim().toUpperCase();
      return !t || l.o.includes(t) || (l.g ?? "").includes(t) || l.i.includes(t);
    });

  return (
    <div className="page">
      <PageHead
        back={back}
        title={s.name}
        sub={`${n(all.length)} lots · ${n(total)} bags expected${total > SITE_CEILING ? ` · ${n(total - SITE_CEILING)} over the count-day ceiling` : ""}`}
      />

      <div className="callout callout-warn">
        <MapPinOff size={20} aria-hidden />
        <div>
          <strong>XBS has no stack locations for this site.</strong> Record each stack before you count it. Next
          month's count will open with this map.
        </div>
      </div>

      <section className="block">
        <div className="block-head">
          <h2 className="h2">Stacks recorded today</h2>
          <button className="btn">
            <Plus size={18} aria-hidden /> Add a stack
          </button>
        </div>
        <ul className="stack-cards">
          {(code === "AGL" ? DEMO_STACKS : DEMO_STACKS.slice(0, 1)).map((st) => (
            <li key={st.name} className="stack-card">
              <div className="stack-card-name">{st.name}</div>
              <div className="muted">{st.note}</div>
              <div className="stack-card-foot">
                {st.lots} lots · recorded by {st.by}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <div className="block-head">
          <h2 className="h2">Expected lots</h2>
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={18} aria-hidden />
            <input
              id="lot-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Outturn, grower mark or grade"
              aria-label="Search lots"
            />
          </label>
          <div className="seg" role="group" aria-label="Filter lots">
            {(
              [
                ["all", "All"],
                ["todo", "Not counted"],
                ["counted", "Counted"],
                ["split", "Split lots"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Outturn</th>
                <th>Grade</th>
                <th className="hide-sm">Grower mark</th>
                <th className="num">Units</th>
                <th className="num hide-sm">Days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 40).map(({ l, counted, split }) => (
                <tr key={l.b}>
                  <td>
                    <Code>{l.o}</Code>
                  </td>
                  <td>{l.i}</td>
                  <td className="hide-sm muted">{l.g ?? "—"}</td>
                  <td className="num">{l.u}</td>
                  <td className={"num hide-sm" + ((l.d ?? 0) > 21 ? " t-crit" : "")}>{l.d}</td>
                  <td>
                    <div className="cell-chips">
                      {counted ? <Chip tone="ok">Counted</Chip> : <Chip>Not counted</Chip>}
                      {split && (
                        <Chip tone="jute">
                          <Shuffle size={12} aria-hidden /> Split
                        </Chip>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 40 && <p className="muted small">Showing 40 of {n(rows.length)} lots. Search to narrow the list.</p>}
      </section>
    </div>
  );
}
