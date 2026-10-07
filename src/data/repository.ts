// Mock data layer. Every function here is what a screen calls; in the real app
// each one is swapped for a call to a generated Power Apps data service
// (Dataverse tables for counts and tickets, XBS/Comtras extracts for expected
// stock). Screens never read the JSON directly.

import raw from "./xbs-2026-03-02.json";
import type {
  Check,
  Counter,
  LineStatus,
  Site,
  SiteCode,
  Variance,
  XbsLine,
  ZoneCell,
  ZoneStatus,
} from "./types";

const lines = raw as XbsLine[];

export const CYCLE = {
  name: "February close count",
  period: "P02 2026",
  countDate: "Mon 2 Mar 2026",
  now: "11:40",
  snapshot: "XBS stock as at 2 Mar 2026, 08:52",
  signOffDay: 2,
  signOffTarget: 7,
};

export const SITES: Site[] = [
  { code: "IBR", name: "Ibero Export Warehouse", short: "Ibero", thirdParty: false },
  { code: "AGL", name: "AGL", short: "AGL", thirdParty: true },
  { code: "KPCU", name: "New KPCU", short: "New KPCU", thirdParty: true },
  { code: "MAXA", name: "Maxa Africa Logistics", short: "Maxa", thirdParty: true },
  { code: "MCF", name: "Mitchel Cotts Freight", short: "Mitchel Cotts", thirdParty: true },
  { code: "KCCE", name: "Kenya Co-op Coffee Exporters", short: "KCCE", thirdParty: true },
];

export const SITE_CEILING = 6000; // bags per third-party site on count day
export const site = (c: SiteCode) => SITES.find((s) => s.code === c)!;

export const allLines = () => lines;
export const linesAt = (wh: SiteCode) => lines.filter((l) => l.wh === wh);
export const linesInZone = (zone: string) =>
  lines.filter((l) => l.wh === "IBR" && l.z === zone);

export const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

/* ---------- zones ---------- */

const ZONE_RE = /^([A-G])(?:\/[A-G])?-(\d{2})(?:\/(\d{2}))?-(\d+)$/;

export function parseZone(z: string) {
  const m = z.match(ZONE_RE);
  if (!m) return null;
  return { row: m[1], bay: +m[2], bayTo: m[3] ? +m[3] : +m[2], level: +m[4] };
}

/** Demo progress: rows A–C counted, D under way, E–G not started. */
const VARIANCE_ZONES = new Set(["A-01-1", "A-03-2", "C-11-1", "D-04-3", "D-09-1"]);
export function zoneStatus(zone: string): ZoneStatus {
  if (VARIANCE_ZONES.has(zone)) return "variance";
  if (zone.startsWith("F-05/06")) return "done";
  const p = parseZone(zone);
  if (!p) return "todo";
  if ("ABC".includes(p.row)) return "done";
  if (p.row === "D") return p.bay <= 4 ? "done" : p.bay <= 9 ? "active" : "todo";
  return "todo";
}

export function iberoGrid(): ZoneCell[] {
  const cells = new Map<string, ZoneCell>();
  for (const r of "ABCDEFG")
    for (let b = 1; b <= 14; b++)
      cells.set(r + b, { row: r, bay: b, zones: [], status: "todo", bags: 0 });
  for (const l of linesAt("IBR")) {
    const p = l.z && parseZone(l.z);
    if (!p) continue;
    const c = cells.get(p.row + p.bay)!;
    if (!c.zones.includes(l.z!)) c.zones.push(l.z!);
    c.bags += l.bg;
  }
  const rank: ZoneStatus[] = ["todo", "done", "active", "variance"];
  for (const c of cells.values()) {
    c.zones.sort();
    const st = c.zones.map(zoneStatus);
    c.status = st.length
      ? st.reduce((a, s) => (rank.indexOf(s) > rank.indexOf(a) ? s : a), "todo" as ZoneStatus)
      : "todo";
    if (st.length && st.every((s) => s === "done")) c.status = "done";
  }
  return [...cells.values()];
}

/* ---------- counting ---------- */

/** Where else this outturn is expected — used for the part-lot prompt. */
export function elsewhere(l: XbsLine) {
  return lines.filter((x) => x.o === l.o && !(x.wh === l.wh && x.z === l.z));
}

