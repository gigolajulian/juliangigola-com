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
 *
 * Julian 2026-11-08 (mock https://claude.ai/artifact/4SWWESHZZ3ScWgYDPsnEnb):
 * an email gate before the frames (any address opens it, and every pick
 * and look is logged under it for /admin), a review of the picks before
 * they go, and a walkthrough after Send in place of the bare receipt. No
 * notes. Time on the page and per-frame looks go out in one beacon every
 * 30 seconds and when the tab hides, never one request per frame.
 * ─────────────────────────────────────────────────────────────── */

const EMAIL_STORE = "proof-email";
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

type Step = null | "review" | "done";

/** A full-screen sheet: focus moves in, Tab stays inside, Escape closes, focus goes back to what opened it. */
function useDialog(active: boolean, close: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);
  const shut = React.useRef(close);
  React.useEffect(() => {
    shut.current = close;
  });
  React.useEffect(() => {
    if (!active) return;
    const back = document.activeElement as HTMLElement | null;
    const items = () => [...(ref.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? [])];
    items()[0]?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") return shut.current();
      if (e.key !== "Tab") return;
      const all = items();
      if (!all.length) return;
      const i = all.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); all[all.length - 1].focus(); }
      else if (!e.shiftKey && (i === -1 || i === all.length - 1)) { e.preventDefault(); all[0].focus(); }
    };
    addEventListener("keydown", k);
    return () => {
      removeEventListener("keydown", k);
      back?.focus?.();
    };
  }, [active]);
  return ref;
}

