// Dataverse data source for the counter app — reads and writes the IBKY Stock
// Take tables through the generated Power Apps services. Runs inside the
// Power Apps host (Local Play or the published app), signed in as the counter.
//
// What it reads at start-up:
//   active stock take (status "Count in progress") → its XBS import's lines,
//   my assignment, warehouses, packing types, every count line on this stock
//   take's sheets (teammates' too, for the duplicate prompt), stacks,
//   my recounts and my problem reports.
// What it writes: my count sheet (created on first save), stacks, count lines
// (upsert on the phone-made id), recount completion, problem reports.
// XBS rows are only ever read.

import { getContext } from "@microsoft/power-apps/app";
import type { IOperationResult } from "@microsoft/power-apps/data";
import type { IGetAllOptions } from "../../generated/models/CommonModels";
import { Stk_assignmentsService } from "../../generated/services/Stk_assignmentsService";
import { Stk_countlinesService } from "../../generated/services/Stk_countlinesService";
import { Stk_countsheetsService } from "../../generated/services/Stk_countsheetsService";
import { Stk_issuesService } from "../../generated/services/Stk_issuesService";
import { Stk_packtypesService } from "../../generated/services/Stk_packtypesService";
import { Stk_recountsService } from "../../generated/services/Stk_recountsService";
import { Stk_sitesService } from "../../generated/services/Stk_sitesService";
import { Stk_stacksService } from "../../generated/services/Stk_stacksService";
import { Stk_stocktakesService } from "../../generated/services/Stk_stocktakesService";
import { Stk_xbsimportsService } from "../../generated/services/Stk_xbsimportsService";
import { Stk_xbslinesService } from "../../generated/services/Stk_xbslinesService";
import { SystemusersService } from "../../generated/services/SystemusersService";
import { Stk_countlinesstk_category, Stk_countlinesstk_reason } from "../../generated/models/Stk_countlinesModel";
import { Stk_countsheetsstk_status } from "../../generated/models/Stk_countsheetsModel";
import { Stk_issuesstk_category, Stk_issuesstk_status } from "../../generated/models/Stk_issuesModel";
import { Stk_recountsstk_status } from "../../generated/models/Stk_recountsModel";
import { Stk_stacksstk_status } from "../../generated/models/Stk_stacksModel";
import { Stk_stocktakesstk_status, Stk_stocktakesstk_type } from "../../generated/models/Stk_stocktakesModel";
import type { Reference } from "../repository";
import type { Issue, IssueCategory, PackType, RecountTask, Site, SiteCode, StockCategory, VarianceReason, XbsLine } from "../types";
import type { CountEntry, CounterData, DataSource, StackState, TpStack } from "./types";
import { bags60, kgOf, unitsOf } from "../../shared/count-rules";

/* ---------- helpers ---------- */

type Choice = Record<number, string>;
/** Choice label → option value (throws on a label Dataverse doesn't know). */
function code<T extends Choice>(map: T, label: string): keyof T & number {
  const hit = Object.entries(map).find(([, v]) => v === label);
  if (!hit) throw new Error(`"${label}" isn't an allowed value`);
  return Number(hit[0]) as keyof T & number;
}
const label = (map: Choice, value?: number | null) => (value == null ? undefined : map[value]);

function unwrap<T>(r: IOperationResult<T>, what: string): T {
  if (!r.success) throw new Error(`Couldn't ${what}: ${r.error?.message ?? "unknown error"}`);
  return r.data;
}

/** Reads every page of a query. */
async function all<T>(getAll: (o: IGetAllOptions) => Promise<IOperationResult<T[]>>, opts: IGetAllOptions, what: string): Promise<T[]> {
  const out: T[] = [];
  let skipToken: string | undefined;
  do {
    const r = await getAll({ ...opts, maxPageSize: 500, skipToken });
    out.push(...unwrap(r, what));
    skipToken = r.skipToken;
  } while (skipToken);
  return out;
}

const orFilter = (field: string, ids: string[]) => (ids.length ? ids.map((id) => `${field} eq ${id}`).join(" or ") : `${field} eq null`);
const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
const hhmm = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const day = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";
const bind = (set: string, id: string) => `/${set}(${id})`;

/* ---------- session state (ids resolved at load, reused for writes) ---------- */

