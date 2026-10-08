import { useState } from "react";
import { ChevronRight, CircleCheck, CloudOff, Layers, PackagePlus, Plus, Send, Shuffle, Undo2, Users } from "lucide-react";
import { useNav } from "../App";
import { compare, unitsOf } from "../data/calc";
import { elsewhere, expectedLots, site, zoneWords } from "../data/repository";
import { useStore, type CountEntry } from "../data/store";
import type { SiteCode } from "../data/types";
import { Chip, Code, PageHead, Progress, Sheet, n } from "../ui/kit";

export default function StackView({ site: code, stack }: { site: SiteCode; stack: string }) {
  const go = useNav();
  const store = useStore();
  const s = site(code);
  const [confirm, setConfirm] = useState(false);
  const [comment, setComment] = useState("");

  const entries = store.entriesAt(code, stack);
  const state = store.stackState(code, stack);
  const locked = state?.state === "submitted" || state?.state === "approved";
  // Ibero: XBS says what should be here. Third party: only what's been counted on this stack.
  const lots = s.thirdParty
    ? expectedLots(code, stack).filter((l) => entries.some((e) => e.batch === l.batch))
    : expectedLots(code, stack);
  const extras = entries.filter((e) => (e.found || e.other) && e.by === store.me);
  const mineFor = (batch: string) => entries.find((e) => e.batch === batch && e.by === store.me);
  const theirsFor = (batch: string) => entries.find((e) => e.batch === batch && e.by !== store.me);
  const done = lots.filter((l) => mineFor(l.batch) || theirsFor(l.batch)).length;
  const back = s.thirdParty
    ? { label: s.short, onClick: () => go({ tab: "count", view: "site", site: code }) }
    : { label: "Floor map", onClick: () => go({ tab: "count", view: "site", site: "IBR" }) };

  return (
    <div className="page">
      <PageHead back={back} title={stack} code={!s.thirdParty} sub={s.thirdParty ? s.name : zoneWords(stack)} />

      {state?.state === "rejected" && (
        <div className="callout callout-crit">
          <Undo2 size={22} aria-hidden />
          <div>
            <strong>Sent back by {state.by} at {state.at}.</strong> {state.comment}
          </div>
        </div>
      )}
      {state && state.state !== "rejected" && (
        <div className="callout callout-ok">
          <CircleCheck size={22} aria-hidden />
          <div>
            <strong>{state.state === "approved" ? "Approved" : "Submitted"} at {state.at}.</strong>{" "}
            {state.state === "approved" ? "Nothing more to do here." : "Waiting for the supervisor. You can still view your counts."}
          </div>
        </div>
      )}

      {!s.thirdParty && (
        <section className="panel">
          <div className="row-between">
            <span className="h3">
              {done} of {lots.length} lots counted
            </span>
            <span className="muted">{n(lots.reduce((a, l) => a + l.units, 0))} units expected</span>
          </div>
          <Progress value={done} max={lots.length} />
        </section>
      )}

      {lots.some((l) => l.parts.some((p) => p.t === "B")) && (
        <div className="callout callout-info">
          <Layers size={22} aria-hidden />
          <div>Some lots are partly in a processing instruction. Count every bag of the lot you see; XBS adds both parts.</div>
        </div>
      )}

      <ul className="lots">
        {lots.map((lot) => {
          const mine = mineFor(lot.batch);
          const theirs = theirsFor(lot.batch);
          const e = mine ?? theirs;
          const c = e && compare(e, lot);
          const split = elsewhere(lot.head).length > 0;
          const tone = !e ? "todo" : c!.match ? "match" : "variance";
          return (
            <li key={lot.batch}>
              <button className={`lot lot-${tone}`} onClick={() => go({ tab: "count", view: "lot", site: code, stack, batch: lot.batch })}>
                <span className="lot-id">
                  <Code>{lot.head.o}</Code>
                  <span className="lot-grade">{lot.head.i}</span>
                </span>
                <span className="lot-qty">
                  {e ? (
                    <>
                      <span className="num">{unitsOf(e)}</span>
                      <span className="muted small">of {lot.units}</span>
                    </>
                  ) : (
                    <>
                      <span className="num muted">{lot.units}</span>
                      <span className="muted small">units</span>
                    </>
                  )}
                </span>
                <span className="lot-tags">
                  {!e && <Chip>Not counted</Chip>}
                  {e && c!.match && <Chip tone="ok">Matches</Chip>}
                  {e && !c!.match && <Chip tone="crit">{c!.headline}</Chip>}
                  {!mine && theirs && (
                    <Chip tone="info">
                      <Users size={14} aria-hidden /> {theirs.by}
                    </Chip>
                  )}
                  {e && !e.synced && (
                    <Chip tone="warn">
                      <CloudOff size={14} aria-hidden /> On phone
                    </Chip>
                  )}
                  {split && (
                    <Chip tone="warn">
                      <Shuffle size={14} aria-hidden /> Split lot
                    </Chip>
                  )}
                </span>
                <ChevronRight size={22} className="chev" aria-hidden />
              </button>
            </li>
          );
        })}
        {extras.map((e: CountEntry) => (
          <li key={e.batch}>
            <div className="lot lot-variance lot-static">
              <span className="lot-id">
                <Code>{e.other ? e.category : e.outturn}</Code>
                <span className="lot-grade">{e.grade}</span>
              </span>
              <span className="lot-qty">
                <span className="num">{unitsOf(e)}</span>
                <span className="muted small">units</span>
              </span>
              <span className="lot-tags">
                <Chip tone="warn">{e.other ? "Other stock" : "Found, not expected here"}</Chip>
              </span>
            </div>
          </li>
        ))}
      </ul>

      {!locked && (
        <div className="stack-actions">
          <button className="btn btn-block" onClick={() => go({ tab: "count", view: "add", site: code, stack })}>
            <Plus size={20} aria-hidden /> {s.thirdParty ? "Add a lot from the XBS list" : "Add a lot that isn't listed"}
          </button>
          <button className="btn btn-block" onClick={() => go({ tab: "count", view: "other", site: code, stack })}>
            <PackagePlus size={20} aria-hidden /> Sweepings, loose bags or other stock
          </button>
        </div>
      )}

      {!locked && (
        <div className="sticky-actions">
          <button className="btn btn-primary btn-xl btn-block" disabled={done < lots.length || !lots.length} onClick={() => setConfirm(true)}>
            <Send size={20} aria-hidden />{" "}
            {done < lots.length ? `Count ${lots.length - done} more to submit` : `Submit ${s.thirdParty ? "stack" : stack}`}
          </button>
        </div>
      )}

      {confirm && (
        <Sheet title={`Submit ${stack}?`} onClose={() => setConfirm(false)}>
          <p>
            {lots.length} lots
            {extras.length ? ` and ${extras.length} other item${extras.length === 1 ? "" : "s"}` : ""} go to the supervisor. You
            can't change them after this unless the stack is sent back.
          </p>
          <label className="field">
            <span className="field-label">Comment (optional)</span>
            <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything the supervisor should know" />
          </label>
          <button
            className="btn btn-primary btn-xl"
            onClick={() => {
              store.submitStack(code, stack, comment);
              setConfirm(false);
              go(s.thirdParty ? { tab: "count", view: "site", site: code } : { tab: "count", view: "home" });
            }}
          >
            Submit
          </button>
        </Sheet>
      )}
    </div>
  );
}