/** Scripted demo counts so the screens open in a realistic state. */
const DEMO_COUNTS: Record<string, { units: number; bags: number; pockets: number; status: LineStatus }> = {
  "D-03/04-1|14SM0009": { units: 69, bags: 68, pockets: 22.9, status: "match" },
};
export function demoCount(l: XbsLine, zone: string) {
  const key = `${zone}|${l.o}`;
  if (DEMO_COUNTS[key]) return DEMO_COUNTS[key];
  const s = zoneStatus(zone);
  if (s === "done") return { units: l.u, bags: l.bg, pockets: l.pk, status: "match" as LineStatus };
  return null;
}

/** Closest expected outturn when a counter keys one that XBS doesn't know here. */
export function closestOutturn(typed: string, candidates: string[]) {
  const dist = (a: string, b: string) => {
    let d = Math.abs(a.length - b.length);
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++;
    return d;
  };
  return [...candidates].sort((a, b) => dist(typed, a) - dist(typed, b))[0];
}

/* ---------- people (sample names for the demo) ---------- */

export const COUNTERS: Counter[] = [
  { name: "Achieng O.", site: "IBR", area: "Rows D–E", bagsSoFar: 3180, startedAt: 7, recounts: 0 },
  { name: "Brian K.", site: "IBR", area: "Rows D–E", bagsSoFar: 2960, startedAt: 7, recounts: 1 },
  { name: "Cynthia W.", site: "IBR", area: "Rows A–B", bagsSoFar: 3405, startedAt: 7, recounts: 0 },
  { name: "Dennis M.", site: "IBR", area: "Rows A–B", bagsSoFar: 3010, startedAt: 7, recounts: 1 },
  { name: "Esther N.", site: "IBR", area: "Row C", bagsSoFar: 2875, startedAt: 7, recounts: 1 },
  { name: "Felix O.", site: "IBR", area: "Row C", bagsSoFar: 2790, startedAt: 7, recounts: 0 },
  { name: "Grace A.", site: "IBR", area: "Rows F–G", bagsSoFar: 1240, startedAt: 9, recounts: 0 },
  { name: "Hassan J.", site: "AGL", area: "Site 1", bagsSoFar: 2410, startedAt: 8, recounts: 1 },
  { name: "Irene K.", site: "AGL", area: "Site 2", bagsSoFar: 2205, startedAt: 8, recounts: 0 },
  { name: "James W.", site: "AGL", area: "Site 3", bagsSoFar: 1930, startedAt: 8, recounts: 2 },
  { name: "Kevin T.", site: "AGL", area: "Site 4", bagsSoFar: 1415, startedAt: 9, recounts: 0 },
  { name: "Lucy M.", site: "KPCU", area: "Whole site", bagsSoFar: 2280, startedAt: 8, recounts: 0 },
  { name: "Moses K.", site: "MAXA", area: "Whole site", bagsSoFar: 760, startedAt: 10, recounts: 0 },
  { name: "Nancy C.", site: "MCF", area: "Whole site", bagsSoFar: 187, startedAt: 10, recounts: 0 },
];
export const ME = COUNTERS[0];

export const HOURLY = [
  { h: "07", bags: 3480 },
  { h: "08", bags: 7620 },
  { h: "09", bags: 8260 },
  { h: "10", bags: 7890 },
  { h: "11", bags: 3850, partial: true },
];

/* ---------- coverage ---------- */

export function coverage() {
  const ib = linesAt("IBR");
  const ibDone = sum(ib.filter((l) => l.z && zoneStatus(l.z) !== "todo" && zoneStatus(l.z) !== "active"), (l) => l.bg);
  const fixed: Partial<Record<SiteCode, number>> = { AGL: 7960, KPCU: 2280, MAXA: 760, MCF: 187, KCCE: 0 };
  return SITES.map((s) => {
    const total = sum(linesAt(s.code), (l) => l.bg);
    const done = s.code === "IBR" ? ibDone : fixed[s.code] ?? 0;
    return { site: s, total, done, lots: linesAt(s.code).length };
  });
}

/* ---------- variances (scripted from real lots) ---------- */

