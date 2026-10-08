import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useNav } from "../App";
import { bags60, kgOf, pocketProblem, unitsOf, type Qty } from "../data/calc";
import { OTHER_CATEGORIES, PACK_TYPES, pack, site } from "../data/repository";
import { useStore } from "../data/store";
import type { SiteCode, StockCategory } from "../data/types";
import { PageHead, Stepper, n } from "../ui/kit";

const HELP: Partial<Record<StockCategory, string>> = {
  Sweepings: "Coffee swept from the floor and bagged. Count it separately; it's reconciled against the sweeping record.",
  "Loose bags": "Bags with no tag or lot. Count them here so they're in the variance, not lost.",
  "Disputed stock": "Bags whose owner or lot is in question. Say why in the note.",
  "Direct purchase (not in XBS)": "Coffee bought direct from a co-operative or agent that isn't in XBS yet. Add the contract or delivery note.",
  "Ex-office stock": "Stock waiting to leave on an ex-office transfer.",
};

export default function OtherStock({ site: code, stack }: { site: SiteCode; stack: string }) {
  const go = useNav();
  const store = useStore();
  const s = site(code);
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
    <div className="page page-count">
      <PageHead back={{ label: s.thirdParty ? stack : `Stack ${stack}`, onClick: back }} title="Other stock" sub="Stock with no XBS outturn on this stack." />

      <section className="panel">
        <span className="field-label">What is it?</span>
        <div className="choice-list">
          {OTHER_CATEGORIES.map((c) => (
            <button key={c} type="button" className="choice" aria-pressed={category === c} onClick={() => setCategory(c)}>
              <strong>{c}</strong>
            </button>
          ))}
        </div>
        {HELP[category] && <p className="hint">{HELP[category]}</p>}
      </section>

      <section className="panel">
        <label className="field">
          <span className="field-label">Grade, if you know it</span>
          <input className="input" value={grade} onChange={(e) => setGrade(e.target.value.toUpperCase())} placeholder="e.g. AB, CLEAN 1" />
        </label>
        {direct && (
          <label className="field">
            <span className="field-label">Contract, warrant or delivery note no.</span>
            <input className="input input-code" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. DN-20431" />
          </label>
        )}
        <span className="field-label">Packing type</span>
        <div className="choice-2">
          {PACK_TYPES.map((p) => (
            <button key={p.id} type="button" className="choice" aria-pressed={q.pack === p.id} onClick={() => set({ pack: p.id })}>
              <strong>{p.label}</strong>
            </button>
          ))}
        </div>
        <Stepper id="o-bags" label={`Full ${pack(q.pack).kg} kg bags`} value={q.bags} onChange={(v) => set({ bags: v })} />
        <div className="grid-2">
          <Stepper id="o-pb" label="Pocket bags" value={q.pocketBags} onChange={(v) => set({ pocketBags: v })} />
          <Stepper id="o-pk" label="Pocket weight" value={q.pocketKg} onChange={(v) => set({ pocketKg: Math.round(v * 10) / 10 })} decimal suffix="kg" />
        </div>
        {problem && (
          <p className="field-error" role="alert">
            <TriangleAlert size={18} aria-hidden /> {problem}
          </p>
        )}
        <p className="hint">
          {unitsOf(q)} units · {n(kgOf(q), 1)} kg · {n(bags60(kgOf(q)), 2)} bags of 60 kg
        </p>
        <label className="field">
          <span className="field-label">Note</span>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </section>

      <div className="sticky-actions">
        <button
          className="btn btn-primary btn-xl btn-block"
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
          Save to {s.thirdParty ? stack : `stack ${stack}`}
        </button>
      </div>
    </div>
  );
}
