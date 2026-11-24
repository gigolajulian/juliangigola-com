"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { Check, Failed, Hidden, NEED_MSG, checkYou, first, useEnquiry } from "@/components/enquiry/flow";
import { CHIP_TYPE, QUOTE_OPTS, type QuoteOpt } from "@/lib/home/data";
import type { InquiryMode } from "./ctx";

/* Spec 3.11: the quick note over a dim layer (a bottom sheet on phones),
   posted through the site's enquiry action (`useEnquiry`, the same one
   /contact uses). Two titles: "Contact me" from the footer phrase, "Inquire"
   from By quote and the footer's Inquire links. The chip and "When is it?"
   ride in `detail`. Radix Dialog traps focus and returns it to the opener. */

const CALL_CHIP = "Music video";
/* The typed fields last the visit, through a full close and reopen; a send clears them. */
const DRAFT = "mt-inq-draft";
const EMPTY = { name: "", email: "", when: "", message: "" };
const readDraft = (): typeof EMPTY => {
  try {
    return { ...EMPTY, ...JSON.parse(sessionStorage.getItem(DRAFT) ?? "{}") };
  } catch {
    return EMPTY;
  }
};

function Form({ from, opt, reply, onClose }: { from: InquiryMode; opt?: QuoteOpt; reply: string | null; onClose: () => void }) {
  const router = useRouter();
  const { state, pending, sent, send } = useEnquiry();
  const [chip, setChip] = React.useState(opt?.chips[0] ?? "");
  const [v, setV] = React.useState(readDraft);
  const [err, setErr] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    try {
      if (sent) sessionStorage.removeItem(DRAFT);
      else sessionStorage.setItem(DRAFT, JSON.stringify(v));
    } catch {}
  }, [v, sent]);
  const quote = from === "quote" && opt;
  const call = quote && chip === CALL_CHIP;
  // typing in a field takes its error line away; the next Send checks it again
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setV({ ...v, [k]: e.target.value });
    if (err[k]) setErr({ ...err, [k]: "" });
  };
  const fld = (k: keyof typeof v, label: string, el: React.ReactElement<{ placeholder?: string }>, req = true) => (
    <div className={err[k] ? "fld bad" : "fld"}>
      <label className="lbl mute" htmlFor={`mq-${k}`}>
        <span>
          {label}
          {req ? <span className="req" aria-hidden="true"> *</span> : null}
        </span>
      </label>
      {el}
      {err[k] ? <p className="lbl mt-fe" id={`mq-${k}-err`} role="alert">{err[k]}</p> : null}
    </div>
  );
  const input = (k: keyof typeof v, extra: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input id={`mq-${k}`} name={k === "when" ? undefined : k} value={v[k]} onChange={set(k)} aria-invalid={!!err[k] || undefined} aria-describedby={err[k] ? `mq-${k}-err` : undefined} {...extra} />
  );
  const detail = quote ? [`${opt.name}${chip ? `: ${chip}` : ""}`, v.when.trim() && `When: ${v.when.trim()}`].filter(Boolean).join(" · ").slice(0, 200) : undefined;
  const type = quote ? (CHIP_TYPE[chip] ?? opt.type ?? "other") : "other";
  if (sent)
    return (
      <div className="mt-sent" role="status">
        <span className="f-ok lbl"><Check />Sent</span>
        <Dialog.Title className="mt-card-t">Sent</Dialog.Title>
        <p className="mute">{v.name.trim() ? `Thanks, ${first(v.name)}. ` : ""}A copy is in your inbox.</p>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
    );
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (call) return router.push(opt.call);
        const bad = checkYou(v.name, v.email);
        if (!v.message.trim()) bad.message = NEED_MSG;
        setErr(bad);
        const form = e.currentTarget;
        if (Object.keys(bad).length) return form.querySelector<HTMLElement>(`#mq-${Object.keys(bad)[0]}`)?.focus();
        send(form);
      }}
    >
      <Hidden type={type} detail={detail} />
      <Dialog.Title className="mt-card-t">{quote ? "Inquire" : "Contact me"}</Dialog.Title>
      <Dialog.Description className="mt-card-l">{quote ? `${opt.name}. A few lines is enough.` : "A few lines is enough. Dates and a reference help."}</Dialog.Description>
      {quote && opt.chips.length ? (
        <div className="mt-chips lbl" role="group" aria-label="What it is">
          {opt.chips.map((c) => (
            <button key={c} type="button" aria-pressed={c === chip} onClick={() => setChip(c)}>{c}</button>
          ))}
        </div>
      ) : null}
      {call ? (
        <p className="mt-card-note">Music videos start with a free 15 minute call. Pick a time on the next step.</p>
      ) : (
        <>
          <div className="mt-two">
            {fld("name", "Name", input("name", { autoComplete: "name", placeholder: "Your name", "aria-required": true }))}
            {fld("email", "Email", input("email", { type: "email", autoComplete: "email", placeholder: "you@email.com", "aria-required": true }))}
          </div>
          {quote ? fld("when", "When is it?", input("when", { placeholder: "A date, a month, or not sure yet" }), false) : null}
          {fld("message", "Message", <textarea id="mq-message" name="message" rows={4} placeholder="What are you planning, and when?" value={v.message} onChange={set("message")} aria-invalid={!!err.message || undefined} aria-describedby={err.message ? "mq-message-err" : undefined} aria-required />)}
          <Failed state={state} />
        </>
      )}
      <button className="btn fill mt-send" type="submit" disabled={pending}>{call ? "Pick a call time" : quote ? "Send" : "Send note"}</button>
      {reply ? <p className="lbl mute mt-reply">Replies {reply}</p> : null}
      {!quote ? (
        <p className="lbl mute mt-talk">
          Prefer to talk? <Link href="/book/consultation">15 min call</Link> <i aria-hidden>|</i> <Link href="/contact/form">Full inquiry form</Link> <i aria-hidden>|</i> <a href="mailto:hello@juliangigola.com">Email</a>
        </p>
      ) : null}
    </form>
  );
}

