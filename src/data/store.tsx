// In-memory app state for the demo: counts, submitted stacks, recorded
// third-party stacks, complaints and the offline queue. Nothing leaves the
// browser. In the real app saveCount/submitStack write to the count-sheet
// lists, and the offline queue is the Power Apps offline profile.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { compare, kgOf, unitsOf, type Qty } from "./calc";
import {
  ASSIGNMENT,
  DEMO,
  ISSUES,
  RECOUNTS,
  TEAMMATE,
  defaultPack,
  expectedLots,
  parseZone,
  zonesInRows,
} from "./repository";
import type { Issue, SiteCode, StackStatus, StockCategory, VarianceReason } from "./types";

export interface CountEntry extends Qty {
  site: SiteCode;
  stack: string;
  /** XBS batch, or a generated id for lots found but not expected here. */
  batch: string;
  outturn: string;
  grade: string;
  category: StockCategory;
  reason?: VarianceReason;
  note?: string;
  by: string;
  at: string;
  synced: boolean;
  /** Not on the XBS list for this stack: found stock, typed in or picked from elsewhere. */
  found?: boolean;
  /** Sweepings, loose bags and other stock counted without an XBS outturn. */
  other?: boolean;
  /** Direct purchases: contract or delivery note the bags arrived on. */
  reference?: string;
  recount?: string;
}

export interface StackState {
  state: "submitted" | "approved" | "rejected";
  at: string;
  by?: string;
  comment?: string;
}

export interface TpStack {
  name: string;
  note: string;
}

const key = (site: SiteCode, stack: string) => `${site}|${stack}`;
const lineKey = (e: { site: SiteCode; stack: string; batch: string; by: string }) => `${e.site}|${e.stack}|${e.batch}|${e.by}`;

function seed(me: string) {
  const counts: CountEntry[] = [];
  const stacks: Record<string, StackState> = {};
  let minute = 7 * 60 + 10;
  const stamp = () => {
    minute += 3;
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  };
  for (const z of zonesInRows(["D"])) {
    const p = parseZone(z)!;
    if (p.bay > DEMO.submittedBays) continue;
    for (const lot of expectedLots("IBR", z)) {
      const short = z === DEMO.short.stack && lot.batch === DEMO.short.batch;
      const pocketBags = lot.units - lot.bags;
      const bags = short ? lot.bags - 2 : lot.bags;
      counts.push({
        site: "IBR",
        stack: z,
        batch: lot.batch,
        outturn: lot.head.o,
        grade: lot.head.i,
        category: lot.parts.some((x) => x.t === "B") ? "Processing stock" : "Current stock",
        pack: defaultPack(lot.head.i),
        bags,
        pocketBags,
        pocketKg: Math.round(lot.pockets * 10) / 10,
        reason: short ? "Not sure, supervisor to check" : undefined,
        by: me,
        at: stamp(),
        synced: true,
      });
    }
    stacks[key("IBR", z)] =
      z === DEMO.rejected.stack
        ? { state: "rejected", at: DEMO.rejected.at, by: DEMO.rejected.by, comment: DEMO.rejected.comment }
        : p.bay <= DEMO.approvedUpTo
          ? { state: "approved", at: "10:30", by: DEMO.rejected.by }
          : { state: "submitted", at: stamp() };
  }
  const t = DEMO.teammateCount;
  const lot = expectedLots("IBR", t.stack).find((l) => l.batch === t.batch)!;
  counts.push({
    site: "IBR",
    stack: t.stack,
    batch: t.batch,
    outturn: lot.head.o,
    grade: lot.head.i,
    category: "Current stock",
    pack: "JUTE60",
    bags: t.bags,
    pocketBags: t.pocketBags,
    pocketKg: t.pocketKg,
    by: TEAMMATE,
    at: t.at,
    synced: true,
  });
  return { counts, stacks };
}

