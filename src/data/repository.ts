// Reference data for the counter app, and the lookups screens use. The data
// itself is loaded once at start-up by the active data source (mock or
// Dataverse, see ./source) and handed to setReference(); screens never read
// the JSON or call Dataverse directly.

import { defaultPackCode } from "../shared/count-rules";
import { parseSection, zoneInSections } from "../shared/sections";
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
  /** My areas in this stock take: one per warehouse, Ibero first. */
  assignments: Assignment[];
}

// Live ES-module bindings: importers see the values set by setReference().
let lines: XbsLine[] = [];
export let STOCK_TAKE: StockTake;
export let SITES: Site[] = [];
export let PACK_TYPES: PackType[] = [];
export let ASSIGNMENTS: Assignment[] = [];

export function setReference(r: Reference) {
  lines = r.lines;
  STOCK_TAKE = r.stockTake;
  SITES = r.sites;
  PACK_TYPES = r.packTypes;
  ASSIGNMENTS = r.assignments;
}

/* ---------- my areas ---------- */

/** My Ibero assignment, if I count at Ibero. */
export const iberoAssignment = () => ASSIGNMENTS.find((a) => a.site === "IBR");
/** Third-party sites I'm assigned to. */
export const mySites = () => ASSIGNMENTS.filter((a) => a.site !== "IBR").map((a) => a.site);
/** "Ibero row D, bays 1–7 · AGL whole site" */
export const myAreaWords = () => ASSIGNMENTS.map((a) => a.label).join(" · ");

/**
 * Is this Ibero stack mine? With sections (random allocation) a stack is mine when
 * its first bay is in one of my sections, so a stack between two rows has one
 * counter. Older assignments by whole rows show it to the counters of both rows.
 */
export function isMyStack(z: string) {
  const a = iberoAssignment();
  if (!a) return false;
  return a.sections.length ? zoneInSections(z, a.sections) : zoneRows(z).some((r) => a.rows.includes(r));
}

/** Is this floor-map bay in my area (stacks between rows are marked through isMyStack)? */
export function isMyBay(row: string, bay: number) {
  const a = iberoAssignment();
  if (!a) return false;
  if (!a.sections.length) return a.rows.includes(row);
  return a.sections.some((t) => {
    const s = parseSection(t);
    return !!s && !s.between && s.row === row && bay >= s.bayFrom && bay <= s.bayTo;
  });
}

/** Rows I count in (highlighted on the floor map). */
export const myRows = () => iberoAssignment()?.rows ?? [];

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
  "Franchise",
];
/**
 * Categories counted without an XBS outturn, from the "Other stock" screen: the warehouse's
 * sub-products first (Finance's "Subproducts" line: ex-office, sweepings, franchise), then the rest.
 */
export const OTHER_CATEGORIES: StockCategory[] = ["Ex-office stock", "Sweepings", "Franchise", "Loose bags", "Disputed stock", "Direct purchase (not in XBS)"];
/** Ex-office sweepings are graded Type 1, 2 or 3 (the warehouse's sub-products report). */
export const EX_OFFICE_TYPES = ["TYPE 1", "TYPE 2", "TYPE 3"];

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

const ZONE_RE = /^([A-G])(?:\/([A-G]))?-(\d{2})(?:\/(\d{2}))?-(\d+)$/;
const ROWS = "ABCDEFG";

/**
 * XBS stack code, e.g. "D-02/03-4" = row D, bays 2–3, level 4;
 * "A/B-14-1" = a stack between rows A and B, bay 14, level 1.
 */
export function parseZone(z: string) {
  const m = z.match(ZONE_RE);
  if (!m) return null;
  const row = m[1];
  const rowTo = m[2] ?? row;
  return { row, rowTo, between: rowTo !== row, bay: +m[3], bayTo: m[4] ? +m[4] : +m[3], level: +m[5] };
}

/** Every row a stack touches (one, or two when it sits between rows). */
export function zoneRows(z: string) {
  const p = parseZone(z);
  if (!p) return [];
  return ROWS.slice(ROWS.indexOf(p.row), ROWS.indexOf(p.rowTo) + 1).split("");
}