/* ?mttp=sheet, phones: the handle drags the sheet down. Past 110px, or a quick flick, it closes; shorter, it springs back, so a half-typed note survives a slip.
   Only the handle drags: the card's own scroll is left alone. */
function Handle({ onClose }: { onClose: () => void }) {
  const drag = React.useRef<{ y: number; t: number } | null>(null);
  const card = (e: React.PointerEvent) => e.currentTarget.closest<HTMLElement>(".mt-card");
  const back = (c: HTMLElement | null) => {
    if (!c) return;
    c.style.transition = "translate .3s cubic-bezier(.32, .72, 0, 1)";
    c.style.translate = "";
  };
  return (
    <span
      className="mt-handle"
      aria-hidden
      onPointerDown={(e) => {
        if (!matchMedia("(max-width: 599px)").matches) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, t: performance.now() };
        const c = card(e);
        if (c) c.style.transition = "none";
      }}
      onPointerMove={(e) => {
        const c = card(e);
        if (drag.current && c) c.style.translate = `0 ${Math.max(0, e.clientY - drag.current.y)}px`;
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d) return;
        drag.current = null;
        const dy = e.clientY - d.y, v = dy / Math.max(1, performance.now() - d.t);
        if (dy > 110 || (dy > 24 && v > 0.6)) onClose();
        else back(card(e));
      }}
      onPointerCancel={(e) => {
        drag.current = null;
        back(card(e));
      }}
    />
  );
}

export function InquiryCard({ open, reply, onClose, onBack }: { open: { from: InquiryMode; opt?: QuoteOpt["key"] } | null; reply: string | null; onClose: () => void; onBack: () => void }) {
  const opt = QUOTE_OPTS.find((o) => o.key === open?.opt);
  return (
    <Dialog.Root open={!!open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <div className="v3 contents">
          <Dialog.Overlay className="mt-dim mt-dim-q" data-lenis-prevent />
          <Dialog.Content className="mt-card mt-inq" data-from={open?.from} data-lenis-prevent onCloseAutoFocus={(e) => { e.preventDefault(); onBack(); }}>
            <Handle onClose={onClose} />
            <Dialog.Close className="mt-close-t" aria-label="Close">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            </Dialog.Close>
            {open ? <Form key={`${open.from}-${open.opt}`} from={open.from} opt={opt} reply={reply} onClose={onClose} /> : null}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
