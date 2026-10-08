import { useState } from "react";
import { Camera, ChevronDown, CircleAlert, CircleCheck, EyeOff, PackageSearch, Shuffle, TriangleAlert, Users } from "lucide-react";
import { useNav } from "../App";
import { bags60, compare, kgOf, pocketProblem, unitsOf, type Qty } from "../data/calc";
import {
  CATEGORIES,
  PACK_TYPES,
  RECOUNTS,
  REASONS,
  allLines,
  defaultPack,
  elsewhere,
  expectedLots,
  groupByBatch,
  pack,
  site,
  type Lot,
} from "../data/repository";
import { useStore } from "../data/store";
import type { SiteCode, StockCategory, VarianceReason } from "../data/types";
import { BagTiers, Chip, PageHead, Stepper, n } from "../ui/kit";

const GRADES = ["AA", "AB", "PB", "C", "E", "TT", "T", "MH", "ML", "UG1", "CLEAN 1", "BULK", "LIGHTS"];

export default function CountLot({ site: code, stack, batch, recount }: { site: SiteCode; stack: string; batch: string; recount?: string }) {
  const go = useNav();
  const store = useStore();
  const s = site(code);
  const task = recount ? RECOUNTS.find((r) => r.id === recount) : undefined;

  // Which lot is this? Expected here, found here but expected elsewhere, or not in XBS at all.
  const here = expectedLots(code, stack);
  const expected = here.find((l) => l.batch === batch);
  const unknown = batch.startsWith("FOUND:") ? batch.slice(6) : null;
  const foundLot: Lot | undefined = expected || unknown ? undefined : groupByBatch(allLines().filter((l) => l.b === batch))[0];
  const lot = expected ?? foundLot;
  const outturn = unknown ?? lot!.head.o;
  const isFound = !expected;

  const mine = store.entry(code, stack, batch);
  const theirs = store.entriesAt(code, stack).find((e) => e.batch === batch && e.by !== store.me);
  const countedElsewhere = store.otherCounts(outturn, code, stack);
  const xbsElsewhere = lot ? elsewhere(lot.head).filter((x) => !(x.wh === code && (code !== "IBR" || x.z === stack))) : [];

  const [grade, setGrade] = useState(mine?.grade ?? lot?.head.i ?? "AA");
  const [q, setQ] = useState<Qty>(
    mine && !task
      ? { pack: mine.pack, bags: mine.bags, pocketBags: mine.pocketBags, pocketKg: mine.pocketKg }
      : { pack: defaultPack(lot?.head.i ?? grade), bags: 0, pocketBags: 0, pocketKg: 0 },
  );
  const [touched, setTouched] = useState(!!mine && !task);
  const [category, setCategory] = useState<StockCategory>(
    mine?.category ?? (lot?.parts.some((p) => p.t === "B") ? "Processing stock" : "Current stock"),
  );
  const [reason, setReason] = useState<VarianceReason | undefined>(mine?.reason ?? (isFound ? "Bags moved here, not yet received in XBS" : undefined));
  const [note, setNote] = useState(mine?.note ?? "");
  const [showXbs, setShowXbs] = useState(false);

  const set = (patch: Partial<Qty>) => {
    setQ((x) => ({ ...x, ...patch }));
    setTouched(true);
  };
  const units = unitsOf(q);
  const kg = kgOf(q);
  const problem = pocketProblem(q);
  const exp = expected ? { units: expected.units, kg: expected.kg } : { units: 0, kg: 0 };
  const result = compare(q, exp);
  const blind = !!task;
  const needsReason = !blind && touched && !isFound && !result.match;
  const canSave = touched && !problem && (!needsReason || !!reason);
  const nextLot = !s.thirdParty
    ? here.find((l) => l.batch !== batch && !store.entriesAt(code, stack).some((e) => e.batch === l.batch))
    : undefined;
  const xbsPackKg = lot && lot.bags ? Math.round((lot.kg - lot.pockets) / lot.bags) : 60;

  const save = (next?: boolean) => {
    store.saveCount({
      site: code,
      stack,
      batch,
      outturn,
      grade,
      category,
      ...q,
      reason: !blind && !result.match ? reason : undefined,
      note: note.trim() || undefined,
      found: isFound || undefined,
      recount,
    });
    if (task) go({ tab: "recounts" });
    else if (next && nextLot) go({ tab: "count", view: "lot", site: code, stack, batch: nextLot.batch });
    else go({ tab: "count", view: "stack", site: code, stack });
  };

  return (
    <div className="page page-count">
      <PageHead
        back={
          task
            ? { label: "Recounts", onClick: () => go({ tab: "recounts" }) }
            : { label: s.thirdParty ? stack : `Stack ${stack}`, onClick: () => go({ tab: "count", view: "stack", site: code, stack }) }
        }
        title={outturn}
        code
        sub={[lot?.head.i ?? grade, lot?.head.bn, lot?.head.g].filter(Boolean).join(" · ")}
      />

      {blind && (
        <div className="callout callout-info">
          <EyeOff size={22} aria-hidden />
          <div>
            <strong>Blind recount.</strong> {task!.why} The expected figures are hidden until you save.
          </div>
        </div>
      )}

      {theirs && (
        <div className="callout callout-crit">
          <Users size={22} aria-hidden />
          <div>
            <strong>
              {theirs.by} already counted this lot here at {theirs.at}
            </strong>{" "}
            ({unitsOf(theirs)} units). Only count it again if they asked you to check. Both counts go to the supervisor.
          </div>
        </div>
      )}

      {!theirs && countedElsewhere.length > 0 && (
        <div className="callout callout-warn">
          <Shuffle size={22} aria-hidden />
          <div>
            <strong>This outturn was already counted</strong> at{" "}
            {countedElsewhere.map((c) => `${c.stack} by ${c.by === store.me ? "you" : c.by} (${unitsOf(c)} units)`).join(", ")}. If
            these are different bags of the same lot, count them here.
          </div>
        </div>
      )}

      {xbsElsewhere.length > 0 && (
        <div className="callout callout-warn">
          <Shuffle size={22} aria-hidden />
          <div>
            <strong>Split lot.</strong> XBS also has{" "}
            {xbsElsewhere
              .slice(0, 3)
              .map((x) => `${x.u} unit${x.u === 1 ? "" : "s"} at ${site(x.wh).short}${x.wh === "IBR" ? " " + x.z : ""}`)
              .join(", ")}
            . Count only the bags on this stack.
          </div>
        </div>
      )}

      {isFound && (
        <div className="callout callout-warn">
          <PackageSearch size={22} aria-hidden />
          <div>
            <strong>XBS doesn't expect this lot {s.thirdParty ? "at " + s.short : "on " + stack}.</strong>{" "}
            {unknown ? "It isn't in XBS anywhere." : "Count it anyway."} It will be saved as found stock and checked by the
            supervisor.
          </div>
        </div>
      )}

      {unknown && (
        <section className="panel">
          <label className="field-label" htmlFor="grade">
            Grade on the bag
          </label>
          <select id="grade" className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            {GRADES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </section>
      )}

      <section className="panel">
        <span className="field-label">Packing type</span>
        <div className="choice-2">
          {PACK_TYPES.map((p) => (
            <button key={p.id} type="button" className="choice" aria-pressed={q.pack === p.id} onClick={() => set({ pack: p.id })}>
              <strong>{p.label}</strong>
              <span>{p.hint}</span>
            </button>
          ))}
        </div>
        {lot && !blind && pack(q.pack).kg !== xbsPackKg && (
          <p className="hint hint-bad">
            <TriangleAlert size={16} aria-hidden /> XBS weighs this lot in {xbsPackKg} kg bags. Check the bags before you change it.
          </p>
        )}
      </section>

      <section className="panel">
        <Stepper id="bags" label={`Full ${pack(q.pack).kg} kg bags`} value={q.bags} onChange={(v) => set({ bags: v })} />
        {!blind && expected && <BagTiers expected={expected.bags} counted={q.bags} />}
        <div className="grid-2">
          <Stepper id="pocketBags" label="Pocket bags" value={q.pocketBags} onChange={(v) => set({ pocketBags: v })} />
          <Stepper id="pocketKg" label="Pocket weight" value={q.pocketKg} onChange={(v) => set({ pocketKg: Math.round(v * 10) / 10 })} decimal suffix="kg" />
        </div>
        {problem && (
          <p className="field-error" role="alert">
            <TriangleAlert size={18} aria-hidden /> {problem}
          </p>
        )}
        <dl className="calc">
          <div>
            <dt>Units</dt>
            <dd className="num">{n(units)}</dd>
            <dd className="calc-how">
              {q.bags} full + {q.pocketBags} pocket
            </dd>
          </div>
          <div>
            <dt>Weight</dt>
            <dd className="num">{n(kg, 1)} kg</dd>
            <dd className="calc-how">
              {q.bags} × {pack(q.pack).kg} + {n(q.pocketKg, 1)}
            </dd>
          </div>
          <div>
            <dt>60 kg bags</dt>
            <dd className="num">{n(bags60(kg), 2)}</dd>
            <dd className="calc-how">for Finance</dd>
          </div>
        </dl>
      </section>

      {touched && !blind && !isFound && (
        <section className={`result result-${result.tone}`} aria-live="polite">
          <div className="result-head">
            {result.match ? <CircleCheck size={24} aria-hidden /> : <CircleAlert size={24} aria-hidden />}
            <strong>{result.headline}</strong>
          </div>
          <p>{result.detail}</p>
          {!result.match && (
            <fieldset className="reasons">
              <legend className="field-label">Why is it different?</legend>
              {REASONS.map((r) => (
                <label key={r} className="reason">
                  <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                  <span>{r}</span>
                </label>
              ))}
            </fieldset>
          )}
        </section>
      )}

      <section className="panel">
        <label className="field-label" htmlFor="cat">
          Stock type
        </label>
        <select id="cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as StockCategory)}>
          {CATEGORIES.slice(0, 3).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="field-label" htmlFor="note">
          Note for the supervisor
        </label>
        <textarea id="note" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Torn bags, re-stacked, tag faded…" />
        <button type="button" className="btn btn-quiet">
          <Camera size={20} aria-hidden /> Add a photo of the tag
        </button>
      </section>

      {lot && !blind && (
        <section className="panel">
          <button type="button" className="disclosure" aria-expanded={showXbs} onClick={() => setShowXbs((v) => !v)}>
            What XBS says about this lot <ChevronDown size={20} aria-hidden />
          </button>
          {showXbs && (
            <dl className="kv">
              <dt>Expected here</dt>
              <dd>{expected ? `${expected.units} units · ${expected.bags} bags + ${n(expected.pockets, 1)} kg` : "None"}</dd>
              <dt>Batch</dt>
              <dd className="code wrap">{lot.batch}</dd>
              <dt>Warrant</dt>
              <dd className="code">{lot.head.wr ?? "—"}</dd>
              <dt>Basket</dt>
              <dd>{lot.head.bc ? `${lot.head.bc} ${lot.head.bn}` : "—"}</dd>
              <dt>Stock type</dt>
              <dd>{lot.parts.map((p) => (p.t === "W" ? `Warehouse ${p.u}` : `Processing ${p.in ?? ""} ${p.u}`)).join(" · ")}</dd>
              {lot.head.so && (
                <>
                  <dt>Contract</dt>
                  <dd>{lot.head.so}</dd>
                </>
              )}
            </dl>
          )}
        </section>
      )}

      <div className="sticky-actions">
        {!task && nextLot && (
          <button className="btn btn-xl" disabled={!canSave} onClick={() => save(false)}>
            Save
          </button>
        )}
        <button className="btn btn-primary btn-xl" disabled={!canSave} onClick={() => save(true)}>
          {task ? "Save recount" : nextLot ? "Save and next lot" : "Save"}
        </button>
      </div>
      {needsReason && !reason && <p className="hint center">Choose a reason for the difference to save.</p>}
      {!touched && !isFound && (
        <button type="button" className="btn btn-block" onClick={() => setTouched(true)}>
          <PackageSearch size={20} aria-hidden /> I can't find this lot
        </button>
      )}
      {mine && !task && (
        <Chip tone="info">
          You saved this at {mine.at}. Saving again replaces it.
        </Chip>
      )}
    </div>
  );
}
