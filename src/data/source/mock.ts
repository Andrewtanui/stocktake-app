// Demo data source: the real XBS snapshot of 2 Mar 2026 plus a scripted
// mid-morning state (rows D bays 1–4 counted, D-04-3 sent back, a teammate
// part-way through D-05-1). Writes are accepted and kept in memory only.

import raw from "../xbs-2026-03-02.json";
import { defaultPack, expectedLots, parseZone, setReference, zonesInRows, type Reference } from "../repository";
import type { Issue, RecountTask, XbsLine } from "../types";
import type { CountEntry, CounterData, DataSource, StackState } from "./types";

const REFERENCE: Reference = {
  stockTake: {
    id: "ST-2026-03",
    title: "Monthly Stock Take - 02/03/2026",
    type: "Monthly stock take",
    countDate: "Mon 2 Mar 2026",
    snapshot: "XBS stock imported 2 Mar 2026, 08:52",
    sites: ["IBR", "AGL", "KPCU", "MAXA", "MCF", "KCCE"],
  },
  sites: [
    { code: "IBR", name: "Ibero Export Warehouse", short: "Ibero", thirdParty: false, manualEntry: true },
    { code: "AGL", name: "AGL", short: "AGL", thirdParty: true, manualEntry: false },
    { code: "KPCU", name: "New KPCU", short: "New KPCU", thirdParty: true, manualEntry: false },
    { code: "MAXA", name: "Maxa Africa Logistics", short: "Maxa", thirdParty: true, manualEntry: false },
    { code: "MCF", name: "Mitchel Cotts Freight", short: "Mitchel Cotts", thirdParty: true, manualEntry: false },
    { code: "KCCE", name: "Kenya Co-op Coffee Exporters", short: "KCCE", thirdParty: true, manualEntry: false },
  ],
  packTypes: [
    { id: "JUTE60", label: "60 kg jute bag", kg: 60, hint: "Standard coffee" },
    { id: "JUTE50", label: "50 kg jute bag", kg: 50, hint: "Light coffee fills a bag at 50 kg", gradePattern: "LIGHT" },
  ],
  lines: raw as XbsLine[],
  // As the Hub's allocation publishes it: rows D and E plus the stacks between them;
  // stacks between C and D or E and F belong to other counters. Plus a third-party site.
  assignments: [
    { site: "IBR", rows: ["D", "E"], sections: ["D", "E", "D/E"], label: "Ibero rows D and E, between D and E" },
    { site: "AGL", rows: [], sections: [], label: "AGL whole site" },
  ],
};

const TEAMMATE = "Brian K.";
const SUPERVISOR = "Peter M. (Supervisor)";
const DEMO = {
  submittedBays: 4,
  approvedUpTo: 3,
  rejected: { stack: "D-04-3", at: "10:58", comment: "16EC0009 is 2 units short and XBS also has it at KCCE. Please recount." },
  short: { stack: "D-04-3", batch: "2025/2026-18-6517-KINJO/XBB.004F02" },
  /** Brian K. already counted this lot here: opening it shows the duplicate-count prompt. */
  teammateCount: { stack: "D-05-1", batch: "KCS7342-CLEAN 1", bags: 51, pocketBags: 1, pocketKg: 20, at: "10:52" },
};

const RECOUNTS: RecountTask[] = [
  {
    id: "R-031",
    site: "IBR",
    stack: "D-04-3",
    batch: "2025/2026-18-6517-KINJO/XBB.004F02",
    outturn: "16EC0009",
    askedBy: SUPERVISOR,
    at: DEMO.rejected.at,
    why: "2 units short. XBS also has 12 units of this outturn at KCCE, so check for bags from another lot on this stack.",
  },
  {
    id: "R-032",
    site: "IBR",
    stack: "D-09-1",
    batch: "KCS7222-CLEAN 1",
    outturn: "KCS7222",
    askedBy: SUPERVISOR,
    at: "11:21",
    why: "Brian K.'s count didn't match XBS. Count every bag again from the bottom tier up.",
  },
];

const issues = (me: string): Issue[] => [
  {
    id: "C-118",
    category: "Network or saving",
    site: "IBR",
    screen: "Count a lot",
    text: "No signal at the back of row G. Counts stayed on the phone for 20 minutes.",
    by: me,
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
    by: me,
    at: "Mon 2 Feb, 10:40",
    status: "Resolved",
    resolution: "AGL re-tagged Site 2 stacks. Faded tags now go in as a variance reason.",
  },
];

/** The scripted mid-morning state, built from the real XBS lots. Needs setReference() first. */
function seed(me: string) {
  const counts: CountEntry[] = [];
  const stacks: Record<string, StackState> = {};
  let minute = 7 * 60 + 10;
  let n = 0;
  const stamp = () => {
    minute += 3;
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  };
  for (const z of zonesInRows(["D"])) {
    const p = parseZone(z)!;
    if (p.bay > DEMO.submittedBays) continue;
    for (const lot of expectedLots("IBR", z)) {
      const short = z === DEMO.short.stack && lot.batch === DEMO.short.batch;
      counts.push({
        id: `demo-${++n}`,
        site: "IBR",
        stack: z,
        batch: lot.batch,
        outturn: lot.head.o,
        grade: lot.head.i,
        category: lot.parts.some((x) => x.t === "B") ? "Processing stock" : "Current stock",
        pack: defaultPack(lot.head.i),
        bags: short ? lot.bags - 2 : lot.bags,
        pocketBags: lot.pockets > 0 ? 1 : 0,
        pocketKg: Math.round(lot.pockets * 10) / 10,
        reason: short ? "Not sure, supervisor to check" : undefined,
        by: me,
        at: stamp(),
        synced: true,
      });
    }
    stacks[`IBR|${z}`] =
      z === DEMO.rejected.stack
        ? { state: "rejected", at: DEMO.rejected.at, by: SUPERVISOR, comment: DEMO.rejected.comment }
        : p.bay <= DEMO.approvedUpTo
          ? { state: "approved", at: "10:30", by: SUPERVISOR }
          : { state: "submitted", at: stamp() };
  }
  const t = DEMO.teammateCount;
  const lot = expectedLots("IBR", t.stack).find((l) => l.batch === t.batch)!;
  counts.push({
    id: `demo-${++n}`,
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

const ok = () => Promise.resolve();

export const mockSource: DataSource = {
  kind: "mock",
  async load(me): Promise<CounterData> {
    setReference(REFERENCE);
    const { counts, stacks } = seed(me);
    return {
      reference: REFERENCE,
      counts,
      stacks,
      tpStacks: {
        AGL: [
          { name: "Site 1 · Stack 1", note: "Left of gate, under the AGL banner" },
          { name: "Site 2 · Stack 1", note: "North wall, 3 tiers" },
        ],
      },
      recounts: RECOUNTS,
      recountsDone: [],
      issues: issues(me),
    };
  },
  saveCount: ok,
  submitStack: ok,
  addTpStack: ok,
  completeRecount: ok,
  addIssue: ok,
};
