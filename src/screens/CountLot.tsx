import { useState } from "react";
import { ChevronDown, EyeOff, PackageSearch, Shuffle, TriangleAlert, Users } from "lucide-react";
import { useNav } from "../App";
import { bags60, kgOf, pocketProblem, pocketWarning, unitsOf, withPocket, type Qty } from "../data/calc";
import {
  CATEGORIES,
  PACK_TYPES,
  REASONS,
  allLines,
  defaultPack,
  elsewhere,
  expectedLots,
  groupByBatch,
  site,
  type Lot,
} from "../data/repository";
import { useStore } from "../data/store";
import type { PackType, SiteCode, StockCategory, VarianceReason } from "../data/types";
import { ActionBar, Notice, PageHead, Pill, Segmented, Stepper, n } from "../ui/kit";
import { PhotoField } from "../ui/PhotoField";
import type { Photo } from "../data/photo";

// Blind counting: counters never see XBS quantities or whether their count
// matches. If they could, a count of 101 bags could be "corrected" to the 133
// XBS shows to avoid a recount. Only supervisors see differences.

const GRADES = ["AA", "AB", "PB", "C", "E", "TT", "T", "MH", "ML", "UG1", "CLEAN 1", "BULK", "LIGHTS"];

export default function CountLot({
  site: code,
  stack,
  batch,
  recount,
  from,
}: {
  site: SiteCode;
  stack: string;
  batch: string;
  recount?: string;
  /** Opened from "Count an outturn": saving goes back there for the next tag. */
  from?: "find";
}) {
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
  // Bag size: pre-selected from how XBS packs this lot (no warning shown).
  const xbsPackKg = lot && lot.bags ? Math.round((lot.kg - lot.pockets) / lot.bags) : undefined;
  const startPack = PACK_TYPES.find((p) => p.kg === xbsPackKg)?.id ?? defaultPack(lot?.head.i ?? grade);
  const [q, setQ] = useState<Qty>(
    mine && !task
      ? { pack: mine.pack, bags: mine.bags, pocketBags: mine.pocketBags, pocketKg: mine.pocketKg }
      : { pack: startPack, bags: 0, pocketBags: 0, pocketKg: 0 },
  );
  const [touched, setTouched] = useState(!!mine && !task);
  const [category, setCategory] = useState<StockCategory>(
    mine?.category ?? (lot?.parts.some((p) => p.t === "B") ? "Processing stock" : "Current stock"),
  );
  const [reason, setReason] = useState<VarianceReason | undefined>(mine?.reason ?? (isFound ? "Bags moved here, not yet received in XBS" : undefined));
  const [note, setNote] = useState(mine?.note ?? "");
  const [photo, setPhoto] = useState<Photo | undefined>(task ? undefined : mine?.photo);
  const [more, setMore] = useState(false);
  const [unusual, setUnusual] = useState(!!mine?.reason);

  const set = (patch: Partial<Qty>) => {
    setQ((x) => ({ ...x, ...patch }));
    setTouched(true);
  };
  const units = unitsOf(q);
  const kg = kgOf(q);
  const problem = pocketProblem(q);
  // A pocket over two full bags is saved only once the counter confirms that weight.
  const warning = pocketWarning(q);
  const [okPocketKg, setOkPocketKg] = useState<number | null>(mine && !task ? mine.pocketKg : null);
  const needsConfirm = !!warning && okPocketKg !== q.pocketKg;
  const blind = !!task;
  const canSave = touched && !problem && !needsConfirm;
  const nextLot = !s.thirdParty && !from
    ? here.find((l) => l.batch !== batch && !store.entriesAt(code, stack).some((e) => e.batch === l.batch))
    : undefined;

  const save = (next?: boolean) => {
    store.saveCount({
      site: code,
      stack,
      batch,
      outturn,
      grade,
      category,
      ...q,
      reason,
      note: note.trim() || undefined,
      photo,
      found: isFound || undefined,
      recount,
    });
    if (task) go({ tab: "recounts" });
    else if (from) go({ tab: "count", view: "find" });
    else if (next && nextLot) go({ tab: "count", view: "lot", site: code, stack, batch: nextLot.batch });
    else go({ tab: "count", view: "stack", site: code, stack });
  };

  const status = !touched ? <Pill>Not counted yet</Pill> : <Pill tone="info">Ready to save</Pill>;

  return (
    <div className="page has-actionbar has-summary">
      <PageHead
        back={
          task
            ? { label: "Recounts", onClick: () => go({ tab: "recounts" }) }
            : from
              ? { label: "Outturn", onClick: () => go({ tab: "count", view: "find" }) }
              : { label: stack, onClick: () => go({ tab: "count", view: "stack", site: code, stack }) }
        }
        title={outturn}
        code
        sub={[from ? `at ${stack}` : undefined, lot?.head.i ?? grade, lot?.head.bn, lot?.head.g].filter(Boolean).join(" · ")}
      />

      {blind && (
        <Notice tone="info" icon={<EyeOff size={18} />} title="Blind recount">
          {task!.why}
        </Notice>
      )}
      {theirs && !task && (
        <Notice tone="crit" icon={<Users size={18} />} title={`${theirs.by} already counted this lot`}>
          At {theirs.at}. Only count again if they asked you to check.
        </Notice>
      )}
      {!theirs && !task && countedElsewhere.length > 0 && (
        <Notice tone="warn" icon={<Shuffle size={18} />} title="Already counted elsewhere">
          {countedElsewhere.map((c) => `${c.stack} by ${c.by === store.me ? "you" : c.by}`).join(", ")}. Count only the bags here.
        </Notice>
      )}
      {xbsElsewhere.length > 0 && (
        <Notice tone="warn" icon={<Shuffle size={18} />} title="Split lot">
          This outturn is also at {[...new Set(xbsElsewhere.map((x) => `${site(x.wh).short}${x.wh === "IBR" ? " " + x.z : ""}`))].slice(0, 3).join(", ")}. Count
          only the bags here.
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
        </div>

        <Stepper
          id="bags"
          label="Full bags"
          value={q.bags}
          onChange={(v) => set({ bags: v })}
        />

        <Stepper
          id="pocketKg"
          size="md"
          label="Pocket weight (kg)"
          value={q.pocketKg}
          onChange={(v) => set(withPocket(q, Math.round(v)))}
          hint="One odd bag, whole kg · 0 if none"
        />

        {problem && (
          <p className="hint hint-crit" role="alert">
            <TriangleAlert size={15} aria-hidden /> {problem}
          </p>
        )}
        {warning && (
          <div className="hint hint-warn" role="alert">
            <TriangleAlert size={15} aria-hidden />
            <span>
              {warning}{" "}
              {needsConfirm ? (
                <button type="button" className="link" onClick={() => setOkPocketKg(q.pocketKg)}>
                  Yes, {q.pocketKg} kg is right
                </button>
              ) : (
                "Confirmed."
              )}
            </span>
          </div>
        )}
      </section>

      {/* Optional on every lot, so it says nothing about whether the count matches. */}
      <section className="section">
        <button type="button" className="disclosure" aria-expanded={unusual} onClick={() => setUnusual((v) => !v)}>
          <span>{reason ? `Unusual: ${reason}` : "Anything unusual about this lot?"}</span>
          <ChevronDown size={18} aria-hidden />
        </button>
        {unusual && (
          <div className="group" role="radiogroup" aria-label="Anything unusual">
            {[undefined, ...REASONS].map((r) => (
              <label key={r ?? "none"} className="row row-radio">
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                <span className="row-main">
                  <span className="row-title">{r ?? "Nothing unusual"}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

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
            <PhotoField label="Photo of the tag" name={`${outturn} ${stack}`} value={photo} saved={!task && mine?.hasPhoto} onChange={setPhoto} />
            {lot && !blind && (
              <dl className="kv">
                <dt>Batch</dt>
                <dd className="code">{lot.batch}</dd>
                <dt>Warrant</dt>
                <dd className="code">{lot.head.wr ?? "—"}</dd>
                <dt>Basket</dt>
                <dd>{lot.head.bc ? `${lot.head.bc} ${lot.head.bn}` : "—"}</dd>
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
          {task ? "Save recount" : from ? "Save & next outturn" : nextLot ? "Save & next lot" : "Save"}
        </button>
      </ActionBar>
    </div>
  );
}
