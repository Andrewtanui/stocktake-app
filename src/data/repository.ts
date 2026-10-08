// Mock data layer for the counter app. Every function here is what a screen
// calls; in the real app each one is swapped for a call to a generated Power
// Apps data service (the NKG_config and count-sheet SharePoint lists, and the
// XBS import staged in Dataverse). Screens never read the JSON directly.

import raw from "./xbs-2026-03-02.json";
import type {
  Assignment,
  Issue,
  PackType,
  RecountTask,
  Site,
  SiteCode,
  StockCategory,
  StockTake,
  VarianceReason,
  XbsLine,
  ZoneCell,
} from "./types";

const lines = raw as XbsLine[];

export const STOCK_TAKE: StockTake = {
  id: "ST-2026-03",
  title: "Monthly Stock Take - 02/03/2026",
  type: "Monthly stock take",
  countDate: "Mon 2 Mar 2026",
  snapshot: "XBS stock imported 2 Mar 2026, 08:52",
  sites: ["IBR", "AGL", "KPCU", "MAXA", "MCF", "KCCE"],
};

export const SITES: Site[] = [
  { code: "IBR", name: "Ibero Export Warehouse", short: "Ibero", thirdParty: false, manualEntry: true },
  { code: "AGL", name: "AGL", short: "AGL", thirdParty: true, manualEntry: false },
  { code: "KPCU", name: "New KPCU", short: "New KPCU", thirdParty: true, manualEntry: false },
  { code: "MAXA", name: "Maxa Africa Logistics", short: "Maxa", thirdParty: true, manualEntry: false },
  { code: "MCF", name: "Mitchel Cotts Freight", short: "Mitchel Cotts", thirdParty: true, manualEntry: false },
  { code: "KCCE", name: "Kenya Co-op Coffee Exporters", short: "KCCE", thirdParty: true, manualEntry: false },
];
export const site = (c: SiteCode) => SITES.find((s) => s.code === c)!;

export const allLines = () => lines;
export const linesAt = (wh: SiteCode) => lines.filter((l) => l.wh === wh);
export const linesInZone = (zone: string) => lines.filter((l) => l.wh === "IBR" && l.z === zone);
export const linesForOutturn = (o: string) => lines.filter((l) => l.o === o);

export const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

/* ---------- settings: packing types (one table, shared with XBS) ---------- */

export const PACK_TYPES: PackType[] = [
  { id: "JUTE60", label: "60 kg jute bag", kg: 60, hint: "Standard coffee" },
  { id: "JUTE50", label: "50 kg jute bag", kg: 50, hint: "Light coffee fills a bag at 50 kg" },
];
export const pack = (id: PackType["id"]) => PACK_TYPES.find((p) => p.id === id)!;
/** Light grades are bagged at 50 kg; XBS weights confirm it (LIGHTS = bags × 50 + pockets). */
export const defaultPack = (grade: string): PackType["id"] => (/LIGHT/i.test(grade) ? "JUTE50" : "JUTE60");

export const CATEGORIES: StockCategory[] = [
  "Current stock",
  "Processing stock",
  "Work in progress",
  "Sweepings",
  "Loose bags",
  "Disputed stock",
  "Direct purchase (not in XBS)",
  "Ex-office stock",
];
/** Categories counted without an XBS outturn, from the "Other stock" screen. */
export const OTHER_CATEGORIES = CATEGORIES.slice(3);

export const REASONS: VarianceReason[] = [
  "Part of the lot is at another location",
  "Bags moved here, not yet received in XBS",
  "Bags left this stack, not yet posted out",
  "Torn or re-bagged bags",
  "Pocket weighed differently",
  "Tag missing or unreadable",
  "Stack blocked, couldn't reach every bag",
  "Not sure, supervisor to check",
];

/* ---------- locations ---------- */

const ZONE_RE = /^([A-G])(?:\/[A-G])?-(\d{2})(?:\/(\d{2}))?-(\d+)$/;

/** XBS stack code, e.g. "D-02/03-4" = row D, bays 2–3, level 4. */
export function parseZone(z: string) {
  const m = z.match(ZONE_RE);
  if (!m) return null;
  return { row: m[1], bay: +m[2], bayTo: m[3] ? +m[3] : +m[2], level: +m[4] };
}

export function zoneWords(z: string) {
  const p = parseZone(z);
  if (!p) return z;
  const bays = p.bayTo !== p.bay ? `bays ${p.bay}–${p.bayTo}` : `bay ${p.bay}`;
  return `Row ${p.row} · ${bays} · level ${p.level}`;
}

/**
 * Reads a location however the counter types it. Monthly count sheets use
 * "D-05" (row letter + bay 1–14); 100% count sheets use grid codes like "D005".
 * Both, plus "D5", "d 05" and "D-05-1", resolve to the same row and bay.
 */
export function readLocation(input: string): { row: string; bay: number } | null {
  const m = input.trim().toUpperCase().match(/^([A-G])\s*-?\s*0*(\d{1,2})(?:\s*-\s*\d+)?$/);
  if (!m) return null;
  const bay = +m[2];
  if (bay < 1 || bay > 14) return null;
  return { row: m[1], bay };
}
export const bayCode = (row: string, bay: number) => `${row}-${String(bay).padStart(2, "0")}`;
export const gridCode = (row: string, bay: number) => `${row}${String(bay).padStart(3, "0")}`;

