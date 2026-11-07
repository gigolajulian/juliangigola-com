"use client";

import * as React from "react";
import Link from "next/link";
import type { PublicProof } from "@/lib/proofs";

/* ── the client's gallery ─────────────────────────────────────────
 * The look Julian approved 2026-11-06 (mock https://claude.ai/artifact/Nn3EU21DEofuLLJyXJHtcG):
 * sticky bar with the wordmark, All and Selects, and "n / 10"; a masonry
 * grid; a selected frame gets a cyan ring and its pick number; the bottom
 * bar with the running total slides up after the first select. Selects
 * save as they change, so a reload keeps them. The watermark is in the
 * JPEGs (Lightroom bakes it in), never drawn here. Theme follows the
 * site's tokens, so light or dark follows the system.
 * ─────────────────────────────────────────────────────────────── */

type Step = null | "review" | "done";

export function ProofGallery({ token, initial }: { token: string; initial: PublicProof }) {
  const { frames, included, price } = initial;
  const [selects, setSelects] = React.useState<string[]>(initial.selects);
  const [notes, setNotes] = React.useState<Record<string, string>>(initial.notes);
  const [view, setView] = React.useState<"all" | "selects">("all");
  const [open, setOpen] = React.useState<number | null>(null);
  const [step, setStep] = React.useState<Step>(initial.submitted ? "done" : null);
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [paid, setPaid] = React.useState(initial.paid);
  const locked = step === "done";
  const swipe = React.useRef<number | null>(null);

  const n = selects.length;
  const extra = Math.max(0, n - included);
  // A reopened gallery owes only for extras past what was already paid.
  const due = Math.max(0, extra - (price ? Math.floor(initial.paid / (price * 100)) : 0)) * price;
  const byId = React.useMemo(() => new Map(frames.map((f, i) => [f.id, i])), [frames]);
  const src = (id: string) => `/proof/${token}/f/${encodeURIComponent(id)}`;

  // Save as they go, a beat after the last change.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current || locked) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/proof/${token}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ selects, notes }) }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [selects, notes, token, locked]);

  const toggle = (id: string) => {
    if (locked) return;
    setSelects((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  const note = (id: string, v: string) =>
    setNotes((o) => {
      const next = { ...o };
      if (v.trim()) next[id] = v;
      else delete next[id];
      return next;
    });

  // Lightbox keys.
  React.useEffect(() => {
    if (open === null) return;
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i + frames.length - 1) % frames.length));
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % frames.length));
      if (e.key === " ") {
        e.preventDefault();
        toggle(frames[open].id);
      }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/proof/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selects, notes, message }) });
      const out = (await res.json()) as { checkout?: string; done?: boolean; paid?: number; error?: string };
      if (out.checkout) return void (location.href = out.checkout);
      if (!res.ok || !out.done) throw new Error(out.error ?? "That did not go through. Try again.");
      setPaid(out.paid ?? 0);
      setStep("done");
      scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const pad = (i: number) => String(i + 1).padStart(3, "0");
  const ordered = [...selects].sort((a, b) => (byId.get(a) ?? 0) - (byId.get(b) ?? 0));

  if (step === "done")
    return (
      <div className="proof">
        <Top view={view} setView={setView} n={n} included={included} due={due} hideTabs />
        <div className="proof-sheet">
          <p className="proof-lab">Sent</p>
          <h1>Selects are in.</h1>
          <p className="proof-mu">
            I have your {n} {n === 1 ? "frame" : "frames"}
            {Object.keys(notes).length ? " and your notes" : ""}.{paid ? ` Paid $${(paid / 100).toFixed(2)}.` : ""} A copy is in your email. I&apos;ll email you when the finals are ready.
          </p>
          <div className="proof-rows">
            {ordered.map((id) => (
              <div key={id}>
                <span>{frames[byId.get(id) ?? 0]?.file}</span>
                <span>{notes[id] ? "note" : ""}</span>
              </div>
            ))}
          </div>
          <p className="proof-mu">
            Questions? <a href="mailto:hello@juliangigola.com">hello@juliangigola.com</a>
          </p>
        </div>
      </div>
    );

  return (
    <div className="proof">
      <Top view={view} setView={setView} n={n} included={included} due={due} />

      <div className="proof-intro">
        <p className="proof-lab">Proofs</p>
        <h1>Pick your proofs.</h1>
      </div>

      {view === "all" ? (
        <div className="proof-grid">
          {frames.map((f, i) => {
            const at = selects.indexOf(f.id);
            return (
              <div
                key={f.id}
                className="proof-cell"
                data-on={at >= 0 || undefined}
                role="button"
                tabIndex={0}
                aria-pressed={at >= 0}
                aria-label={`Frame ${i + 1}`}
                onClick={() => toggle(f.id)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    toggle(f.id);
                  }
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- private frames from the Worker, not the image CDN */}
                <img src={src(f.id)} alt="" loading={i < 8 ? "eager" : "lazy"} width={f.w || undefined} height={f.h || undefined} draggable={false} />
                {notes[f.id] ? <span className="proof-nt">Note</span> : null}
                <span className="proof-no">{pad(i)}</span>
                <span className="proof-mark">{at >= 0 ? at + 1 : ""}</span>
                <button
                  type="button"
                  className="proof-zoom"
                  aria-label={`Open frame ${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(i);
                  }}
                >
                  Open
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="proof-sel">
          {!n ? (
            <p className="proof-empty">No selects yet.</p>
          ) : (
            <>
              <p className="proof-x">
                {n} selected · {n > included ? `${extra} past the ${included} included` : `${included - n} left of the ${included} included`}
              </p>
              {ordered.map((id) => {
                const i = byId.get(id) ?? 0;
                return (
                  <div className="proof-srow" key={id}>
                    <button type="button" onClick={() => setOpen(i)} aria-label={`Open frame ${i + 1}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- private frame */}
                      <img src={src(id)} alt="" />
                    </button>
                    <div>
                      <p className="proof-fn">
                        {pad(i)} <span>· {frames[i].file}</span>
                      </p>
                      <textarea value={notes[id] ?? ""} onChange={(e) => note(id, e.target.value)} placeholder="Note for the edit" maxLength={500} aria-label={`Note for frame ${i + 1}`} />
                    </div>
                    <button type="button" className="proof-rm" onClick={() => toggle(id)}>
                      Remove
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      <div className="proof-bar" data-empty={!n || undefined}>
        <p className="proof-sum">
          <b>{n} selected</b> · {included} included · {extra} extra · <b>${due}</b>
        </p>
        <div className="proof-acts">
          <button type="button" className="proof-btn ghost" onClick={() => { setView(view === "all" ? "selects" : "all"); scrollTo({ top: 0, behavior: "smooth" }); }}>
            {view === "all" ? "View selects" : "Back to all"}
          </button>
          <button type="button" className="proof-btn" disabled={!n} onClick={() => setStep("review")}>
            {extra ? `Send selects · Pay $${due}` : "Send selects"}
          </button>
        </div>
      </div>

      {open !== null ? (
        <div className="proof-lb" role="dialog" aria-modal="true" aria-label={`Frame ${open + 1}`}>
          <div className="proof-lt">
            <span>
              {pad(open)} / {frames.length} · {frames[open].file}
            </span>
            <button type="button" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
          <div
            className="proof-li"
            onTouchStart={(e) => (swipe.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - (swipe.current ?? e.changedTouches[0].clientX);
              if (Math.abs(dx) > 50) setOpen((open + (dx < 0 ? 1 : frames.length - 1)) % frames.length);
              swipe.current = null;
            }}
          >
            <button type="button" className="proof-arr l" aria-label="Previous" onClick={() => setOpen((open + frames.length - 1) % frames.length)}>
              &larr;
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- private frame */}
            <img src={src(frames[open].id)} alt={`Frame ${open + 1}`} />
            <button type="button" className="proof-arr r" aria-label="Next" onClick={() => setOpen((open + 1) % frames.length)}>
              &rarr;
            </button>
          </div>
          <div className="proof-lf">
            <input value={notes[frames[open].id] ?? ""} onChange={(e) => note(frames[open].id, e.target.value)} placeholder="Note for the edit" maxLength={500} disabled={!selects.includes(frames[open].id)} aria-label="Note for the edit" />
            <button type="button" className={`proof-btn${selects.includes(frames[open].id) ? " ghost" : ""}`} onClick={() => toggle(frames[open].id)}>
              {selects.includes(frames[open].id) ? "Selected ✓" : "Select"}
            </button>
          </div>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="proof-sheet proof-over" role="dialog" aria-modal="true" aria-label="Send selects">
          <p className="proof-lab">Send selects</p>
          <h1>{n} frames.</h1>
          <p className="proof-mu">
            {extra ? `${included} included, ${extra} extra at $${price} each.` : "All included."} Selects lock once you send.
          </p>
          <div className="proof-rows">
            <div><span>Selected</span><span>{n}</span></div>
            <div><span>Included</span><span>{included}</span></div>
            <div><span>Extra</span><span>{extra} × ${price}</span></div>
            <div><span>Due now</span><span>${due}.00</span></div>
          </div>
          <div className="proof-files">
            {ordered.map((id) => (
              <p key={id}>
                <i>{frames[byId.get(id) ?? 0]?.file}</i>
                {notes[id] ? ` · ${notes[id]}` : ""}
              </p>
            ))}
          </div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Anything else" maxLength={1000} aria-label="Anything else" />
          {error ? <p className="proof-err" role="alert">{error}</p> : null}
          <div className="proof-acts">
            <button type="button" className="proof-btn" disabled={busy} onClick={send}>
              {busy ? "Sending" : extra ? `Pay $${due} and send` : "Send selects"}
            </button>
            <button type="button" className="proof-btn ghost" onClick={() => setStep(null)}>
              Back to frames
            </button>
          </div>
          {extra ? <p className="proof-stripe">Card payment through Stripe.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function Top({ view, setView, n, included, due, hideTabs }: { view: "all" | "selects"; setView: (v: "all" | "selects") => void; n: number; included: number; due: number; hideTabs?: boolean }) {
  return (
    <header className="proof-top">
      <Link className="proof-word" href="/">Julian Gigola</Link>
      {hideTabs ? <span /> : (
        <nav className="proof-tabs" aria-label="Frames">
          <button type="button" data-on={view === "all" || undefined} onClick={() => setView("all")}>All</button>
          <button type="button" data-on={view === "selects" || undefined} onClick={() => setView("selects")}>
            Selects <span className="proof-pill" data-on={n > 0 || undefined}>{n}</span>
          </button>
        </nav>
      )}
      <p className="proof-meta" data-over={due > 0 || undefined}>
        <b>{n}</b> / {included}
        {due ? ` · +$${due}` : ""}
      </p>
    </header>
  );
}
