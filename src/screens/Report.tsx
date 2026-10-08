import { useState } from "react";
import { Camera, Send } from "lucide-react";
import { SITES, site } from "../data/repository";
import { useStore } from "../data/store";
import type { IssueCategory, SiteCode } from "../data/types";
import { Chip, PageHead, type Tone } from "../ui/kit";

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
  const [screen, setScreen] = useState(lastScreen);
  const [text, setText] = useState("");
  const mine = store.issues.filter((i) => i.by === store.me);

  return (
    <div className="page">
      <PageHead title="Report a problem" sub="Tell the stock take lead about anything slowing the count: the app, the network, the site or the stock." />

      <section className="panel">
        <span className="field-label">What's the problem?</span>
        <div className="choice-list">
          {CATS.map((c) => (
            <button key={c} type="button" className="choice" aria-pressed={cat === c} onClick={() => setCat(c)}>
              <strong>{c}</strong>
            </button>
          ))}
        </div>
        <div className="grid-2">
          <label className="field">
            <span className="field-label">Where</span>
            <select className="input" value={where} onChange={(e) => setWhere(e.target.value as SiteCode)}>
              {SITES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Screen</span>
            <input className="input" value={screen} onChange={(e) => setScreen(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">What happened?</span>
          <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. App froze when I saved 12KN0015 at A-03-2" />
        </label>
        <button type="button" className="btn btn-quiet">
          <Camera size={20} aria-hidden /> Add a photo or screenshot
        </button>
        <button
          className="btn btn-primary btn-xl"
          disabled={!cat || !text.trim()}
          onClick={() => {
            store.addIssue({ category: cat!, site: where, screen, text: text.trim() });
            setCat(null);
            setText("");
          }}
        >
          <Send size={20} aria-hidden /> Send
        </button>
      </section>

      <section className="block">
        <h2 className="h3">Your reports</h2>
        <ul className="cards">
          {mine.map((i) => (
            <li key={i.id} className="card">
              <div className="row-between">
                <strong>{i.category}</strong>
                <Chip tone={STATUS_TONE[i.status]}>{i.status}</Chip>
              </div>
              <p className="muted small">
                {i.id} · {site(i.site).short} · {i.screen} · {i.at}
              </p>
              <p>{i.text}</p>
              {i.resolution && (
                <p className="resolution">
                  <strong>Reply:</strong> {i.resolution}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