const s = {
  me: "",
  myName: "",
  stockTakeId: "",
  assignmentId: "",
  assignedSiteId: "",
  sheetId: "" as string | undefined,
  siteId: new Map<SiteCode, string>(),
  siteCode: new Map<string, SiteCode>(),
  packId: new Map<string, string>(),
  packCode: new Map<string, string>(),
  /** `${site}|${stack}` → stk_stack id */
  stackId: new Map<string, string>(),
  stackKey: new Map<string, { site: SiteCode; name: string }>(),
  /** XBS line id per lot: `${site}|${zone}|${batch}` (zone empty at third parties), and per batch as a fallback. */
  lotLine: new Map<string, string>(),
  batchLine: new Map<string, string>(),
  recountId: new Map<string, string>(),
  countLineId: new Map<string, string>(),
  thirdParty: new Set<SiteCode>(),
};

const lotKey = (site: SiteCode, zone: string | undefined, batch: string) => `${site}|${s.thirdParty.has(site) ? "" : (zone ?? "")}|${batch}`;

async function names(ids: (string | undefined)[]) {
  const want = [...new Set(ids.filter(Boolean) as string[])];
  const map = new Map<string, string>();
  for (let i = 0; i < want.length; i += 20) {
    const chunk = want.slice(i, i + 20);
    const users = await all((o) => SystemusersService.getAll(o), { select: ["systemuserid", "fullname"], filter: orFilter("systemuserid", chunk) }, "read user names");
    for (const u of users) map.set(u.systemuserid, u.fullname ?? "Someone");
  }
  return map;
}

/* ---------- load ---------- */

