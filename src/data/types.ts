// Shapes the counter app works with. The mock repository fills them from the
// 2 Mar 2026 XBS snapshot; in the real app the same shapes come from the
// SharePoint lists / Dataverse staging tables behind the Stock Take app
// (see README, "Wiring real data").

export type SiteCode = "IBR" | "AGL" | "KPCU" | "MAXA" | "MCF" | "KCCE";

/** W = XBS "Warehouse" stock, B = XBS "Blocked for Processing" stock. */
export type StockType = "W" | "B";

/** One row of the XBS "Current Stock – Batch Wise Detail" report. */
export interface XbsLine {
  t: StockType;
  wh: SiteCode;
  z?: string; // zone, e.g. "B-02/03-2"; "TEMP-0-0" = no location
  b: string; // batch no.
  o: string; // outturn no.
  i: string; // item (grade), e.g. AA, AB, CLEAN 1
  bc?: string; // secondary basket code
  bn?: string; // secondary basket name
  bg: number; // full bags
  pk: number; // pockets (loose kg, < 1 bag)
  u: number; // units = physical bag objects
  kg: number; // qty = bg × pack + pk
  g?: string; // grower marks
  wr?: string; // warrant no.
  c?: string; // certification
  cs?: string; // cup score
  bl: boolean; // blocked
  so?: string; // sales order (contract) blocked to
  in?: string; // processing instruction
  d?: number; // days in stock
  cy?: string; // crop year
}

export interface Site {
  code: SiteCode;
  name: string;
  short: string;
  /** NKG_config IsThirdPartyLocation: no XBS stack locations, manual outturn entry switched off. */
  thirdParty: boolean;
  manualEntry: boolean;
}

/** Settings-table row: one packing type, shared with XBS so both calculate weight the same way. */
export interface PackType {
  /** Code, e.g. JUTE60 (stk_packtype.stk_code). */
  id: string;
  label: string;
  kg: number;
  hint: string;
  /** Grades that default to this pack (regex source), e.g. "LIGHT". */
  gradePattern?: string;
}

/** Stock categories from the discovery session (BRD §5.1). */
export type StockCategory =
  | "Current stock"
  | "Processing stock"
  | "Work in progress"
  | "Sweepings"
  | "Loose bags"
  | "Disputed stock"
  | "Direct purchase (not in XBS)"
  | "Ex-office stock";

/** Reasons a counter can give for a variance. Supervisors refine these later. */
export type VarianceReason =
  | "Part of the lot is at another location"
  | "Bags moved here, not yet received in XBS"
  | "Bags left this stack, not yet posted out"
  | "Torn or re-bagged bags"
  | "Pocket weighed differently"
  | "Tag missing or unreadable"
  | "Stack blocked, couldn't reach every bag"
  | "Not sure, supervisor to check";

export type StackStatus = "todo" | "active" | "done" | "variance";

export interface ZoneCell {
  row: string; // A–G
  bay: number; // 1–14
  zones: string[];
  bags: number;
  /** A stack here also sits in the row above / below (XBS "A/B-…" = between rows A and B). */
  between?: { up: boolean; down: boolean };
}

export type StockTakeType = "Monthly stock take" | "100% stock take";

export interface StockTake {
  id: string;
  title: string;
  type: StockTakeType;
  countDate: string;
  snapshot: string;
  sites: SiteCode[];
}

export interface Assignment {
  site: SiteCode;
  /** Ibero rows, e.g. ["D", "E"]; empty for whole-site assignments at third parties. */
  rows: string[];
  /** Ibero sections from the Hub's allocation, e.g. ["D1-7", "C/D"] (see shared/sections.ts). Empty = whole rows. */
  sections: string[];
  label: string;
}

/** A recount asked for by the supervisor when a count sheet was rejected or a variance needs checking. */
export interface RecountTask {
  id: string;
  site: SiteCode;
  stack: string;
  batch: string;
  outturn: string;
  askedBy: string;
  at: string;
  why: string;
}

export type IssueCategory =
  | "App not working"
  | "Network or saving"
  | "Lot not on the list"
  | "Tag missing or unreadable"
  | "Stack blocked or unsafe"
  | "Third-party staff not available"
  | "Other";

export interface Issue {
  id: string;
  category: IssueCategory;
  site: SiteCode;
  screen: string;
  text: string;
  by: string;
  at: string;
  status: "Open" | "In progress" | "Resolved";
  resolution?: string;
  /** Photo sent with the report (only while sending). */
  photo?: import("./photo").Photo;
  hasPhoto?: boolean;
}
