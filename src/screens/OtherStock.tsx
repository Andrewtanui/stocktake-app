import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useNav } from "../App";
import { bags60, kgOf, pocketProblem, pocketWarning, unitsOf, withPocket, type Qty } from "../data/calc";
import { EX_OFFICE_TYPES, OTHER_CATEGORIES, PACK_TYPES } from "../data/repository";
import { useStore } from "../data/store";
import type { PackType, SiteCode, StockCategory } from "../data/types";
import { ActionBar, PageHead, Segmented, Stepper, n } from "../ui/kit";

const HELP: Partial<Record<StockCategory, string>> = {
  "Ex-office stock": "Ex-office sweepings, graded Type 1, 2 or 3.",
  Sweepings: "Clean coffee swept from the warehouse floor and bagged.",
  Franchise: "Franchise gains left after a contract is bulked (KDI no.), or gains already bulked (KIB no.).",
  "Loose bags": "Bags with no tag or lot.",
  "Disputed stock": "Owner or lot in question — say why in the note.",
  "Direct purchase (not in XBS)": "Bought from a co-operative or agent, not in XBS yet.",
};

/** A franchise lot's number as the register writes it: "6088" -> "KDI6088", "kib 35376" -> "KIB35376". */
const franchiseRef = (x: string) => {
  const t = x.trim().toUpperCase().replace(/\s+/g, "");
  return /^\d/.test(t) ? `KDI${t}` : t;
};

export default function OtherStock({ site: code, stack }: { site: SiteCode; stack: string }) {
  const go = useNav();
  const store = useStore();
  const [category, setCategory] = useState<StockCategory>("Ex-office stock");
  const [type, setType] = useState(EX_OFFICE_TYPES[0]);
  const [grade, setGrade] = useState("");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState<Qty>({ pack: "JUTE60", bags: 0, pocketBags: 0, pocketKg: 0 });
  const set = (p: Partial<Qty>) => setQ((x) => ({ ...x, ...p }));
  const problem = pocketProblem(q);
  // A pocket over two full bags is saved only once the counter confirms that weight.
  const warning = pocketWarning(q);
  const [okPocketKg, setOkPocketKg] = useState<number | null>(null);
  const needsConfirm = !!warning && okPocketKg !== q.pocketKg;
  const direct = category === "Direct purchase (not in XBS)";
  const exOffice = category === "Ex-office stock";
  const franchise = category === "Franchise";
  const kdi = franchise && /^(KDI|KIB)/.test(franchiseRef(ref));
  const canSave = unitsOf(q) > 0 && !problem && !needsConfirm && (!direct || ref.trim().length > 0) && (!franchise || kdi);
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
        {exOffice && (
          <div className="field">
            <span className="label">Type</span>
            <Segmented<string> label="Type" value={type} onChange={setType} options={EX_OFFICE_TYPES.map((t) => [t, t.replace("TYPE", "Type")])} />
          </div>
        )}
        <div className="split-2">
          {!exOffice && (
            <label className="field">
              <span className="label">{franchise ? "Quality (if known)" : "Grade (if known)"}</span>
              <input className="input" value={grade} onChange={(e) => setGrade(e.target.value.toUpperCase())} placeholder={franchise ? "ABC FAQ" : "AB"} />
            </label>
          )}
          {franchise && (
            <label className="field">
              <span className="label">KDI or KIB number</span>
              <input className="input code" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="KDI6088" aria-describedby="fr-hint" />
              <span id="fr-hint" className="hint">
                {ref.trim() && !kdi ? "Start with KDI (gains) or KIB (bulked)." : "Gains: the KDI no. Bulked: the KIB no."}
              </span>
            </label>
          )}
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
        <Stepper id="o-pk" size="md" label="Pocket weight (kg)" value={q.pocketKg} onChange={(v) => set(withPocket(q, Math.round(v)))} hint="One odd bag, whole kg · 0 if none" />
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
              outturn: franchise ? franchiseRef(ref) : category,
              grade: exOffice ? type : grade || "—",
              category,
              ...q,
              note: note.trim() || undefined,
              reference: (franchise ? franchiseRef(ref) : ref.trim()) || undefined,
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
