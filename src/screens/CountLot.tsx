import { useState } from "react";
import { Camera, ChevronDown, EyeOff, PackageSearch, Shuffle, TriangleAlert, Users } from "lucide-react";
import { useNav } from "../App";
import { bags60, compare, kgOf, pocketProblem, unitsOf, type Qty } from "../data/calc";
import {
  CATEGORIES,
  PACK_TYPES,
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
import type { PackType, SiteCode, StockCategory, VarianceReason } from "../data/types";
import { ActionBar, Notice, PageHead, Pill, Segmented, Stepper, n } from "../ui/kit";

const GRADES = ["AA", "AB", "PB", "C", "E", "TT", "T", "MH", "ML", "UG1", "CLEAN 1", "BULK", "LIGHTS"];

export default function CountLot({ site: code, stack, batch, recount }: { site: SiteCode; stack: string; batch: string; recount?: string }) {
  const go = useNav();
  const store = useStore();
  const s = site(code);
  const task = recount ? store.recount(recount) : undefined;

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
  const [more, setMore] = useState(false);

  const set = (patch: Partial<Qty>) => {
    setQ((x) => ({ ...x, ...patch }));
    setTouched(true);
  };
  const units = unitsOf(q);
  const kg = kgOf(q);
  const problem = pocketProblem(q);
  const result = compare(q, expected ? { units: expected.units, kg: expected.kg } : { units: 0, kg: 0 });
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

  const status = !touched ? (
    <Pill>Not counted yet</Pill>
  ) : blind || isFound ? (
    <Pill tone="info">Ready to save</Pill>
  ) : (
    <Pill tone={result.tone}>{result.headline}</Pill>
  );

  return (
    <div className="page has-actionbar has-summary">
      <PageHead
        back={
          task
            ? { label: "Recounts", onClick: () => go({ tab: "recounts" }) }
            : { label: stack, onClick: () => go({ tab: "count", view: "stack", site: code, stack }) }
        }
        title={outturn}
        code
        sub={[lot?.head.i ?? grade, lot?.head.bn, lot?.head.g].filter(Boolean).join(" · ")}
        aside={!blind && expected ? <ExpectedBadge units={expected.units} /> : undefined}
      />

      {blind && (
        <Notice tone="info" icon={<EyeOff size={18} />} title="Blind recount">
          {task!.why}
        </Notice>
      )}
      {theirs && (
        <Notice tone="crit" icon={<Users size={18} />} title={`${theirs.by} already counted this lot`}>
          {unitsOf(theirs)} units at {theirs.at}. Only count again if they asked you to check.
        </Notice>
      )}
      {!theirs && countedElsewhere.length > 0 && (
        <Notice tone="warn" icon={<Shuffle size={18} />} title="Already counted elsewhere">
          {countedElsewhere.map((c) => `${c.stack} by ${c.by === store.me ? "you" : c.by} (${unitsOf(c)} units)`).join(", ")}
        </Notice>
      )}
      {xbsElsewhere.length > 0 && (
        <Notice tone="warn" icon={<Shuffle size={18} />} title="Split lot">
          XBS also has{" "}
          {xbsElsewhere
            .slice(0, 2)
            .map((x) => `${x.u} unit${x.u === 1 ? "" : "s"} at ${site(x.wh).short}${x.wh === "IBR" ? " " + x.z : ""}`)
            .join(" and ")}
          . Count only the bags here.
        </Notice>
      )}
      {isFound && (
        <Notice tone="warn" icon={<PackageSearch size={18} />} title="Not expected here">
          {unknown ? "This outturn isn't in XBS. " : ""}Count it; your supervisor will check it.
        </Notice>
      )}

      <section className="card">
        {unknown && (
          <label className="field">
            <span className="label">Grade on the bag</span>
            <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
              {GRADES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        )}

        <div className="field">
          <span className="label">Bag size</span>
          <Segmented<PackType["id"]>
            label="Bag size"
            value={q.pack}
            onChange={(v) => set({ pack: v })}
            options={PACK_TYPES.map((p) => [p.id, `${p.kg} kg jute`])}
          />
          {lot && !blind && pack(q.pack).kg !== xbsPackKg && (
            <p className="hint hint-warn">
              <TriangleAlert size={15} aria-hidden /> XBS records this lot in {xbsPackKg} kg bags.
            </p>
          )}
        </div>

        <Stepper
          id="bags"
          label="Full bags"
          value={q.bags}
          onChange={(v) => set({ bags: v })}
          hint={!blind && expected ? `XBS: ${expected.bags}` : undefined}
        />

        <div className="split-2">
          <Stepper id="pocketBags" size="md" label="Pocket bags" value={q.pocketBags} onChange={(v) => set({ pocketBags: v })} />
          <Stepper
            id="pocketKg"
            size="md"
            label="Pocket kg"
            value={q.pocketKg}
            onChange={(v) => set({ pocketKg: Math.round(v * 10) / 10 })}
            decimal
          />
        </div>

        {problem && (
          <p className="hint hint-crit" role="alert">
            <TriangleAlert size={15} aria-hidden /> {problem}
          </p>
        )}
      </section>

      {needsReason && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Why is it different?</h2>
          </div>
          <p className="section-lede">{result.detail}</p>
          <div className="group" role="radiogroup" aria-label="Reason">
            {REASONS.map((r) => (
              <label key={r} className="row row-radio">
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                <span className="row-main">
                  <span className="row-title">{r}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <button type="button" className="disclosure" aria-expanded={more} onClick={() => setMore((v) => !v)}>
          <span>Note, photo and lot details</span>
          <ChevronDown size={18} aria-hidden />
        </button>
        {more && (
          <div className="card">
            <label className="field">
              <span className="label">Stock type</span>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value as StockCategory)}>
                {CATEGORIES.slice(0, 3).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Note for the supervisor</span>
              <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Torn bags, re-stacked, tag faded…" />
            </label>
            <button type="button" className="btn btn-soft">
              <Camera size={18} aria-hidden /> Photo of the tag
            </button>
            {lot && !blind && (
              <dl className="kv">
                <dt>Batch</dt>
                <dd className="code">{lot.batch}</dd>
                <dt>Warrant</dt>
                <dd className="code">{lot.head.wr ?? "—"}</dd>
                <dt>Basket</dt>
                <dd>{lot.head.bc ? `${lot.head.bc} ${lot.head.bn}` : "—"}</dd>
                <dt>XBS here</dt>
                <dd>{expected ? `${expected.bags} bags + ${n(expected.pockets, 1)} kg` : "None"}</dd>
                {lot.head.so && (
                  <>
                    <dt>Contract</dt>
                    <dd>{lot.head.so}</dd>
                  </>
                )}
              </dl>
            )}
          </div>
        )}
      </section>

      {!touched && !isFound && (
        <button type="button" className="text-btn center" onClick={() => setTouched(true)}>
          <PackageSearch size={16} aria-hidden /> I can't find this lot
        </button>
      )}
      {mine && !task && <p className="footnote">You saved this at {mine.at}. Saving again replaces it.</p>}

      <ActionBar
        summary={
          <>
            <span className="sum-figures">
              <strong>{n(units)}</strong> units · <strong>{n(kg, 1)}</strong> kg
              <span className="sum-sub">{n(bags60(kg), 2)} × 60 kg</span>
            </span>
            {status}
          </>
        }
      >
        {!task && nextLot && (
          <button className="btn btn-soft btn-lg" disabled={!canSave} onClick={() => save(false)}>
            Save
          </button>
        )}
        <button className="btn btn-primary btn-lg btn-grow" disabled={!canSave} onClick={() => save(true)}>
          {needsReason && !reason ? "Choose a reason below" : task ? "Save recount" : nextLot ? "Save & next lot" : "Save"}
        </button>
      </ActionBar>
    </div>
  );
}

function ExpectedBadge({ units }: { units: number }) {
  return (
    <span className="expected">
      <strong>{units}</strong>
      <span>units in XBS</span>
    </span>
  );
}
