// Shapes the UI works with. The mock repository fills them from the 2 Mar 2026
// XBS snapshot; in the real app the same shapes come from Dataverse tables and
// the XBS/Comtras extracts (see README, "Wiring real data").

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
  thirdParty: boolean;
}

export type ZoneStatus = "todo" | "active" | "done" | "variance";

export interface ZoneCell {
  row: string; // A–G
  bay: number; // 1–14
  zones: string[];
  status: ZoneStatus;
  bags: number;
}

export type LineStatus = "todo" | "match" | "variance" | "recount";

export type RootCause =
  | "Duplicate entry"
  | "Unposted gate-out"
  | "Unposted delivery"
  | "Outturn mismatch"
  | "Part lot"
  | "Cancelled contract"
  | "Not yet known";

export interface Variance {
  id: string;
  site: SiteCode;
  zone: string;
  outturn: string;
  grade: string;
  expected: number; // units
  counted: number; // units
  cause: RootCause;
  why: string; // the evidence the suggestion is based on
  counter: string;
  at: string; // time submitted
  state: "open" | "recount" | "accepted" | "ticket";
  ageHours: number;
}

export interface Check {
  id: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
  owner: string;
  count: number;
  bags: number;
  unit: string;
  rows: { ref: string; where: string; info: string; bags: number }[];
}

export interface Counter {
  name: string;
  site: SiteCode;
  area: string;
  bagsSoFar: number;
  startedAt: number; // hour
  recounts: number;
}