export const VARIANCES: Variance[] = [
  {
    id: "V-0412", site: "IBR", zone: "A-03-2", outturn: "12KN0015", grade: "AA · KARIAINI",
    expected: 41, counted: 0, cause: "Outturn mismatch",
    why: "At the same stack a counter recorded 12KP0015, which XBS doesn't hold anywhere. Same unit count (41). Likely a misread tag or a typo in XBS.",
    counter: "Cynthia W.", at: "09:14", state: "open", ageHours: 2.4,
  },
  {
    id: "V-0415", site: "IBR", zone: "A-01-1", outturn: "16 lots", grade: "BULK · sales contracts",
    expected: 242, counted: 0, cause: "Unposted gate-out",
    why: "All 16 lots are blocked to contracts the shipment tracker shows as stuffed on 28 Feb. The stuffing hasn't been posted out of XBS.",
    counter: "Dennis M.", at: "09:31", state: "ticket", ageHours: 2.1,
  },
  {
    id: "V-0418", site: "IBR", zone: "C-11-1", outturn: "08GF0003", grade: "PB · KANGOCHO",
    expected: 8, counted: 16, cause: "Duplicate entry",
    why: "Esther N. and Felix O. both submitted this outturn at C-11-1, 6 minutes apart, with 8 units each.",
    counter: "Felix O.", at: "10:02", state: "open", ageHours: 1.6,
  },
  {
    id: "V-0421", site: "IBR", zone: "D-04-3", outturn: "11SM0024", grade: "AB · KARUMANDI",
    expected: 0, counted: 39, cause: "Unposted delivery",
    why: "XBS still shows this outturn at AGL (39 units). It looks like it was moved to Ibero without the transfer being received in XBS.",
    counter: "Brian K.", at: "10:26", state: "open", ageHours: 1.2,
  },
  {
    id: "V-0422", site: "AGL", zone: "AGL · Site 2", outturn: "11SM0024", grade: "AB · KARUMANDI",
    expected: 39, counted: 0, cause: "Unposted delivery",
    why: "Linked to V-0421: the same 39 units were counted at Ibero D-04-3 this morning.",
    counter: "Irene K.", at: "10:40", state: "open", ageHours: 1.0,
  },
  {
    id: "V-0424", site: "AGL", zone: "AGL · Site 1", outturn: "14SM0009", grade: "AB · KARUMANDI",
    expected: 1, counted: 0, cause: "Part lot",
    why: "The other 68 bags of this outturn are at Ibero D-03/04-1 and matched. The single bag at AGL is probably a left-behind bag or was merged at loading.",
    counter: "Hassan J.", at: "10:55", state: "recount", ageHours: 0.8,
  },
  {
    id: "V-0427", site: "IBR", zone: "D-09-1", outturn: "KCS7140", grade: "CLEAN 1",
    expected: 57, counted: 55, cause: "Not yet known",
    why: "No matching movement or duplicate found. Two units short with no pockets recorded.",
    counter: "Achieng O.", at: "11:21", state: "open", ageHours: 0.3,
  },
];

/* ---------- pre-count checks (computed from the snapshot) ---------- */

const CANCELLED = new Set(["3787011", "3787013"]);
const SHIPPED = new Set(["3786965"]);
const STUFFED_28FEB = new Set([
  "3787141", "3787142", "3787143", "3787144", "3787145", "3787146", "3787147", "3787148",
  "3787149", "3787150", "3787151", "3787153", "3787154", "3787194", "3787195", "3787196",
]);
const WARRANT_RE = /^W\d{6}[A-Z0-9]{3}$/;
const where = (l: XbsLine) => `${site(l.wh).short}${l.z && l.z !== "TEMP-0-0" ? " " + l.z : ""}`;

