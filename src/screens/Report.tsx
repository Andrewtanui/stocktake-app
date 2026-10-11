import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { SITES, site } from "../data/repository";
import { useStore } from "../data/store";
import type { IssueCategory, SiteCode } from "../data/types";
import { PageHead, Pill, Section, type Tone } from "../ui/kit";
import { PhotoField } from "../ui/PhotoField";
import type { Photo } from "../data/photo";

const CATS: IssueCategory[] = [
  "App not working",
  "Network or saving",
  "Lot not on the list",
  "Tag missing or unreadable",
  "Stack blocked or unsafe",
  "Third-party staff not available",
  "Other",
];
const STATUS_TONE: Record<string, Tone> = { Open: "warn", "In progress": "info", Resolved: "ok" };

export default function Report({ lastScreen }: { lastScreen: string }) {
  const store = useStore();
  const [cat, setCat] = useState<IssueCategory | null>(null);
  const [where, setWhere] = useState<SiteCode>("IBR");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<Photo>();
  const mine = store.issues.filter((i) => i.by === store.me);

  return (
    <div className="page">
      <PageHead title="Report a problem" sub="Anything slowing the count — the app, the network, the site or the stock." />

      <section className="card">
        <div className="field">
          <span className="label">What's wrong?</span>
          <div className="choice-grid">
            {CATS.map((c) => (
              <button key={c} type="button" className="choice" aria-pressed={cat === c} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="label">Where</span>
          <select className="input" value={where} onChange={(e) => setWhere(e.target.value as SiteCode)}>
            {SITES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">What happened?</span>
          <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. App froze when I saved 12KN0015 at A-03-2" />
        </label>
        <PhotoField label="Add a photo" name={`Problem ${site(where).short}`} value={photo} onChange={setPhoto} />
        <div className="btn-pair">
          <button
            className="btn btn-primary btn-grow"
            disabled={!cat || !text.trim()}
            onClick={() => {
              store.addIssue({ category: cat!, site: where, screen: lastScreen, text: text.trim(), photo });
              setCat(null);
              setText("");
              setPhoto(undefined);
            }}
          >
            Send report
          </button>
        </div>
      </section>

      <Section title="Your reports">
        {mine.map((i) => (
          <div key={i.id} className="row row-stack">
            <div className="row-line">
              <span className="row-title">{i.category}</span>
              <Pill tone={STATUS_TONE[i.status]}>{i.status}</Pill>
            </div>
            <span className="row-text">{i.text}</span>
            {i.resolution && <span className="reply">{i.resolution}</span>}
            <span className="row-sub">
              {site(i.site).short} · {i.screen} · {i.at}
              {i.hasPhoto && (
                <>
                  {" · "}
                  <ImageIcon size={13} className="inline-icon" aria-hidden /> photo
                </>
              )}
            </span>
          </div>
        ))}
      </Section>
    </div>
  );
}