async function load(): Promise<CounterData> {
  const ctx = await getContext();
  s.me = ctx.user.systemUserId ?? "";
  if (!s.me) throw new Error("Power Apps didn't say who's signed in. Open the app from Power Apps (Local Play or the published app).");

  const live = code(Stk_stocktakesstk_status, "Count in progress");
  const [stockTake] = await all(
    (o) => Stk_stocktakesService.getAll(o),
    { select: ["stk_stocktakeid", "stk_name", "stk_type", "stk_countdate", "_stk_import_value"], filter: `stk_status eq ${live}`, orderBy: ["stk_countdate desc"], top: 1 },
    "find the stock take",
  );
  if (!stockTake) throw new Error("There's no stock take in progress. Ask Operations to start one.");
  s.stockTakeId = stockTake.stk_stocktakeid;

  const [assignment] = await all(
    (o) => Stk_assignmentsService.getAll(o),
    { select: ["stk_assignmentid", "stk_name", "stk_rows", "_stk_site_value"], filter: `_stk_stocktake_value eq ${s.stockTakeId} and _stk_counter_value eq ${s.me}`, top: 1 },
    "find your assignment",
  );
  if (!assignment) throw new Error(`You're not assigned to "${stockTake.stk_name}" yet. Ask Operations to assign you an area.`);
  s.assignmentId = assignment.stk_assignmentid;
  s.assignedSiteId = assignment._stk_site_value!;

  const [siteRows, packRows, importRow] = await Promise.all([
    all((o) => Stk_sitesService.getAll(o), { select: ["stk_siteid", "stk_code", "stk_name", "stk_shortname", "stk_isthirdparty", "stk_manualentry"], orderBy: ["stk_isthirdparty asc", "stk_name asc"] }, "read warehouses"),
    all((o) => Stk_packtypesService.getAll(o), { select: ["stk_packtypeid", "stk_code", "stk_name", "stk_kgperbag", "stk_gradepattern"] }, "read packing types"),
    Stk_xbsimportsService.get(stockTake._stk_import_value!, { select: ["stk_name", "stk_snapshotat"] }).then((r) => unwrap(r, "read the XBS import")),
  ]);

  const sites: Site[] = siteRows.map((r) => ({
    code: r.stk_code as SiteCode,
    name: r.stk_name,
    short: r.stk_shortname ?? r.stk_name,
    thirdParty: !!r.stk_isthirdparty,
    manualEntry: !!r.stk_manualentry,
  }));
  for (const r of siteRows) {
    s.siteId.set(r.stk_code as SiteCode, r.stk_siteid);
    s.siteCode.set(r.stk_siteid, r.stk_code as SiteCode);
    if (r.stk_isthirdparty) s.thirdParty.add(r.stk_code as SiteCode);
  }
  // Standard pack last, so the grade rule falls back to it.
  const packTypes: PackType[] = packRows
    .sort((a, b) => Number(!!b.stk_gradepattern) - Number(!!a.stk_gradepattern))
    .map((p) => ({
      id: p.stk_code ?? p.stk_name,
      label: p.stk_name,
      kg: Number(p.stk_kgperbag ?? 60),
      hint: p.stk_gradepattern ? `Default for ${p.stk_gradepattern.toLowerCase()} grades` : "Standard coffee",
      gradePattern: p.stk_gradepattern ?? undefined,
    }));
  for (const p of packRows) {
    s.packId.set(p.stk_code ?? p.stk_name, p.stk_packtypeid);
    s.packCode.set(p.stk_packtypeid, p.stk_code ?? p.stk_name);
  }

  const xbs = await all(
    (o) => Stk_xbslinesService.getAll(o),
    {
      select: [
        "stk_xbslineid", "stk_name", "stk_stocktype", "_stk_site_value", "stk_zone", "stk_outturn", "stk_grade", "stk_basketcode", "stk_basketname",
        "stk_bags", "stk_pocketkg", "stk_units", "stk_kg", "stk_growermark", "stk_warrant", "stk_certification", "stk_cupscore", "stk_blocked",
        "stk_salescontract", "stk_instruction", "stk_daysinstock", "stk_cropyear", "stk_rownumber",
      ],
      filter: `_stk_import_value eq ${stockTake._stk_import_value}`,
      orderBy: ["stk_rownumber asc"],
    },
    "read the XBS stock",
  );
  const lines: XbsLine[] = xbs.map((r) => ({
    t: r.stk_stocktype === 614500001 ? "B" : "W",
    wh: s.siteCode.get(r._stk_site_value!)!,
    z: r.stk_zone ?? undefined,
    b: r.stk_name,
    o: r.stk_outturn ?? "",
    i: r.stk_grade ?? "",
    bc: r.stk_basketcode ?? undefined,
    bn: r.stk_basketname ?? undefined,
    bg: r.stk_bags ?? 0,
    pk: Number(r.stk_pocketkg ?? 0),
    u: r.stk_units ?? 0,
    kg: Number(r.stk_kg ?? 0),
    g: r.stk_growermark ?? undefined,
    wr: r.stk_warrant ?? undefined,
    c: r.stk_certification ?? undefined,
    cs: r.stk_cupscore ?? undefined,
    bl: !!r.stk_blocked,
    so: r.stk_salescontract ?? undefined,
    in: r.stk_instruction ?? undefined,
    d: r.stk_daysinstock ?? undefined,
    cy: r.stk_cropyear ?? undefined,
  }));
  xbs.forEach((r, i) => {
    const l = lines[i];
    const k = lotKey(l.wh, l.z, l.b);
    if (!s.lotLine.has(k)) s.lotLine.set(k, r.stk_xbslineid);
    if (!s.batchLine.has(l.b)) s.batchLine.set(l.b, r.stk_xbslineid);
  });

  const assignedSite = s.siteCode.get(assignment._stk_site_value!) ?? "IBR";
  const rows = (assignment.stk_rows ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const reference: Reference = {
    stockTake: {
      id: s.stockTakeId,
      title: stockTake.stk_name,
      type: label(Stk_stocktakesstk_type, stockTake.stk_type) === "100% (zero-out)" ? "100% stock take" : "Monthly stock take",
      countDate: day(stockTake.stk_countdate),
      snapshot: `XBS stock imported ${day(importRow.stk_snapshotat)}, ${hhmm(importRow.stk_snapshotat)}`,
      sites: sites.map((x) => x.code),
    },
    sites,
    packTypes,
    lines,
    assignment: {
      site: assignedSite,
      rows,
      label: `${sites.find((x) => x.code === assignedSite)?.short ?? assignedSite} ${rows.length ? `rows ${rows.join(" and ")}` : "whole site"}`,
    },
  };

  /* working state */
  const sheets = await all(
    (o) => Stk_countsheetsService.getAll(o),
    { select: ["stk_countsheetid", "_stk_assignment_value", "_createdby_value"], filter: `_stk_stocktake_value eq ${s.stockTakeId}` },
    "read count sheets",
  );
  s.sheetId = sheets.find((x) => x._stk_assignment_value === s.assignmentId && x._createdby_value === s.me)?.stk_countsheetid;

  const stacks = await all(
    (o) => Stk_stacksService.getAll(o),
    { select: ["stk_stackid", "stk_name", "_stk_site_value", "stk_status", "stk_landmark", "stk_submittedon", "stk_comment", "_stk_submittedby_value"], filter: `_stk_stocktake_value eq ${s.stockTakeId}` },
    "read stacks",
  );
  for (const st of stacks) {
    const site = s.siteCode.get(st._stk_site_value!)!;
    s.stackId.set(`${site}|${st.stk_name}`, st.stk_stackid);
    s.stackKey.set(st.stk_stackid, { site, name: st.stk_name });
  }

  const countRows = sheets.length
    ? (
        await Promise.all(
          chunks(sheets.map((x) => x.stk_countsheetid), 15).map((ids) =>
            all(
              (o) => Stk_countlinesService.getAll(o),
              {
                select: [
                  "stk_countlineid", "stk_clientid", "_stk_site_value", "_stk_stack_value", "stk_batch", "stk_outturn", "stk_grade", "stk_category",
                  "_stk_packtype_value", "stk_bags", "stk_pocketbags", "stk_pocketkg", "stk_reason", "stk_note", "stk_isfound", "stk_isother",
                  "stk_reference", "_stk_recount_value", "stk_countedon", "_createdby_value",
                ],
                filter: orFilter("_stk_countsheet_value", ids),
              },
              "read counts",
            ),
          ),
        )
      ).flat()
    : [];

  const recountRows = await all(
    (o) => Stk_recountsService.getAll(o),
    { select: ["stk_recountid", "stk_name", "_stk_stack_value", "stk_outturn", "stk_batch", "stk_why", "stk_status", "createdon", "_createdby_value"], filter: `_stk_stocktake_value eq ${s.stockTakeId} and _ownerid_value eq ${s.me}` },
    "read your recounts",
  );
  for (const r of recountRows) s.recountId.set(r.stk_name, r.stk_recountid);

  const issueRows = await all(
    (o) => Stk_issuesService.getAll(o),
    { select: ["stk_issueid", "stk_name", "stk_category", "_stk_site_value", "stk_screen", "stk_description", "stk_status", "stk_resolution", "createdon"], filter: `_createdby_value eq ${s.me}`, orderBy: ["createdon desc"] },
    "read your problem reports",
  );

  const who = await names([s.me, ...countRows.map((c) => c._createdby_value), ...stacks.map((x) => x._stk_submittedby_value), ...recountRows.map((r) => r._createdby_value)]);
  s.myName = who.get(s.me) ?? ctx.user.fullName ?? "You";

  const counts: CountEntry[] = countRows.map((c) => {
    const where = s.stackKey.get(c._stk_stack_value!);
    s.countLineId.set(c.stk_clientid ?? c.stk_countlineid, c.stk_countlineid);
    const recountName = [...s.recountId.entries()].find(([, id]) => id === c._stk_recount_value)?.[0];
    return {
      id: c.stk_clientid ?? c.stk_countlineid,
      site: where?.site ?? s.siteCode.get(c._stk_site_value!)!,
      stack: where?.name ?? "",
      batch: c.stk_batch ?? "",
      outturn: c.stk_outturn ?? "",
      grade: c.stk_grade ?? "",
      category: (label(Stk_countlinesstk_category, c.stk_category) ?? "Current stock") as StockCategory,
      pack: s.packCode.get(c._stk_packtype_value!) ?? packTypes[packTypes.length - 1].id,
      bags: c.stk_bags ?? 0,
      pocketBags: c.stk_pocketbags ?? 0,
      pocketKg: Number(c.stk_pocketkg ?? 0),
      reason: label(Stk_countlinesstk_reason, c.stk_reason) as VarianceReason | undefined,
      note: c.stk_note ?? undefined,
      by: c._createdby_value === s.me ? s.myName : (who.get(c._createdby_value!) ?? "A teammate"),
      at: hhmm(c.stk_countedon),
      synced: true,
      found: c.stk_isfound || undefined,
      other: c.stk_isother || undefined,
      reference: c.stk_reference ?? undefined,
      recount: recountName,
    };
  });

  const stackStates: Record<string, StackState> = {};
  const tpStacks: Record<string, TpStack[]> = {};
  const stateOf: Record<string, StackState["state"]> = { Submitted: "submitted", Approved: "approved", "Sent back": "rejected" };
  for (const st of stacks) {
    const site = s.siteCode.get(st._stk_site_value!)!;
    const state = stateOf[label(Stk_stacksstk_status, st.stk_status) ?? ""];
    if (state) stackStates[`${site}|${st.stk_name}`] = { state, at: hhmm(st.stk_submittedon), by: who.get(st._stk_submittedby_value!), comment: st.stk_comment ?? undefined };
    if (s.thirdParty.has(site)) (tpStacks[site] ??= []).push({ name: st.stk_name, note: st.stk_landmark ?? "" });
  }

  const recounts: RecountTask[] = recountRows.map((r) => {
    const where = s.stackKey.get(r._stk_stack_value!);
    return {
      id: r.stk_name,
      site: where?.site ?? assignedSite,
      stack: where?.name ?? "",
      batch: r.stk_batch ?? "",
      outturn: r.stk_outturn ?? "",
      askedBy: who.get(r._createdby_value!) ?? "Your supervisor",
      at: hhmm(r.createdon),
      why: r.stk_why ?? "",
    };
  });
  const done = code(Stk_recountsstk_status, "Done");

  const issues: Issue[] = issueRows.map((i) => ({
    id: i.stk_name,
    category: (label(Stk_issuesstk_category, i.stk_category) ?? "Other") as IssueCategory,
    site: s.siteCode.get(i._stk_site_value!) ?? assignedSite,
    screen: i.stk_screen ?? "",
    text: i.stk_description ?? "",
    by: s.myName,
    at: `${day(i.createdon)}, ${hhmm(i.createdon)}`,
    status: (label(Stk_issuesstk_status, i.stk_status) ?? "Open") as Issue["status"],
    resolution: i.stk_resolution ?? undefined,
  }));

  return {
    reference,
    counts,
    stacks: stackStates,
    tpStacks,
    recounts,
    recountsDone: recountRows.filter((r) => r.stk_status === done).map((r) => r.stk_name),
    issues,
  };
}

function chunks<T>(xs: T[], n: number) {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/* ---------- writes ---------- */

/** My count sheet for this stock take — created on first use. */
async function ensureSheet(): Promise<string> {
  if (s.sheetId) return s.sheetId;
  const created = await Stk_countsheetsService.create({
    stk_name: `CS-${Date.now().toString(36).toUpperCase()}`,
    statecode: 0,
    stk_status: code(Stk_countsheetsstk_status, "In progress"),
    "stk_stocktake@odata.bind": bind("stk_stocktakes", s.stockTakeId),
    "stk_assignment@odata.bind": bind("stk_assignments", s.assignmentId),
    "stk_site@odata.bind": bind("stk_sites", s.assignedSiteId),
  } as never);
  s.sheetId = unwrap(created, "start your count sheet").stk_countsheetid;
  return s.sheetId;
}

/** The stack row for a site + stack name — created on first use. */
async function ensureStack(site: SiteCode, name: string, landmark?: string): Promise<string> {
  const k = `${site}|${name}`;
  const known = s.stackId.get(k);
  if (known) return known;
  const sheet = await ensureSheet();
  const created = await Stk_stacksService.create({
    stk_name: name,
    statecode: 0,
    stk_status: code(Stk_stacksstk_status, "In progress"),
    stk_landmark: landmark,
    "stk_stocktake@odata.bind": bind("stk_stocktakes", s.stockTakeId),
    "stk_site@odata.bind": bind("stk_sites", s.siteId.get(site)!),
    "stk_countsheet@odata.bind": bind("stk_countsheets", sheet),
  } as never);
  const id = unwrap(created, `record stack ${name}`).stk_stackid;
  s.stackId.set(k, id);
  s.stackKey.set(id, { site, name });
  return id;
}

async function saveCount(e: CountEntry) {
  const sheet = await ensureSheet();
  const stack = await ensureStack(e.site, e.stack);
  const xbsLine = e.other ? undefined : (s.lotLine.get(lotKey(e.site, e.stack, e.batch)) ?? s.batchLine.get(e.batch));
  const pack = s.packId.get(e.pack);
  if (!pack) throw new Error(`Unknown packing type ${e.pack}`);
  const fields = {
    stk_name: `${e.other ? e.category : e.outturn} @ ${e.stack}`.slice(0, 60),
    stk_clientid: e.id,
    stk_outturn: e.other ? undefined : e.outturn,
    stk_batch: e.other ? undefined : e.batch,
    stk_grade: e.grade,
    stk_category: code(Stk_countlinesstk_category, e.category),
    stk_bags: e.bags,
    stk_pocketbags: e.pocketBags,
    stk_pocketkg: e.pocketKg,
    stk_units: unitsOf(e),
    stk_reason: e.reason ? code(Stk_countlinesstk_reason, e.reason) : null,
    stk_note: e.note ?? null,
    stk_isfound: !!e.found,
    stk_isother: !!e.other,
    stk_isblind: !!e.recount,
    stk_reference: e.reference ?? null,
    stk_countedon: new Date().toISOString(),
    "stk_countsheet@odata.bind": bind("stk_countsheets", sheet),
    "stk_stack@odata.bind": bind("stk_stacks", stack),
    "stk_site@odata.bind": bind("stk_sites", s.siteId.get(e.site)!),
    "stk_packtype@odata.bind": bind("stk_packtypes", pack),
    ...(xbsLine ? { "stk_xbsline@odata.bind": bind("stk_xbslines", xbsLine) } : {}),
    ...(e.recount && s.recountId.get(e.recount) ? { "stk_recount@odata.bind": bind("stk_recounts", s.recountId.get(e.recount)!) } : {}),
  };
  Object.assign(fields, kgFields(e));

  let id = s.countLineId.get(e.id);
  if (!id) {
    // A re-send after a lost reply: the line may already exist under this client id.
    const [existing] = await all((o) => Stk_countlinesService.getAll(o), { select: ["stk_countlineid"], filter: `stk_clientid eq ${quote(e.id)}`, top: 1 }, "check the count");
    id = existing?.stk_countlineid;
  }
  if (id) unwrap(await Stk_countlinesService.update(id, fields as never), `update ${e.outturn}`);
  else {
    const created = unwrap(await Stk_countlinesService.create({ ...fields, statecode: 0 } as never), `save ${e.outturn}`);
    s.countLineId.set(e.id, created.stk_countlineid);
  }
}

/** kg / 60 kg equivalents for a count — the shared count rules, with pack sizes loaded at start-up. */
let packKg = new Map<string, number>();
function kgFields(e: CountEntry) {
  const kg = kgOf(e, packKg.get(e.pack) ?? 60);
  return { stk_kg: Math.round(kg * 100) / 100, stk_bags60: Math.round(bags60(kg) * 100) / 100 };
}

async function submitStack(site: SiteCode, stack: string, comment: string) {
  const id = await ensureStack(site, stack);
  unwrap(
    await Stk_stacksService.update(id, {
      stk_status: code(Stk_stacksstk_status, "Submitted"),
      stk_submittedon: new Date().toISOString(),
      stk_comment: comment || null,
      "stk_submittedby@odata.bind": bind("systemusers", s.me),
    } as never),
    `submit ${stack}`,
  );
  // The sheet is what the supervisor approves: mark it submitted with fresh totals.
  const sheet = await ensureSheet();
  const lines = await all((o) => Stk_countlinesService.getAll(o), { select: ["stk_bags"], filter: `_stk_countsheet_value eq ${sheet}` }, "total your sheet");
  unwrap(
    await Stk_countsheetsService.update(sheet, {
      stk_status: code(Stk_countsheetsstk_status, "Submitted"),
      stk_submittedon: new Date().toISOString(),
      stk_linecount: lines.length,
      stk_bags: lines.reduce((a, l) => a + (l.stk_bags ?? 0), 0),
      ...(comment ? { stk_countercomment: comment } : {}),
    } as never),
    "submit your sheet",
  );
}

async function addTpStack(site: SiteCode, st: TpStack) {
  await ensureStack(site, st.name, st.note || undefined);
}

async function completeRecount(name: string) {
  const id = s.recountId.get(name);
  if (!id) throw new Error(`Recount ${name} not found`);
  unwrap(await Stk_recountsService.update(id, { stk_status: code(Stk_recountsstk_status, "Done") } as never), `complete ${name}`);
}

async function addIssue(i: Issue) {
  unwrap(
    await Stk_issuesService.create({
      stk_name: i.id,
      statecode: 0,
      stk_category: code(Stk_issuesstk_category, i.category),
      stk_screen: i.screen,
      stk_description: i.text,
      stk_status: code(Stk_issuesstk_status, "Open"),
      "stk_site@odata.bind": bind("stk_sites", s.siteId.get(i.site)!),
    } as never),
    "send your report",
  );
}

/** One load at a time (React's development double-mount, quick reloads). */
let loading: Promise<CounterData> | undefined;

export const dataverseSource: DataSource = {
  kind: "dataverse",
  load() {
    return (loading ??= load()
      .then((data) => {
        packKg = new Map(data.reference.packTypes.map((p) => [p.id, p.kg]));
        return data;
      })
      .finally(() => (loading = undefined)));
  },
  saveCount,
  submitStack,
  addTpStack,
  completeRecount,
  addIssue,
};
