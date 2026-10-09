import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useNav } from "../App";
import { bags60, kgOf, pocketProblem, unitsOf, type Qty } from "../data/calc";
import { OTHER_CATEGORIES, PACK_TYPES } from "../data/repository";
import { useStore } from "../data/store";
import type { PackType, SiteCode, StockCategory } from "../data/types";
import { ActionBar, PageHead, Segmented, Stepper, n } from "../ui/kit";

const HELP: Partial<Record<StockCategory, string>> = {
  Sweepings: "Coffee swept from the floor and bagged.",
  "Loose bags": "Bags with no tag or lot.",
  "Disputed stock": "Owner or lot in question — say why in the note.",
  "Direct purchase (not in XBS)": "Bought from a co-operative or agent, not in XBS yet.",
  "Ex-office stock": "Waiting to leave on an ex-office transfer.",
};

export default function OtherStock({ site: code, stack }: { site: SiteCode; stack: string }) {
  const go = useNav();
  const store = useStore();
  const [category, setCategory] = useState<StockCategory>("Sweepings");
  const [grade, setGrade] = useState("");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState<Qty>({ pack: "JUTE60", bags: 0, pocketBags: 0, pocketKg: 0 });
  const set = (p: Partial<Qty>) => setQ((x) => ({ ...x, ...p }));
  const problem = pocketProblem(q);
  const direct = category === "Direct purchase (not in XBS)";
  const canSave = unitsOf(q) > 0 && !problem && (!direct || ref.trim().length > 0);
  const back = () => go({ tab: "count", view: "stack", site: code, stack });

  return (
    <div className="page has-actionbar">
      <PageHead back={{ label: stack, onClick: back }} title="Other stock" sub="Stock on this stack with no XBS outturn" />

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">What is it?</h2>
        </div>
        <div className="group" role="radiogroup" aria-label="Kind of stock">
          {OTHER_CATEGORIES.map((c) => (
            <label key={c} className="row row-radio">
              <input type="radio" name="cat" checked={category === c} onChange={() => setCategory(c)} />
              <span className="row-main">
                <span className="row-title">{c}</span>
                <span className="row-sub">{HELP[c]}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="split-2">
          <label className="field">
            <span className="label">Grade (if known)</span>
            <input className="input" value={grade} onChange={(e) => setGrade(e.target.value.toUpperCase())} placeholder="AB" />
          </label>
          {direct && (
            <label className="field">
              <span className="label">Contract / delivery note</span>
              <input className="input code" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="DN-20431" />
            </label>
          )}
        </div>
        <div className="field">
          <span className="label">Bag size</span>
          <Segmented<PackType["id"]> label="Bag size" value={q.pack} onChange={(v) => set({ pack: v })} options={PACK_TYPES.map((p) => [p.id, `${p.kg} kg jute`])} />
        </div>
        <Stepper id="o-bags" label="Full bags" value={q.bags} onChange={(v) => set({ bags: v })} />
        <div className="split-2">
          <Stepper id="o-pb" size="md" label="Pocket bags" value={q.pocketBags} onChange={(v) => set({ pocketBags: v })} />
          <Stepper id="o-pk" size="md" label="Pocket kg" value={q.pocketKg} onChange={(v) => set({ pocketKg: Math.round(v * 10) / 10 })} decimal />
        </div>
        {problem && (
          <p className="hint hint-crit" role="alert">
            <TriangleAlert size={15} aria-hidden /> {problem}
          </p>
        )}
        <label className="field">
          <span className="label">Note</span>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </section>

      <ActionBar
        summary={
          <span className="sum-figures">
            <strong>{unitsOf(q)}</strong> units · <strong>{n(kgOf(q), 1)}</strong> kg
            <span className="sum-sub">{n(bags60(kgOf(q)), 2)} × 60 kg</span>
          </span>
        }
      >
        <button
          className="btn btn-primary btn-lg btn-grow"
          disabled={!canSave}
          onClick={() => {
            store.saveCount({
              site: code,
              stack,
              batch: `OTHER-${Date.now()}`,
              outturn: category,
              grade: grade || "—",
              category,
              ...q,
              note: note.trim() || undefined,
              reference: ref.trim() || undefined,
              other: true,
            });
            back();
          }}
        >
          Save
        </button>
      </ActionBar>
    </div>
  );
}
