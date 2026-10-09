// Screen-facing count arithmetic: the shared rules (src/shared/count-rules.ts)
// bound to this app's packing types, so screens can pass a Qty alone.

import * as rules from "../shared/count-rules";
import { pack } from "./repository";

export type { Compare } from "../shared/count-rules";
export type Qty = rules.Qty;

export const unitsOf = rules.unitsOf;
export const bags60 = rules.bags60;
export const kgOf = (q: Qty) => rules.kgOf(q, pack(q.pack).kg);
export const pocketProblem = (q: Qty) => rules.pocketProblem(q, pack(q.pack).kg);
export const compare = (q: Qty, expected: { units: number; kg: number }) => rules.compare(q, pack(q.pack).kg, expected);