export function iberoGrid(): ZoneCell[] {
  const cells = new Map<string, ZoneCell>();
  for (const r of "ABCDEFG")
    for (let b = 1; b <= 14; b++) cells.set(r + b, { row: r, bay: b, zones: [], bags: 0 });
  for (const l of linesAt("IBR")) {
    const p = l.z && parseZone(l.z);
    if (!p) continue;
    const c = cells.get(p.row + p.bay)!;
    if (!c.zones.includes(l.z!)) c.zones.push(l.z!);
    c.bags += l.bg;
  }
  for (const c of cells.values()) c.zones.sort();
  return [...cells.values()];
}

export function zonesInRows(rows: string[]) {
  return [...new Set(linesAt("IBR").map((l) => l.z!).filter((z) => rows.includes(z[0])))].sort((a, b) => {
    const pa = parseZone(a)!;
    const pb = parseZone(b)!;
    return pa.row.localeCompare(pb.row) || pa.bay - pb.bay || a.localeCompare(b);
  });
}

/* ---------- lots ---------- */

export interface Lot {
  batch: string;
  head: XbsLine;
  parts: XbsLine[];
  units: number;
  bags: number;
  pockets: number;
  kg: number;
}

/** Warehouse and Blocked-for-Processing rows of one batch at one place, shown as one lot. */
export function groupByBatch(ls: XbsLine[]): Lot[] {
  const m = new Map<string, XbsLine[]>();
  for (const l of ls) m.set(l.b, [...(m.get(l.b) ?? []), l]);
  return [...m.entries()].map(([batch, parts]) => ({
    batch,
    head: parts[0],
    parts,
    units: sum(parts, (p) => p.u),
    bags: sum(parts, (p) => p.bg),
    pockets: sum(parts, (p) => p.pk),
    kg: sum(parts, (p) => p.kg),
  }));
}

/** Expected lots at a stack. At third-party sites XBS has no stacks, so every lot at the site is a candidate. */
export function expectedLots(code: SiteCode, stack: string) {
  return groupByBatch(code === "IBR" ? linesInZone(stack) : linesAt(code).filter((l) => l.t === "W"));
}

/** Where else XBS expects this outturn — used for the split-lot prompt. */
export function elsewhere(l: XbsLine) {
  return lines.filter((x) => x.o === l.o && !(x.wh === l.wh && x.z === l.z));
}

/** Closest expected outturn when a counter types one that XBS doesn't know here. */
export function closestOutturn(typed: string, candidates: string[]) {
  const dist = (a: string, b: string) => {
    let d = Math.abs(a.length - b.length);
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++;
    return d;
  };
  const best = [...candidates].sort((a, b) => dist(typed, a) - dist(typed, b))[0];
  return best && dist(typed, best) <= 3 ? best : null;
}

/* ---------- the signed-in counter (sample names for the demo) ---------- */

export const ASSIGNMENT: Assignment = { site: "IBR", rows: ["D", "E"], label: "Ibero rows D and E" };
export const TEAMMATE = "Brian K.";

/**
 * Scripted state so the demo opens mid-morning: rows D bays 1–4 counted and
 * submitted, D-04-3 sent back by the supervisor, and a teammate already
 * part-way through D-05-1.
 */
export const DEMO = {
  now: "11:40",
  submittedBays: 4,
  rejected: { stack: "D-04-3", by: "Peter M. (Supervisor)", at: "10:58", comment: "16EC0009 is 2 units short and XBS also has it at KCCE. Please recount." },
  approvedUpTo: 3,
  short: { stack: "D-04-3", batch: "2025/2026-18-6517-KINJO/XBB.004F02", units: 29 },
  /** Brian K. already counted this lot here: opening it shows the duplicate-count prompt. */
  teammateCount: { stack: "D-05-1", batch: "KCS7342-CLEAN 1", units: 52, bags: 51, pocketBags: 1, pocketKg: 20, at: "10:52" },
};

export const RECOUNTS: RecountTask[] = [
  {
    id: "R-031",
    site: "IBR",
    stack: "D-04-3",
    batch: "2025/2026-18-6517-KINJO/XBB.004F02",
    outturn: "16EC0009",
    askedBy: DEMO.rejected.by,
    at: DEMO.rejected.at,
    why: "2 units short. XBS also has 12 units of this outturn at KCCE, so check for bags from another lot on this stack.",
  },
  {
    id: "R-032",
    site: "IBR",
    stack: "D-09-1",
    batch: "KCS7222-CLEAN 1",
    outturn: "KCS7222",
    askedBy: DEMO.rejected.by,
    at: "11:21",
    why: "Brian K.'s count didn't match XBS. Count every bag again from the bottom tier up.",
  },
];

export const ISSUES: Issue[] = [
  {
    id: "C-118",
    category: "Network or saving",
    site: "IBR",
    screen: "Count a lot",
    text: "No signal at the back of row G. Counts stayed on the phone for 20 minutes.",
    by: "Achieng O.",
    at: "Fri 27 Feb, 15:12",
    status: "In progress",
    resolution: "IT is adding a Wi-Fi access point near row G.",
  },
  {
    id: "C-109",
    category: "Tag missing or unreadable",
    site: "AGL",
    screen: "Count a lot",
    text: "Several tags faded at AGL Site 2. Hard to tell 3 from 8.",
    by: "Achieng O.",
    at: "Mon 2 Feb, 10:40",
    status: "Resolved",
    resolution: "AGL re-tagged Site 2 stacks. Faded tags now go in as a variance reason.",
  },
];
