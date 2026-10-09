import { useState } from "react";
import { CircleCheck, CloudOff, Layers, PackagePlus, Plus, Undo2 } from "lucide-react";
import { useNav } from "../App";
import { compare, unitsOf } from "../data/calc";
import { elsewhere, expectedLots, site, zoneWords } from "../data/repository";
import { useStore } from "../data/store";
import type { SiteCode } from "../data/types";
import { ActionBar, Code, Notice, PageHead, Progress, Row, Section, Sheet, StatusIcon, n } from "../ui/kit";

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
  const entryFor = (batch: string) => entries.find((e) => e.batch === batch && e.by === store.me) ?? entries.find((e) => e.batch === batch);
  const done = lots.filter((l) => entryFor(l.batch)).length;
  const left = lots.length - done;
  const back = s.thirdParty
    ? { label: s.short, onClick: () => go({ tab: "count", view: "site", site: code }) }
    : { label: "Floor map", onClick: () => go({ tab: "count", view: "site", site: "IBR" }) };

  return (
    <div className="page has-actionbar">
      <PageHead back={back} title={stack} code={!s.thirdParty} sub={s.thirdParty ? s.name : zoneWords(stack)} />

      {!s.thirdParty && lots.length > 0 && (
        <div className="progress-line">
          <Progress value={done} max={lots.length} />
          <span>
            {done} of {lots.length} lots
          </span>
        </div>
      )}

      {state?.state === "rejected" && (
        <Notice tone="crit" icon={<Undo2 size={18} />} title={`Sent back by ${state.by?.replace(" (Supervisor)", "")}`}>
          {state.comment}
        </Notice>
      )}
      {state && state.state !== "rejected" && (
        <Notice tone="ok" icon={<CircleCheck size={18} />} title={state.state === "approved" ? "Approved" : `Submitted at ${state.at}`}>
          {state.state === "approved" ? "Nothing more to do here." : "Waiting for your supervisor."}
        </Notice>
      )}
      {lots.some((l) => l.parts.some((p) => p.t === "B")) && !locked && (
        <Notice tone="info" icon={<Layers size={18} />}>
          Some lots are partly in processing. Count every bag you see; XBS adds both parts.
        </Notice>
      )}

      <Section title={s.thirdParty ? "Counted on this stack" : "Lots on this stack"}>
        {lots.map((lot) => {
          const e = entryFor(lot.batch);
          const c = e && compare(e, lot);
          const notes = [
            e && e.by !== store.me && `Counted by ${e.by}`,
            elsewhere(lot.head).length > 0 && "Split lot",
            e && !e.synced && "Saved on phone",
          ].filter(Boolean);
          return (
            <Row
              key={lot.batch}
              lead={<StatusIcon s={!e ? "todo" : c!.match ? "match" : "variance"} />}
              title={
                <>
                  <Code>{lot.head.o}</Code> <span className="row-tag">{lot.head.i}</span>
                </>
              }
              sub={
                <>
                  {e && !c!.match ? <span className="t-crit">{c!.headline}</span> : e ? "Matches XBS" : `${lot.units} units expected`}
                  {notes.length > 0 && ` · ${notes.join(" · ")}`}
                  {e && !e.synced && <CloudOff size={13} className="inline-icon" aria-hidden />}
                </>
              }
              trail={
                e ? (
                  <span className="qty">
                    <strong>{unitsOf(e)}</strong>
                    <span>/ {lot.units}</span>
                  </span>
                ) : undefined
              }
              onClick={() => go({ tab: "count", view: "lot", site: code, stack, batch: lot.batch })}
            />
          );
        })}
        {extras.map((e) => (
          <Row
            key={e.batch}
            lead={<StatusIcon s="variance" />}
            title={e.other ? e.category : <Code>{e.outturn}</Code>}
            sub={e.other ? "Other stock" : "Found here, not expected"}
            trail={
              <span className="qty">
                <strong>{unitsOf(e)}</strong>
                <span>units</span>
              </span>
            }
          />
        ))}
        {!lots.length && !extras.length && <p className="empty">Nothing counted yet. Add the first lot below.</p>}
      </Section>

      {!locked && (
        <div className="tile-row">
          <button className="tile" onClick={() => go({ tab: "count", view: "add", site: code, stack })}>
            <Plus size={20} aria-hidden />
            <span>{s.thirdParty ? "Add a lot" : "Lot not listed"}</span>
          </button>
          <button className="tile" onClick={() => go({ tab: "count", view: "other", site: code, stack })}>
            <PackagePlus size={20} aria-hidden />
            <span>Sweepings & other</span>
          </button>
        </div>
      )}

      {!locked && (
        <ActionBar>
          <button className="btn btn-primary btn-lg btn-block" disabled={left > 0 || !lots.length} onClick={() => setConfirm(true)}>
            {left > 0 ? `${left} lot${left === 1 ? "" : "s"} left to count` : `Submit ${s.thirdParty ? "stack" : stack}`}
          </button>
        </ActionBar>
      )}

      {confirm && (
        <Sheet title={`Submit ${stack}?`} onClose={() => setConfirm(false)}>
          <p className="muted">
            {lots.length} lots{extras.length ? ` and ${extras.length} other item${extras.length === 1 ? "" : "s"}` : ""} go to your supervisor. You
            can't change them unless the stack is sent back.
          </p>
          <label className="field">
            <span className="label">Comment for the supervisor (optional)</span>
            <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              store.submitStack(code, stack, comment);
              setConfirm(false);
              go(s.thirdParty ? { tab: "count", view: "site", site: code } : { tab: "count", view: "home" });
            }}
          >
            Submit {n(lots.length)} lots
          </button>
        </Sheet>
      )}
    </div>
  );
}
