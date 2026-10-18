// App state for the counter app. Loaded once through the active data source
// (mock or Dataverse), then every change is applied on screen straight away
// and saved through the source. Counts made while offline wait on the phone
// (synced: false) and are sent when the connection comes back.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { kgOf, unitsOf } from "./calc";
import { isMyStack, setReference } from "./repository";
import { EMPTY_STACK, getSource, type CountEntry, type CounterData, type DataSource, type StackState, type TpStack } from "./source";
import type { Issue, SiteCode, StackStatus } from "./types";
import { LoadError, Splash } from "../ui/Splash";

export type { CountEntry, StackState, TpStack };

const key = (site: SiteCode, stack: string) => `${site}|${stack}`;
const lineKey = (e: { site: SiteCode; stack: string; batch: string; by: string }) => `${e.site}|${e.stack}|${e.batch}|${e.by}`;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function useStoreState(me: string, source: DataSource, data: CounterData) {
  const [counts, setCounts] = useState<CountEntry[]>(data.counts);
  const [stacks, setStacks] = useState<Record<string, StackState>>(data.stacks);
  const [tpStacks, setTpStacks] = useState<Record<string, TpStack[]>>(data.tpStacks);
  const [issues, setIssues] = useState<Issue[]>(data.issues);
  const [recountsDone, setRecountsDone] = useState<string[]>(data.recountsDone);
  const [online, setOnlineState] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  };

  /** Runs a save; on failure tells the counter and runs `undo` so the screen doesn't lie. */
  const persist = (work: Promise<void>, what: string, undo?: () => void) =>
    work.catch((e: unknown) => {
      console.error(e);
      undo?.();
      flash(`Couldn't save ${what}. ${e instanceof Error ? e.message : ""}`.trim());
    });

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const markSynced = (id: string, synced: boolean) => setCounts((cs) => cs.map((c) => (c.id === id ? { ...c, synced } : c)));

  return {
    me,
    source: source.kind,
    counts,
    stacks,
    tpStacks,
    issues,
    online,
    toast,
    pending: counts.filter((c) => !c.synced).length,

    setOnline(v: boolean) {
      setOnlineState(v);
      if (!v) return flash("Offline. Counts will be kept on this phone.");
      const waiting = counts.filter((c) => !c.synced);
      for (const c of waiting) persist(source.saveCount({ ...c, synced: true }).then(() => markSynced(c.id, true)), c.outturn);
      if (waiting.length) flash(`Back online. Sending ${waiting.length} saved count${waiting.length === 1 ? "" : "s"}.`);
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

    saveCount(e: Omit<CountEntry, "id" | "by" | "at" | "synced">) {
      const existing = counts.find((c) => lineKey(c) === lineKey({ ...e, by: me }));
      const full: CountEntry = { ...e, id: existing?.id ?? newId(), by: me, at: now(), synced: online, hasPhoto: !!e.photo || existing?.hasPhoto };
      setCounts((cs) => [...cs.filter((c) => c.id !== full.id), full]);
      if (online) persist(source.saveCount(full), e.outturn, () => markSynced(full.id, false));
      if (e.recount) {
        setRecountsDone((r) => [...r, e.recount!]);
        persist(source.completeRecount(e.recount), "the recount", () => setRecountsDone((r) => r.filter((x) => x !== e.recount)));
        const k = key(e.site, e.stack);
        setStacks((s) => (s[k]?.state === "rejected" ? { ...s, [k]: { state: "submitted", at: full.at, comment: "Recounted" } } : s));
      }
      flash(online ? `Saved ${e.outturn}.` : `Saved ${e.outturn} on this phone. It will send when you're back online.`);
    },

    stackState(site: SiteCode, stack: string): StackState | undefined {
      return stacks[key(site, stack)];
    },
    submitStack(site: SiteCode, stack: string, comment: string) {
      const k = key(site, stack);
      const before = stacks[k];
      setStacks((s) => ({ ...s, [k]: { state: "submitted", at: now(), comment: comment || undefined } }));
      persist(source.submitStack(site, stack, comment), `stack ${stack}`, () =>
        setStacks((s) => {
          const next = { ...s };
          if (before) next[k] = before;
          else delete next[k];
          return next;
        }),
      );
      flash(`Stack ${stack} sent to the supervisor.`);
    },

    /** Progress shown on the floor map and stack lists. Never compares with XBS (blind counting). */
    stackStatus(site: SiteCode, stack: string): StackStatus {
      const st = stacks[key(site, stack)];
      const es = counts.filter((c) => c.site === site && c.stack === stack);
      if (st?.state === "rejected") return "variance";
      if (st) return "done";
      if (es.length) return "active";
      // Demo only: in mock mode other teams finished rows A–C this morning.
      if (source.kind === "mock" && site === "IBR" && !isMyStack(stack) && "ABC".includes(stack[0])) return "done";
      return "todo";
    },

    tpStacksAt(site: SiteCode) {
      return tpStacks[site] ?? [];
    },
    /** Nothing to count at this third-party site: reported with the reason instead of a count. */
    reportEmptySite(site: SiteCode, reason: string) {
      const k = key(site, EMPTY_STACK);
      setTpStacks((t) => ({ ...t, [site]: [...(t[site] ?? []), { name: EMPTY_STACK, note: "Nothing to count here" }] }));
      setStacks((s) => ({ ...s, [k]: { state: "submitted", at: now(), comment: reason, empty: true } }));
      persist(source.reportEmptySite(site, reason), "the empty site", () => {
        setTpStacks((t) => ({ ...t, [site]: (t[site] ?? []).filter((x) => x.name !== EMPTY_STACK) }));
        setStacks((s) => {
          const next = { ...s };
          delete next[k];
          return next;
        });
      });
      flash("Reported. Your supervisor will check it.");
    },
    /** Every stack at this third-party site is counted. */
    finishSite(site: SiteCode) {
      const k = key(site, EMPTY_STACK);
      setTpStacks((t) => ({ ...t, [site]: [...(t[site] ?? []), { name: EMPTY_STACK, note: "Site finished" }] }));
      setStacks((s) => ({ ...s, [k]: { state: "submitted", at: now(), comment: "Every stack at the site is counted", finished: true } }));
      persist(source.finishSite(site), "the finished site", () => {
        setTpStacks((t) => ({ ...t, [site]: (t[site] ?? []).filter((x) => x.name !== EMPTY_STACK) }));
        setStacks((s) => {
          const next = { ...s };
          delete next[k];
          return next;
        });
      });
      flash("Site finished. Your supervisor sees what wasn't found.");
    },
    addTpStack(site: SiteCode, s: TpStack) {
      setTpStacks((t) => ({ ...t, [site]: [...(t[site] ?? []), s] }));
      persist(source.addTpStack(site, s), s.name, () => setTpStacks((t) => ({ ...t, [site]: (t[site] ?? []).filter((x) => x.name !== s.name) })));
      flash(`${s.name} recorded.`);
    },

    recount(id: string) {
      return data.recounts.find((r) => r.id === id);
    },
    recountsOpen() {
      return data.recounts.filter((r) => !recountsDone.includes(r.id));
    },
    recountsDone() {
      return data.recounts.filter((r) => recountsDone.includes(r.id));
    },

    addIssue(i: Omit<Issue, "id" | "by" | "at" | "status">) {
      const id = `C-${120 + issues.length}`;
      const full: Issue = { ...i, id, by: me, at: `Today, ${now()}`, status: "Open", hasPhoto: !!i.photo };
      setIssues((xs) => [full, ...xs]);
      persist(
        source.addIssue(full).catch((e: unknown) => {
          // Report saved, photo not: keep the report, say what happened.
          if (e instanceof Error && e.name === "PhotoNotSaved") {
            setIssues((xs) => xs.map((x) => (x.id === id ? { ...x, hasPhoto: false } : x)));
            flash(e.message);
            return;
          }
          throw e;
        }),
        "your report",
        () => setIssues((xs) => xs.filter((x) => x.id !== id)),
      );
      flash(`Problem ${id} sent to the stock take lead.`);
    },
  };
}

export type Store = ReturnType<typeof useStoreState>;
const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

type Phase = { s: "loading" } | { s: "error"; message: string } | { s: "ready"; source: DataSource; data: CounterData };

/** Loads the data source, then provides the store. Shows a splash while loading and a retry screen on failure. */
export function StoreProvider({ me, children }: { me: string; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ s: "loading" });
  const load = useCallback(async () => {
    setPhase({ s: "loading" });
    try {
      const source = await getSource();
      const data = await source.load(me);
      setReference(data.reference);
      setPhase({ s: "ready", source, data });
    } catch (e) {
      console.error(e);
      setPhase({ s: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [me]);
  useEffect(() => {
    void load();
  }, [load]);

  if (phase.s === "loading") return <Splash />;
  if (phase.s === "error") return <LoadError message={phase.message} onRetry={load} />;
  return (
    <Ready me={me} source={phase.source} data={phase.data}>
      {children}
    </Ready>
  );
}

function Ready({ me, source, data, children }: { me: string; source: DataSource; data: CounterData; children: ReactNode }) {
  const s = useStoreState(me, source, data);
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}

export { kgOf, unitsOf };