function useStoreState(me: string) {
  const initial = useMemo(() => seed(me), [me]);
  const [counts, setCounts] = useState<CountEntry[]>(initial.counts);
  const [stacks, setStacks] = useState<Record<string, StackState>>(initial.stacks);
  const [tpStacks, setTpStacks] = useState<Record<string, TpStack[]>>({
    AGL: [
      { name: "Site 1 · Stack 1", note: "Left of gate, under the AGL banner" },
      { name: "Site 2 · Stack 1", note: "North wall, 3 tiers" },
    ],
  });
  const [issues, setIssues] = useState<Issue[]>(() => ISSUES.map((i) => ({ ...i, by: me })));
  const [recountsDone, setRecountsDone] = useState<string[]>([]);
  const [online, setOnlineState] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return {
    me,
    counts,
    stacks,
    tpStacks,
    issues,
    online,
    toast,
    pending: counts.filter((c) => !c.synced).length,

    setOnline(v: boolean) {
      setOnlineState(v);
      if (v) {
        const n = counts.filter((c) => !c.synced).length;
        setCounts((cs) => cs.map((c) => ({ ...c, synced: true })));
        if (n) flash(`Back online. ${n} saved count${n === 1 ? "" : "s"} sent.`);
      } else flash("Offline. Counts will be kept on this phone.");
    },

    entry(site: SiteCode, stack: string, batch: string, by = me) {
      return counts.find((c) => c.site === site && c.stack === stack && c.batch === batch && c.by === by);
    },
    entriesAt(site: SiteCode, stack: string) {
      return counts.filter((c) => c.site === site && c.stack === stack);
    },
    /** Counts of the same outturn by anyone, anywhere except this stack — duplicate / split prompt. */
    otherCounts(outturn: string, site: SiteCode, stack: string) {
      return counts.filter((c) => c.outturn === outturn && !(c.site === site && c.stack === stack));
    },

    saveCount(e: Omit<CountEntry, "by" | "at" | "synced">) {
      const full: CountEntry = { ...e, by: me, at: now(), synced: online };
      setCounts((cs) => [...cs.filter((c) => lineKey(c) !== lineKey(full)), full]);
      if (e.recount) {
        setRecountsDone((r) => [...r, e.recount!]);
        const k = key(e.site, e.stack);
        setStacks((s) => (s[k]?.state === "rejected" ? { ...s, [k]: { state: "submitted", at: full.at, comment: "Recounted" } } : s));
      }
      flash(online ? `Saved ${e.outturn}.` : `Saved ${e.outturn} on this phone. It will send when you're back online.`);
    },

    stackState(site: SiteCode, stack: string): StackState | undefined {
      return stacks[key(site, stack)];
    },
    submitStack(site: SiteCode, stack: string, comment: string) {
      setStacks((s) => ({ ...s, [key(site, stack)]: { state: "submitted", at: now(), comment: comment || undefined } }));
      flash(`Stack ${stack} sent to the supervisor.`);
    },

    /** Status used on the floor map and stack lists. */
    stackStatus(site: SiteCode, stack: string): StackStatus {
      const st = stacks[key(site, stack)];
      const es = counts.filter((c) => c.site === site && c.stack === stack);
      if (st?.state === "rejected") return "variance";
      if (st) {
        const lots = expectedLots(site, stack);
        const off = es.some((c) => {
          if (c.other) return false;
          const lot = lots.find((l) => l.batch === c.batch);
          return c.found || !lot || !compare(c, lot).match;
        });
        return off ? "variance" : "done";
      }
      if (es.length) return "active";
      // Rows outside this counter's area: other teams finished A–C this morning.
      if (site === "IBR" && !ASSIGNMENT.rows.includes(stack[0]) && "ABC".includes(stack[0])) return "done";
      return "todo";
    },

    tpStacksAt(site: SiteCode) {
      return tpStacks[site] ?? [];
    },
    addTpStack(site: SiteCode, s: TpStack) {
      setTpStacks((t) => ({ ...t, [site]: [...(t[site] ?? []), s] }));
      flash(`${s.name} recorded.`);
    },

    recountsOpen() {
      return RECOUNTS.filter((r) => !recountsDone.includes(r.id));
    },
    recountsDone() {
      return RECOUNTS.filter((r) => recountsDone.includes(r.id));
    },

    addIssue(i: Omit<Issue, "id" | "by" | "at" | "status">) {
      const id = `C-${120 + issues.length}`;
      setIssues((xs) => [{ ...i, id, by: me, at: `Today, ${now()}`, status: "Open" }, ...xs]);
      flash(`Problem ${id} sent to the stock take lead.`);
    },
  };
}

export type Store = ReturnType<typeof useStoreState>;
const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

export function StoreProvider({ me, children }: { me: string; children: ReactNode }) {
  const s = useStoreState(me);
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}

export { kgOf, unitsOf };
