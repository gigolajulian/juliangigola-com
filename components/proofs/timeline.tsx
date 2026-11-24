"use client";

/* ── a gallery's timeline on the desk ─────────────────────────────
 * Where a gallery stands,
 * from Sent to Downloaded, then when it closes. The line fills up to the
 * current stage and that stage's dot pulses once a beat. The violet stretch
 * is the reminder window (`remindState`), shown while a reminder can still go.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { closingSoon, remindState, type Proof } from "@/lib/proofs/proof-model";
import { useClock } from "@/components/proofs/use-clock";
import { TZ } from "@/lib/time-zone";

const short = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" }).format(new Date(iso));

type P = Pick<Proof, "email" | "sentAt" | "firstViewAt" | "submittedAt" | "pulledAt" | "deliveredAt" | "firstDownloadAt" | "closesAt" | "offline" | "reminded" | "selects" | "included">;

const CSS = `
.gtl{display:grid;grid-template-columns:repeat(6,minmax(0,1fr)) minmax(76px,1fr);margin:6px 0 2px}
.gtl-n{position:relative;padding:20px 6px 0 0;min-width:0}
.gtl-n::before{content:"";position:absolute;top:6px;left:0;right:0;height:1px;background:var(--color-border)}
.gtl-n.done::before{background:var(--color-text-primary);transform-origin:left;animation:gtl-fill .3s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(var(--i)*.18s + .1s)}
.gtl-d{position:absolute;top:0;left:0;z-index:1;width:13px;height:13px;border-radius:50%;background:var(--color-background-card,#111);border:1px solid var(--color-border)}
.gtl-n.done .gtl-d{background:var(--color-text-primary);border-color:var(--color-text-primary)}
.gtl-n.now .gtl-d{border:2px solid var(--color-text-primary)}
.gtl-n.done .gtl-d,.gtl-n.now .gtl-d{animation:gtl-pop .22s ease-out both;animation-delay:calc(var(--i)*.18s)}
.gtl-n.now .gtl-d::after{content:"";position:absolute;inset:-1px;border-radius:50%;border:1px solid var(--color-text-primary);opacity:0;animation:gtl-ring 2s ease-out infinite;animation-delay:calc(var(--i)*.18s + .3s)}
.gtl-n b,.gtl-c b{display:block;font-size:11.5px;font-weight:500;line-height:1.3;overflow-wrap:anywhere}
.gtl-n span,.gtl-c span{display:block;font-size:11px;color:var(--color-text-secondary)}
.gtl-c{position:relative;padding:20px 0 0 10px;border-left:1px dashed var(--color-border);min-width:0}
.gtl-c.soon b{color:var(--color-text-warning)}
.gtl-w{position:absolute;top:6px;left:0;right:0;height:1px;background:#8b7be8;animation:gtl-fade .4s ease-out both;animation-delay:1.1s}
.gtl-w i{position:absolute;right:0;top:-15px;font-style:normal;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#8b7be8;white-space:nowrap}
@keyframes gtl-fill{from{transform:scaleX(0)}}@keyframes gtl-pop{from{transform:scale(0)}}@keyframes gtl-fade{from{opacity:0}}
@keyframes gtl-ring{0%{transform:scale(1);opacity:.9}100%{transform:scale(2.8);opacity:0}}
@media (prefers-reduced-motion:reduce){.gtl-n::before,.gtl-d,.gtl-d::after,.gtl-w{animation:none!important}}
`;

export function Timeline({ p }: { p: P }) {
  const steps: [string, string | undefined][] = [
    ["Sent", p.sentAt],
    ["Opened", p.firstViewAt],
    ["Selects in", p.submittedAt],
    ["Editing", p.pulledAt],
    ["Finals sent", p.deliveredAt],
    ["Downloaded", p.firstDownloadAt],
  ];
  // A stage is reached when it or any later one has a stamp: a link shared by hand has no Sent, a delivery may skip Editing.
  const reached = (i: number) => steps.slice(i).some(([, at]) => !!at);
  const now = steps.findIndex((_, i) => !reached(i));
  // Days left, read after mount: the server and the browser can disagree near midnight.
  const clock = useClock();
  const left = clock ? closingSoon(p.closesAt, clock) : null;
  const remind = clock ? remindState(p, clock) : null;
  const windowShown = remind?.state === "ready" || remind?.state === "locked";
  return (
    <div className="gtl" role="list" aria-label="Where this gallery stands">
      <style>{CSS}</style>
      {steps.map(([label, at], i) => (
        <div key={label} role="listitem" className={`gtl-n${reached(i) ? " done" : ""}${i === now ? " now" : ""}`} style={{ "--i": i } as React.CSSProperties}>
          <i className="gtl-d" aria-hidden />
          <b>{label}</b>
          <span>{at ? short(at) : i === now ? (label === "Selects in" && p.selects.length ? `${p.selects.length} of ${p.included} picked` : "next") : reached(i) ? "done" : ""}</span>
        </div>
      ))}
      <div role="listitem" className={`gtl-c${left !== null ? " soon" : ""}`}>
        {windowShown ? <div className="gtl-w"><i>Remind window</i></div> : null}
        <b>{p.closesAt ? `Closes ${short(p.closesAt)}` : "Closes"}</b>
        <span>{p.closesAt ? (left !== null ? `${left} ${left === 1 ? "day" : "days"} left` : "") : "once sent"}</span>
      </div>
    </div>
  );
}
