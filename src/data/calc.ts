// Count arithmetic, kept in one place so every screen (and later XBS) agrees.
//   units  = full bags + pocket bags            (bag objects on the stack)
//   weight = full bags × pack kg + pocket kg
//   60 kg bag equivalents = weight ÷ 60          (what Finance compares)

import { pack } from "./repository";
import type { PackType } from "./types";

export interface Qty {
  pack: PackType["id"];
  bags: number;
  pocketBags: number;
  pocketKg: number;
}

export const unitsOf = (q: Qty) => q.bags + q.pocketBags;
export const kgOf = (q: Qty) => q.bags * pack(q.pack).kg + q.pocketKg;
export const bags60 = (kg: number) => kg / 60;

/** A pocket is a part-filled bag, so each must weigh less than a full one. */
export function pocketProblem(q: Qty): string | null {
  const full = pack(q.pack).kg;
  if (q.pocketKg > 0 && q.pocketBags === 0) return "You entered pocket weight but no pocket bags. Add the number of pocket bags.";
  if (q.pocketBags > 0 && q.pocketKg === 0) return "Pocket bags need a weight. Weigh them and enter the total kg.";
  if (q.pocketBags > 0 && q.pocketKg >= q.pocketBags * full)
    return `Pockets must weigh less than ${full} kg each. If a pocket is full, count it as a full bag.`;
  return null;
}

export interface Compare {
  dUnits: number;
  dKg: number;
  match: boolean;
  tone: "ok" | "warn" | "crit";
  headline: string;
  detail: string;
}

/** Plain-language comparison with what XBS expects. */
export function compare(q: Qty, expected: { units: number; kg: number }): Compare {
  const units = unitsOf(q);
  const kg = kgOf(q);
  const dUnits = units - expected.units;
  const dKg = Math.round((kg - expected.kg) * 10) / 10;
  const kgTxt = (x: number) => `${Math.abs(x).toLocaleString("en-GB", { maximumFractionDigits: 1 })} kg`;
  const bagWord = (x: number) => `${Math.abs(x)} bag${Math.abs(x) === 1 ? "" : "s"}`;

  if (dUnits === 0 && Math.abs(dKg) < 0.05)
    return { dUnits, dKg, match: true, tone: "ok", headline: "Matches XBS", detail: `${units} units and ${kgTxt(kg)}, same as XBS.` };
  if (dUnits === 0)
    return {
      dUnits,
      dKg,
      match: false,
      tone: "warn",
      headline: `Bags match, weight is ${kgTxt(dKg)} ${dKg > 0 ? "over" : "under"}`,
      detail: "The number of bags is right but the weight differs. Check the pocket weight, or the packing type.",
    };
  if (dUnits < 0)
    return {
      dUnits,
      dKg,
      match: false,
      tone: "crit",
      headline: `${bagWord(dUnits)} fewer than XBS`,
      detail: `You counted ${units}; XBS expects ${expected.units}. Look behind and under the stack, then choose a reason.`,
    };
  return {
    dUnits,
    dKg,
    match: false,
    tone: "crit",
    headline: `${bagWord(dUnits)} more than XBS`,
    detail: `You counted ${units}; XBS expects ${expected.units}. Check for bags from another lot, then choose a reason.`,
  };
}