export function ProofGallery({ token, initial }: { token: string; initial: PublicProof }) {
  const { frames, included, price, balance } = initial;
  const [selects, setSelects] = React.useState<string[]>(initial.selects);
  const [email, setEmail] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(initial.submitted);
  const [view, setView] = React.useState<"all" | "selects">("all");
  const [open, setOpen] = React.useState<number | null>(null);
  const [step, setStep] = React.useState<Step>(initial.submitted ? "done" : null);
  const [showAll, setShowAll] = React.useState(false);
  const reviewRef = useDialog(step === "review", () => setStep(null));
  const gridRef = useDialog(showAll, () => setShowAll(false));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [paid, setPaid] = React.useState(initial.paid);
  const locked = step === "done";
  const swipe = React.useRef<number | null>(null);

  const n = selects.length;
  const extra = Math.max(0, n - included);
  // Same sums as owed() in lib/proofs: the shoot balance first, then extras; a reopened gallery owes only what is new.
  const balDue = Math.max(0, balance * 100 - initial.paid) / 100;
  const paidPastBal = Math.max(0, initial.paid - balance * 100);
  const due = balDue + Math.max(0, extra - (price ? Math.floor(paidPastBal / (price * 100)) : 0)) * price;
  const byId = React.useMemo(() => new Map(frames.map((f, i) => [f.id, i])), [frames]);
  const src = (id: string) => `/proof/${token}/f/${encodeURIComponent(id)}`;

  const post = React.useCallback((b: Record<string, unknown>) => fetch(`/api/proof/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), [token]);

  // A returning visitor skips the gate on this device.
  React.useEffect(() => {
    const saved = localStorage.getItem(EMAIL_STORE);
    if (saved && isEmail(saved)) enter(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  async function enter(address: string) {
    setEmail(address);
    localStorage.setItem(EMAIL_STORE, address);
    try {
      const out = (await (await post({ action: "track", email: address, kind: "open" })).json()) as { picks?: string[] };
      if (!initial.submitted && out.picks) setSelects(out.picks);
    } catch {}
    setReady(true);
  }

  // Save as they go, a beat after the last change. Skips the first render after the gate fills them in.
  const saved = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!ready || !email || locked) return;
    const key = selects.join(",");
    if (saved.current === null || saved.current === key) {
      saved.current = key;
      return;
    }
    const t = setTimeout(() => {
      saved.current = key;
      fetch(`/api/proof/${token}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, selects }) }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [selects, email, token, locked, ready]);

  // Looks: ms each frame spends mostly on screen or open big; flushed with the seconds on the page.
  const looks = React.useRef<Record<string, number>>({});
  const since = React.useRef<Map<string, number>>(new Map());
  const shown = React.useRef(Date.now());
  const big = React.useRef<{ id: string; at: number } | null>(null);
  React.useEffect(() => {
    if (!ready || !email) return;
    const add = (id: string, ms: number) => (looks.current[id] = (looks.current[id] ?? 0) + ms);
    const flush = (beacon = false) => {
      const now = Date.now();
      for (const [id, at] of since.current) {
        add(id, now - at);
        since.current.set(id, now);
      }
      if (big.current) {
        add(big.current.id, now - big.current.at);
        big.current.at = now;
      }
      const seconds = document.visibilityState === "visible" || beacon ? (now - shown.current) / 1000 : 0;
      shown.current = now;
      const body = { action: "track", email, looks: looks.current, seconds };
      looks.current = {};
      if (!seconds && !Object.keys(body.looks).length) return;
      if (beacon) navigator.sendBeacon?.(`/api/proof/${token}`, JSON.stringify(body));
      else post(body).catch(() => {});
    };
    const io = new IntersectionObserver(
      (es) => {
        const now = Date.now();
        for (const e of es) {
          const id = (e.target as HTMLElement).dataset.id!;
          if (e.isIntersecting) since.current.set(id, now);
          else if (since.current.has(id)) {
            add(id, now - since.current.get(id)!);
            since.current.delete(id);
          }
        }
      },
      { threshold: 0.6 },
    );
    document.querySelectorAll<HTMLElement>(".proof-cell[data-id]").forEach((el) => io.observe(el));
    const hide = () => (document.visibilityState === "hidden" ? flush(true) : (shown.current = Date.now()));
    const t = setInterval(() => flush(), 30_000);
    document.addEventListener("visibilitychange", hide);
    return () => {
      io.disconnect();
      clearInterval(t);
      document.removeEventListener("visibilitychange", hide);
      flush(true);
    };
  }, [ready, email, token, post, view, step]);

  // The lightbox counts as a long look at that frame.
  React.useEffect(() => {
    if (open === null) return;
    const id = frames[open].id;
    big.current = { id, at: Date.now() };
    return () => {
      if (big.current?.id === id) looks.current[id] = (looks.current[id] ?? 0) + Date.now() - big.current.at;
      big.current = null;
    };
  }, [open, frames]);

  const toggle = (id: string) => {
    if (locked) return;
    setSelects((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

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

  async function send(method: "bank" | "card" = "bank") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/proof/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, selects, method }) });
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

  const review = () => {
    setStep("review");
    if (email) post({ action: "track", email, kind: "review" }).catch(() => {});
  };

  const pad = (i: number) => String(i + 1).padStart(3, "0");
  const ordered = [...selects].sort((a, b) => (byId.get(a) ?? 0) - (byId.get(b) ?? 0));

  if (!ready)
    return (
      <div className="proof">
        <Top view={view} setView={setView} n={0} included={included} due={0} hideTabs />
        <Gate frames={frames.slice(0, 12).map((f) => src(f.id))} count={frames.length} onEnter={enter} />
      </div>
    );

  if (step === "done") {
    const sentOn = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date());
    return (
      <div className="proof">
        <Top view={view} setView={setView} n={n} included={included} due={0} hideTabs />
        <div className="proof-done">
          <div className="proof-side">
            <div>
              <p className="proof-lab">Sent · {sentOn}</p>
              <h1>Selects are in.</h1>
            </div>
            <div className="proof-thumbs">
              {ordered.slice(0, 5).map((id) => (
                // eslint-disable-next-line @next/next/no-img-element -- private frame
                <img key={id} src={src(id)} alt={`Frame ${(byId.get(id) ?? 0) + 1}`} />
              ))}
              {n > 5 ? <span>+{n - 5}</span> : null}
            </div>
            {/* Opens them as a photo grid, never a list in the side column (Julian 2026-11-09). */}
            <button type="button" className="proof-vs" onClick={() => setShowAll(true)}>
              View your {n} {n === 1 ? "select" : "selects"} →
            </button>
          </div>
          <div className="proof-side">
            <ol className="proof-steps">
              <li data-on>
                <span>01</span>
                <b>Received</b>
                <p>{n} {n === 1 ? "frame" : "frames"}. A copy is in your inbox.</p>
              </li>
              <li>
                <span>02</span>
                <b>Editing</b>
                <p>I retouch each select by hand.</p>
              </li>
              <li data-dim>
                <span>03</span>
                <b>Delivery</b>
                <p>Full-resolution finals by email, a link to download them all.</p>
              </li>
            </ol>
            {paid ? (
              <div className="proof-paid">
                <p className="proof-lab">Paid</p>
                {balance ? (
                  <p>
                    <span>Shoot balance</span>
                    <b>${balance}</b>
                  </p>
                ) : null}
                {paid > balance * 100 ? (
                  <p>
                    <span>{price ? Math.round((paid / 100 - balance) / price) : 0} extra × ${price}</span>
                    <b>${(paid / 100 - balance).toFixed(0)}</b>
                  </p>
                ) : null}
                <p>
                  <span>Total</span>
                  <b>${(paid / 100).toFixed(0)} ✓</b>
                </p>
                <p className="proof-mu">{initial.paidPending ? "Bank payment through Stripe. It clears in about 4 business days; nothing else to do." : "Paid through Stripe. The receipt is in your inbox."}</p>
              </div>
            ) : null}
            <p className="proof-mu">
              Questions? <a href="mailto:hello@juliangigola.com">hello@juliangigola.com</a>
            </p>
          </div>
        </div>
        {showAll ? (
          <div ref={gridRef} className="proof-over" role="dialog" aria-modal="true" aria-label="Your selects">
            <div className="proof-rhead">
              <div>
                <p className="proof-lab">Your selects</p>
                <h1>{n} {n === 1 ? "frame" : "frames"}.</h1>
              </div>
              <div className="proof-acts">
                <button type="button" className="proof-btn ghost" onClick={() => setShowAll(false)}>
                  Back
                </button>
              </div>
            </div>
            <div className="proof-rgrid">
              {ordered.map((id, k) => (
                <div key={id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- private frame */}
                  <img src={src(id)} alt={`Select ${k + 1}`} />
                  <i>{k + 1}</i>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

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
                data-id={f.id}
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
          <b>{n} selected</b> · {included} included · {extra} extra{balDue ? ` · $${balDue} balance` : ""} · <b>${due}</b>
        </p>
        <div className="proof-acts">
          <button type="button" className="proof-btn ghost" onClick={() => { setView(view === "all" ? "selects" : "all"); scrollTo({ top: 0, behavior: "smooth" }); }}>
            {view === "all" ? "View selects" : "Back to all"}
          </button>
          <button type="button" className="proof-btn" disabled={!n} onClick={review}>
            {due ? `Send selects · Pay $${due}` : "Send selects"}
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
            <span>{selects.includes(frames[open].id) ? `Pick ${selects.indexOf(frames[open].id) + 1}` : ""}</span>
            <button type="button" className={`proof-btn${selects.includes(frames[open].id) ? " ghost" : ""}`} onClick={() => toggle(frames[open].id)}>
              {selects.includes(frames[open].id) ? "Selected ✓" : "Select"}
            </button>
          </div>
        </div>
      ) : null}

      {step === "review" ? (
        <div ref={reviewRef} className="proof-over" role="dialog" aria-modal="true" aria-label="Review your selects">
          <div className="proof-rhead">
            <div>
              <p className="proof-lab">Your selects</p>
              <h1>{n} {n === 1 ? "frame" : "frames"}.</h1>
            </div>
            <div className="proof-acts">
              <button type="button" className="proof-btn ghost" onClick={() => setStep(null)}>
                Back to frames
              </button>
              {due ? (
                <button type="button" className="proof-btn ghost" disabled={busy} onClick={() => send("card")}>
                  Pay by card
                </button>
              ) : null}
              <button type="button" className="proof-btn" disabled={busy} onClick={() => send()}>
                {busy ? "Sending" : due ? `Pay $${due} by bank` : `Send ${n} ${n === 1 ? "select" : "selects"}`}
              </button>
            </div>
          </div>
          <p className="proof-rsum">
            {balDue ? <span>Shoot balance ${balDue}</span> : null}
            <span>{Math.min(n, included)} included</span>
            {extra ? <span>{extra} extra × ${price}</span> : null}
            <b>{due ? `$${due}` : "Nothing to pay"}</b>
          </p>
          {error ? <p className="proof-err" role="alert">{error}</p> : null}
          <div className="proof-rgrid">
            {selects.map((id, k) => (
              <div key={id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- private frame */}
                <img src={src(id)} alt={`Pick ${k + 1}`} />
                <i>{k + 1}</i>
              </div>
            ))}
          </div>
          {due ? <p className="proof-stripe">Pay by bank through Stripe: sign in to your bank, it clears in about 4 business days. Card works too. Selects lock once you send.</p> : <p className="proof-stripe">Selects lock once you send.</p>}
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

/** Before the frames: any email opens the gallery, and picks are kept under it. */
function Gate({ frames, count, onEnter }: { frames: string[]; count: number; onEnter: (email: string) => void }) {
  const [value, setValue] = React.useState("");
  const [bad, setBad] = React.useState(false);
  return (
    <div className="proof-gate">
      <div className="proof-wall" aria-hidden="true">
        {frames.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- private frame, blurred behind the gate
          <img key={i} src={u} alt="" />
        ))}
      </div>
      <form
        className="proof-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (isEmail(value)) onEnter(value.trim());
          else setBad(true);
        }}
      >
        <div>
          <p className="proof-lab">Proofs · {count} frames</p>
          <h1>Pick your proofs.</h1>
        </div>
        <label>
          <span className="proof-lab">Your email</span>
          <input type="email" inputMode="email" autoComplete="email" required value={value} onChange={(e) => { setValue(e.target.value); setBad(false); }} placeholder="you@email.com" aria-invalid={bad || undefined} />
        </label>
        {bad ? <p className="proof-err" role="alert">That email does not look right.</p> : null}
        <button type="submit" className="proof-btn">Open gallery</button>
        <p className="proof-mu">Any email opens it. Your picks are logged under this address, and they are still here when you come back.</p>
      </form>
    </div>
  );
}
