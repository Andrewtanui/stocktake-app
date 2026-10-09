// Reference data for the counter app, and the lookups screens use. The data
// itself is loaded once at start-up by the active data source (mock or
// Dataverse, see ./source) and handed to setReference(); screens never read
// the JSON or call Dataverse directly.

import { defaultPackCode } from "../shared/count-rules";
import type {
  Assignment,
  PackType,
  Site,
  SiteCode,
  StockCategory,
  StockTake,
  VarianceReason,
  XbsLine,
  ZoneCell,
} from "./types";

export interface Reference {
  stockTake: StockTake;
  sites: Site[];
  packTypes: PackType[];
  lines: XbsLine[];
  assignment: Assignment;
}

// Live ES-module bindings: importers see the values set by setReference().
let lines: XbsLine[] = [];
export let STOCK_TAKE: StockTake;
export let SITES: Site[] = [];
export let PACK_TYPES: PackType[] = [];
export let ASSIGNMENT: Assignment;

export function setReference(r: Reference) {
  lines = r.lines;
  STOCK_TAKE = r.stockTake;
  SITES = r.sites;
  PACK_TYPES = r.packTypes;
  ASSIGNMENT = r.assignment;
}

export const site = (c: SiteCode) => SITES.find((s) => s.code === c)!;

export const allLines = () => lines;
export const linesAt = (wh: SiteCode) => lines.filter((l) => l.wh === wh);
export const linesInZone = (zone: string) => lines.filter((l) => l.wh === "IBR" && l.z === zone);
export const linesForOutturn = (o: string) => lines.filter((l) => l.o === o);

export const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

/* ---------- settings: packing types (one table, shared with XBS) ---------- */

export const pack = (id: string) => PACK_TYPES.find((p) => p.id === id) ?? PACK_TYPES[0];
/** Light grades are bagged at 50 kg; XBS weights confirm it (LIGHTS = bags × 50 + pockets). */
export const defaultPack = (grade: string) =>
  defaultPackCode(grade, PACK_TYPES.map((p) => ({ code: p.id, kg: p.kg, gradePattern: p.gradePattern })));

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