export function zoneWords(z: string) {
  const p = parseZone(z);
  if (!p) return z;
  const rows = p.between ? `Between rows ${p.row} and ${p.rowTo}` : `Row ${p.row}`;
  const bays = p.bayTo !== p.bay ? `bays ${p.bay}–${p.bayTo}` : `bay ${p.bay}`;
  return `${rows} · ${bays} · level ${p.level}`;
}

/**
 * Reads a location however the counter types it. Monthly count sheets use
 * "D-05" (row letter + bay 1–14); 100% count sheets use grid codes like "D005".
 * Both, plus "D5", "d 05" and "D-05-1", resolve to the same row and bay.
 */
export function readLocation(input: string): { row: string; bay: number } | null {
  // Also takes between-row and multi-bay forms ("A/B-14", "D2/3"); it goes to the first row and bay.
  const m = input.trim().toUpperCase().match(/^([A-G])(?:\s*\/\s*[A-G])?\s*-?\s*0*(\d{1,2})(?:\s*\/\s*\d{1,2})?(?:\s*-\s*\d+)?$/);
  if (!m) return null;
  const bay = +m[2];
  if (bay < 1 || bay > 14) return null;
  return { row: m[1], bay };
}
/**
 * Builds the XBS stack code from where a counter says an outturn is: a full code
 * ("D-05-1", "A/B-14-1"), or a bay ("D5", "D-05", "A/B-14", "D2/3") plus a level.
 */
export function locationCode(input: string, level: number): string | null {
  const t = input.trim().toUpperCase().replace(/\s+/g, "");
  if (parseZone(t)) return t;
  const m = t.match(/^([A-G])(?:\/([A-G]))?-?0*(\d{1,2})(?:\/0*(\d{1,2}))?$/);
  if (!m || level < 1) return null;
  const bay = +m[3];
  const bayTo = m[4] ? +m[4] : undefined;
  if (bay < 1 || bay > 14 || (bayTo !== undefined && (bayTo < 1 || bayTo > 14))) return null;
  const pad = (b: number) => String(b).padStart(2, "0");
  return `${m[1]}${m[2] ? "/" + m[2] : ""}-${pad(bay)}${bayTo ? "/" + pad(bayTo) : ""}-${level}`;
}

/** Ibero stacks where XBS has this lot (no quantities — counting is blind). */
export const iberoLocationsOf = (lot: Lot) => [...new Set(lot.parts.filter((p) => p.wh === "IBR" && p.z && parseZone(p.z)).map((p) => p.z!))].sort();

export const bayCode = (row: string, bay: number) => `${row}-${String(bay).padStart(2, "0")}`;
export const gridCode = (row: string, bay: number) => `${row}${String(bay).padStart(3, "0")}`;

export function iberoGrid(): ZoneCell[] {
  const cells = new Map<string, ZoneCell>();
  for (const r of ROWS)
    for (let b = 1; b <= 14; b++) cells.set(r + b, { row: r, bay: b, zones: [], bags: 0 });
  // A stack shows in every bay it covers, including both rows when it sits between them.
  for (const l of linesAt("IBR")) {
    const p = l.z && parseZone(l.z);
    if (!p) continue;
    const rows = zoneRows(l.z!);
    for (const r of rows)
      for (let b = p.bay; b <= p.bayTo; b++) {
        const c = cells.get(r + b);
        if (!c) continue;
        if (!c.zones.includes(l.z!)) c.zones.push(l.z!);
        c.bags += l.bg;
        if (p.between) {
          c.between ??= { up: false, down: false };
          if (r !== rows[0]) c.between.up = true;
          if (r !== rows[rows.length - 1]) c.between.down = true;
        }
      }
  }
  for (const c of cells.values()) c.zones.sort();
  return [...cells.values()];
}

/** My Ibero stacks, by row and bay. */
export function myStacks() {
  return [...new Set(linesAt("IBR").map((l) => l.z!).filter((z) => z && parseZone(z) && isMyStack(z)))].sort((a, b) => {
    const pa = parseZone(a)!;
    const pb = parseZone(b)!;
    return pa.row.localeCompare(pb.row) || pa.bay - pb.bay || a.localeCompare(b);
  });
}

/** Ibero stacks touching these rows (stacks between two rows count for both). */
export function zonesInRows(rows: string[]) {
  return [...new Set(linesAt("IBR").map((l) => l.z!).filter((z) => zoneRows(z).some((r) => rows.includes(r))))].sort((a, b) => {
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