export function checks(): Check[] {
  const W = lines.filter((l) => l.t === "W");
  const tp = W.filter((l) => site(l.wh).thirdParty);
  const mk = (rows: XbsLine[], info: (l: XbsLine) => string, ref: (l: XbsLine) => string = (l) => l.o) =>
    rows.map((l) => ({ ref: ref(l), where: where(l), info: info(l), bags: l.bg }));

  const cancelled = W.filter((l) => l.so && CANCELLED.has(l.so));
  const shipped = W.filter((l) => l.so && SHIPPED.has(l.so));
  const stuffed = W.filter((l) => l.so && STUFFED_28FEB.has(l.so));
  const aged = tp.filter((l) => (l.d ?? 0) > 21).sort((a, b) => (b.d ?? 0) - (a.d ?? 0));
  const noLoc = tp.filter((l) => l.z === "TEMP-0-0");
  const badWarrant = W.filter((l) => l.wr && !WARRANT_RE.test(l.wr));
  const remnants = W.filter((l) => l.bg === 0);

  const byOutturn = new Map<string, XbsLine[]>();
  for (const l of W) byOutturn.set(l.o, [...(byOutturn.get(l.o) ?? []), l]);
  const split = [...byOutturn.values()].filter((xs) => new Set(xs.map((x) => x.wh)).size > 1);

  return [
    {
      id: "stuffed", severity: "high", owner: "Logistics",
      title: "Stuffed but still in stock",
      detail: "Contracts show stuffing on 28 Feb, but the lots haven't been posted out of XBS. Counters will find nothing at A-01-1.",
      count: new Set(stuffed.map((l) => l.so)).size, bags: sum(stuffed, (l) => l.bg), unit: "contracts",
      rows: mk(stuffed, (l) => `Contract ${l.so} · stuffed 28 Feb`, (l) => l.b),
    },
    {
      id: "cancelled", severity: "high", owner: "Trade",
      title: "Stock blocked to cancelled contracts",
      detail: "The contract is cancelled in the shipment tracker but the lot is still blocked to it in XBS. Release the block in BRIC and XBS.",
      count: new Set(cancelled.map((l) => l.so)).size, bags: sum(cancelled, (l) => l.bg), unit: "contracts",
      rows: mk(cancelled, (l) => `Contract ${l.so} · cancelled`, (l) => l.b),
    },
    {
      id: "shipped", severity: "high", owner: "Trade",
      title: "Stock blocked to a shipped contract",
      detail: "Contract 3786965 sailed on 8 Nov 2025 and its documents are dispatched. These lots should no longer be on the books.",
      count: shipped.length, bags: sum(shipped, (l) => l.bg), unit: "lots",
      rows: mk(shipped, (l) => `Contract ${l.so} · ${l.kg} kg · ${l.d} days`, (l) => l.b),
    },
    {
      id: "aged", severity: "medium", owner: "Operations",
      title: "Third-party stock over 21 days",
      detail: "Past the call-off rule. Each day adds storage and demurrage cost.",
      count: aged.length, bags: sum(aged, (l) => l.bg), unit: "lots",
      rows: mk(aged, (l) => `${l.d} days · ${l.i}${l.g ? " · " + l.g : ""}`),
    },
    {
      id: "split", severity: "medium", owner: "Stock Control",
      title: "Outturns split across sites",
      detail: "The same outturn is expected at more than one warehouse. Counters get a prompt so stray bags aren't missed.",
      count: split.length, bags: sum(split.flat(), (l) => l.bg), unit: "outturns",
      rows: split.map((xs) => ({
        ref: xs[0].o,
        where: xs.map((x) => `${site(x.wh).short} ${x.bg}`).join(", "),
        info: xs[0].g ?? xs[0].i,
        bags: sum(xs, (x) => x.bg),
      })),
    },
    {
      id: "noloc", severity: "medium", owner: "Operations",
      title: "Third-party lots with no stack location",
      detail: "XBS holds these at TEMP-0-0. Counters will record stacks as they go, so next month's count starts with a map.",
      count: noLoc.length, bags: sum(noLoc, (l) => l.bg), unit: "lots",
      rows: mk(noLoc.slice(0, 60), (l) => `${l.i}${l.g ? " · " + l.g : ""}`),
    },
    {
      id: "warrant", severity: "low", owner: "Trade",
      title: "Warrant numbers in the wrong format",
      detail: "Expected W + date + 3 characters, e.g. W260123LDC. Fix in XBS so tags can be scanned and matched.",
      count: badWarrant.length, bags: sum(badWarrant, (l) => l.bg), unit: "lots",
      rows: mk(badWarrant, (l) => `Warrant ${l.wr}`),
    },
    {
      id: "remnant", severity: "low", owner: "Warehouse",
      title: "Pocket-only remainders",
      detail: "Lots with no full bags left, only loose kilos. Bulk them or write them off before the count.",
      count: remnants.length, bags: 0, unit: "lots",
      rows: mk(remnants, (l) => `${l.kg} kg · ${l.d ?? "?"} days · ${l.cy}`),
    },
  ];
}

/* ---------- sign-off ---------- */

export function primaryBasket(name = ""): "Plus" | "FAQ" | "Grinder" {
  if (/Top|Plus|Better|Certified/i.test(name)) return "Plus";
  if (/Grinder|Minus|MH|ML|UG|NATURAL|below|Light|H CLASS/i.test(name)) return "Grinder";
  return "FAQ";
}

export function reconciliation() {
  const groups = { Plus: 0, FAQ: 0, Grinder: 0 } as Record<string, number>;
  for (const l of lines) groups[primaryBasket(l.bn)] += l.bg;
  // Physical and Comtras are sample figures until real counts and extracts are connected.
  const physDelta = { Plus: -2, FAQ: -38, Grinder: 17 } as Record<string, number>;
  const comtrasDelta = { Plus: 0, FAQ: 21, Grinder: -9 } as Record<string, number>;
  return (["Plus", "FAQ", "Grinder"] as const).map((k) => ({
    basket: k,
    xbs: groups[k],
    physical: groups[k] + physDelta[k],
    comtras: groups[k] + comtrasDelta[k],
  }));
}
