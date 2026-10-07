import { CircleAlert, Layers, Plus, Shuffle } from "lucide-react";
import { useNav } from "../App";
import { demoCount, elsewhere, linesInZone, site, sum, zoneStatus } from "../data/repository";
import type { XbsLine } from "../data/types";
import { Chip, Code, PageHead, Progress, Stat, n } from "../ui/kit";

/** Warehouse and Blocked-for-Processing rows of one batch at one stack, shown as one line. */
export function groupByBatch(ls: XbsLine[]) {
  const m = new Map<string, XbsLine[]>();
  for (const l of ls) m.set(l.b, [...(m.get(l.b) ?? []), l]);
  return [...m.entries()].map(([batch, parts]) => ({
    batch,
    head: parts[0],
    parts,
    units: sum(parts, (p) => p.u),
    bags: sum(parts, (p) => p.bg),
    kg: sum(parts, (p) => p.kg),
  }));
}

export default function ZoneView({ zone }: { zone: string }) {
  const go = useNav();
  const groups = groupByBatch(linesInZone(zone));
  const st = zoneStatus(zone);
  const hasTypo = zone === "A-03-2";
  const results = groups.map((g) => {
    if (hasTypo && g.head.o === "12KN0015") return "variance";
    return demoCount(g.head, zone)?.status ?? "todo";
  });
  const counted = results.filter((r) => r !== "todo").length;
  const mixedTypes = groups.some((g) => g.parts.some((p) => p.t === "B"));

  return (
    <div className="page">
      <PageHead
        back={{ label: "Floor map", onClick: () => go({ tab: "count", view: "site", site: "IBR" }) }}
        title={zone}
        code
        sub={`Ibero Export Warehouse · ${st === "done" ? "counted" : st === "variance" ? "counted, with a variance" : st === "active" ? "being counted" : "not started"}`}
      />

      <div className="stats">
        <Stat label="Outturns expected" value={groups.length} />
        <Stat label="Units expected" value={n(sum(groups, (g) => g.units))} />
        <Stat label="Weight" value={`${n(sum(groups, (g) => g.kg) / 1000, 2)} t`} />
        <Stat label="Counted" value={`${counted} of ${groups.length}`} tone={counted === groups.length ? "ok" : undefined} />
      </div>
      <Progress value={counted} max={groups.length} />

      {mixedTypes && (
        <div className="callout callout-info">
          <Layers size={20} aria-hidden />
          <div>
            Some lots here are partly in a processing instruction. Expected units add up both parts, so count the
            whole stack as you see it.
          </div>
        </div>
      )}

      <ul className="lines">
        {groups.map((g, i) => {
          const r = results[i];
          const other = elsewhere(g.head).filter((x) => x.wh !== "IBR" || x.z !== zone);
          return (
            <li key={g.batch}>
              <button
                className={`line line-${r}`}
                onClick={() =>
                  go({ tab: "count", view: "line", zone, batch: g.batch, typo: hasTypo && g.head.o === "12KN0015" })
                }
              >
                <div className="line-id">
                  <Code>{g.head.o}</Code>
                  <span className="line-grade">{g.head.i}</span>
                  {g.head.bn && <span className="muted line-basket">{g.head.bn}</span>}
                </div>
                <div className="line-grower muted">{g.head.g ?? g.batch}</div>
                <div className="line-qty">
                  <span className="num">{g.units}</span> units
                  <span className="muted">
                    {" "}
                    · {g.bags} bags + {n(sum(g.parts, (p) => p.pk), 1)} kg
                  </span>
                </div>
                <div className="line-tags">
                  {r === "match" && <Chip tone="ok">Counted, matches</Chip>}
                  {r === "variance" && (
                    <Chip tone="crit">
                      <CircleAlert size={12} aria-hidden /> Tag read 12KP0015
                    </Chip>
                  )}
                  {r === "todo" && <Chip>Not counted</Chip>}
                  {g.parts.some((p) => p.t === "B") && <Chip tone="info">In processing {g.parts.find((p) => p.in)?.in}</Chip>}
                  {g.head.so && <Chip tone="warn">Contract {g.head.so}</Chip>}
                  {other.length > 0 && (
                    <Chip tone="jute">
                      <Shuffle size={12} aria-hidden /> Also at {[...new Set(other.map((x) => site(x.wh).short + (x.wh === "IBR" ? " " + x.z : "")))].slice(0, 2).join(", ")}
                    </Chip>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="sticky-actions">
        <button className="btn">
          <Plus size={18} aria-hidden /> Add an outturn that isn't listed
        </button>
        <button className="btn btn-primary" disabled={counted < groups.length}>
          Submit stack {zone}
        </button>
      </div>
    </div>
  );
}
