// The contract between the counter app and wherever its data lives. Two
// implementations: ./mock (demo data in the browser) and ./dataverse (the
// IBKY Stock Take tables). Pick one with VITE_DATA=mock|dataverse.

import type { Reference } from "../repository";
import type { Issue, RecountTask, SiteCode, StockCategory, VarianceReason } from "../types";
import type { Qty } from "../../shared/count-rules";
import type { Photo } from "../photo";

export interface CountEntry extends Qty {
  /** Made on the phone; the Dataverse alternate key, so a re-sent save updates instead of duplicating. */
  id: string;
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
  /** A new photo of the tag, waiting to be sent with this line. */
  photo?: Photo;
  /** A photo is already stored for this line. */
  hasPhoto?: boolean;
}

export interface StackState {
  state: "submitted" | "approved" | "rejected";
  at: string;
  by?: string;
  comment?: string;
  /** A third-party site reported as having nothing to count (the comment says why). */
  empty?: boolean;
  /** A third-party site the counter finished: every stack there is counted. */
  finished?: boolean;
}

/** The site's marker stack: reported empty, or finished (every stack counted). */
export const EMPTY_STACK = "Whole site";

export interface TpStack {
  name: string;
  note: string;
}

/** Everything the counter app works with after start-up. */
export interface CounterData {
  reference: Reference;
  counts: CountEntry[];
  /** Keyed `${site}|${stack}`. */
  stacks: Record<string, StackState>;
  tpStacks: Record<string, TpStack[]>;
  recounts: RecountTask[];
  recountsDone: string[];
  issues: Issue[];
  /** Set when counting is closed but the app is open anyway (setting CounterAppOpenAfterClose, demos). */
  closedNote?: string;
}

export interface DataSource {
  readonly kind: "mock" | "dataverse";
  /** Loads reference data and this counter's working state. */
  load(me: string): Promise<CounterData>;
  /** Creates or updates a count line (upsert on CountEntry.id). */
  saveCount(entry: CountEntry): Promise<void>;
  submitStack(site: SiteCode, stack: string, comment: string): Promise<void>;
  addTpStack(site: SiteCode, stack: TpStack): Promise<void>;
  /** A third-party site with nothing to count: submitted with the reason, no lines (blind - no figures). */
  reportEmptySite(site: SiteCode, reason: string): Promise<void>;
  /** Every stack at this third-party site is counted: lots XBS expects there and nobody counted are not found. */
  finishSite(site: SiteCode): Promise<void>;
  completeRecount(id: string): Promise<void>;
  addIssue(issue: Issue): Promise<void>;
}
