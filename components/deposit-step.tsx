"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── the deposit ─────────────────────────────────────────────────────
 * Julian (2026-10-16), behind `?deposit`: a paid session's $100 deposit
 * taken in the card, after its form, in place of Cal.com's own checkout.
 * Stripe's Payment Element, dressed as the site (its Appearance API).
 * The server side is JG - BACKEND's: POST /api/deposit makes the
 * PaymentIntent (and says 409 when the time has gone), its webhook books
 * Cal.com, GET /api/deposit/<id> says how that went.
 * ─────────────────────────────────────────────────────────────────── */

type Stripe = {
  elements: (o: object) => Elements;
  confirmPayment: (o: object) => Promise<{ error?: { type: string; message?: string } }>;
};
type Elements = {
  create: (t: "payment", o?: object) => { mount: (el: HTMLElement) => void; on: (e: string, f: () => void) => void; destroy: () => void };
  update: (o: object) => void;
  submit: () => Promise<{ error?: { message?: string } }>;
};
declare global {
  interface Window {
    Stripe?: (key: string) => Stripe;
  }
}

const AMOUNT = 10000; // cents; the server charges this whatever is sent

let stripe: Promise<Stripe> | null = null;
/** Stripe.js from Stripe, once, as it asks to be loaded. */
function loadStripe() {
  stripe ??= new Promise<Stripe>((ok, no) => {
    const go = () => {
      try {
        ok(window.Stripe!(process.env.NEXT_PUBLIC_STRIPE_PK!));
      } catch (e) {
        stripe = null;
        no(e);
      }
    };
    if (window.Stripe) return go();
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.onload = go;
    s.onerror = () => {
      stripe = null;
      no(new Error("stripe"));
    };
    document.head.append(s);
  });
  return stripe;
}

/** A CSS color as Stripe reads it (the site's tokens are oklch). */
function rgb(css: string) {
  const c = document.createElement("canvas").getContext("2d")!;
  c.fillStyle = css;
  c.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
}

/** The card's own look, read off the page so it follows light and dark. */
function appearance(el: HTMLElement) {
  const s = getComputedStyle(el);
  const v = (n: string) => rgb(s.getPropertyValue(n).trim());
  const [fg, muted, line, accent] = [v("--foreground"), v("--muted-foreground"), v("--border"), v("--accent")];
  return {
    theme: "flat",
    labels: "above",
    variables: {
      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      fontSizeBase: "16px",
      colorPrimary: accent,
      colorBackground: v("--background"),
      colorText: fg,
      colorTextSecondary: muted,
      colorTextPlaceholder: muted,
      colorDanger: accent,
      borderRadius: "2px",
      spacingUnit: "4px",
      gridRowSpacing: "20px",
      gridColumnSpacing: "24px",
    },
    // The form's own fields: a hairline under, nothing else.
    rules: {
      ".Label": { fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: muted, marginBottom: "8px" },
      ".Input": { backgroundColor: "transparent", border: "none", borderBottom: `1px solid ${line}`, borderRadius: "0", boxShadow: "none", padding: "8px 0" },
      ".Input:focus": { borderBottomColor: fg, boxShadow: "none" },
      ".Input--invalid": { borderBottomColor: accent, boxShadow: "none" },
      ".Tab": { backgroundColor: "transparent", border: `1px solid ${line}`, boxShadow: "none" },
      ".Tab--selected, .Tab--selected:focus, .Tab--selected:hover": { borderColor: fg, boxShadow: "none" },
      ".Error": { fontSize: "13px" },
    },
  };
}

export type DepositBody = {
  slug: string;
  start: string;
  timeZone: string;
  name: string;
  email: string;
  notes?: string;
  where?: string;
  session?: string;
};

type Stage = "loading" | "ready" | "paying" | "confirming" | "taken" | "refunded" | "failed" | "slow" | "broken";

export function DepositStep({
  body,
  rows,
  onBooked,
  onTaken,
  className,
}: {
  className?: string;
  body: DepositBody;
  rows: [string, string][];
  onBooked: () => void;
  /** The time went before the payment: back to the times. */
  onTaken: () => void;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const field = React.useRef<HTMLDivElement>(null);
  const els = React.useRef<{ stripe: Stripe; elements: Elements } | null>(null);
  const [stage, setStage] = React.useState<Stage>("loading");
  const [error, setError] = React.useState("");
  const [tries, setTries] = React.useState(0);

  // The Payment Element, mounted before any PaymentIntent exists (Stripe's
  // deferred intent): the fields are there at once, the intent made on Pay.
  React.useEffect(() => {
    let gone = false;
    let el: ReturnType<Elements["create"]> | null = null;
    loadStripe()
      .then((s) => {
        if (gone || !box.current || !field.current) return;
        const elements = s.elements({ mode: "payment", amount: AMOUNT, currency: "usd", paymentMethodTypes: ["card"], appearance: appearance(box.current), fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap" }] });
        el = elements.create("payment", { layout: "tabs", fields: { billingDetails: { name: "never", email: "never" } } });
        el.on("ready", () => !gone && setStage("ready"));
        el.mount(field.current);
        els.current = { stripe: s, elements };
      })
      .catch(() => !gone && setStage("broken"));
    // Light and dark, as the rest of the card.
    const retheme = () => box.current && els.current?.elements.update({ appearance: appearance(box.current) });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", retheme);
    const mo = new MutationObserver(() => requestAnimationFrame(retheme));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => {
      gone = true;
      mq.removeEventListener("change", retheme);
      mo.disconnect();
      el?.destroy();
      els.current = null;
    };
  }, [tries]);

  const pay = async () => {
    const e = els.current;
    if (!e || stage === "paying") return;
    setStage("paying");
    setError("");
    const back = (msg: string) => {
      setError(msg);
      setStage("ready");
    };
    const checked = await e.elements.submit();
    if (checked.error) return back(checked.error.message || "Check the card details.");
    let made: { clientSecret: string; intentId: string };
    try {
      const res = await fetch("/api/deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 409) return setStage("taken");
      if (!res.ok) throw new Error(String(res.status));
      made = await res.json();
    } catch {
      return back("That did not go through. Try again, or write to hello@juliangigola.com.");
    }
    const { error: no } = await e.stripe.confirmPayment({
      elements: e.elements,
      clientSecret: made.clientSecret,
      redirect: "if_required",
      // ponytail: card only, so no redirect comes back here; if more methods
      // are added, /book/<slug>?deposit_return=<id> has to resume the poll.
      confirmParams: { return_url: `${location.origin}${location.pathname}?deposit_return=${made.intentId}`, payment_method_data: { billing_details: { name: body.name, email: body.email } } },
    });
    // Stripe's own words for a declined card; mine for anything else.
    if (no) return back(no.type === "card_error" || no.type === "validation_error" ? no.message || "Your card was declined." : "That did not go through. Try again, or write to hello@juliangigola.com.");
    setStage("confirming");
    // Paid: the booking is the webhook's. Asked once a second for 20.
    for (let n = 0; n < 20; n++) {
      await new Promise((go) => setTimeout(go, 1000));
      try {
        const r = await fetch(`/api/deposit/${encodeURIComponent(made.intentId)}`);
        const { status } = await r.json();
        if (status === "booked") return onBooked();
        if (status === "refunded" || status === "failed") return setStage(status);
      } catch {}
    }
    setStage("slow");
  };

  const after: Partial<Record<Stage, string>> = {
    taken: "That time was just taken. Nothing was charged. Pick another.",
    refunded: "That time was just taken. Your deposit is on its way back.",
    failed: "Payment received. I’ll email you to set the time.",
    slow: "Still confirming. You’ll get an email.",
    broken: "The payment form did not load.",
  };
  const said = after[stage];

  return (
    <div ref={box} aria-label="Deposit" role="region" className={cn("tp !flex flex-col gap-6 p-6 sm:gap-8 sm:p-10 [&>*]:shrink-0", className)}>
      <div className="flex flex-col gap-4">
        <p className="label tp-roll text-muted-foreground">Deposit</p>
        <p className="tp-roll max-w-[46ch] text-base normal-case leading-relaxed text-foreground/80 text-pretty" style={{ animationDelay: "80ms" }}>
          $100 deposit to reserve your date. I&rsquo;ll follow up by phone to confirm the concept, rate and schedule. Balance due after the shoot.
        </p>
      </div>
      <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        {rows.map(([k, v], n) => (
          <div key={k} className="tp-roll flex min-w-0 flex-col gap-1.5" style={{ animationDelay: `${140 + n * 70}ms` }}>
            <dt className="label text-muted-foreground">{k}</dt>
            <dd className="break-words text-base normal-case leading-snug">{v}</dd>
          </div>
        ))}
      </dl>
      {said ? (
        <div role="status" className="flex flex-col items-start gap-4">
          <p className="text-base normal-case leading-relaxed">{said}</p>
          {stage === "taken" || stage === "refunded" ? (
            <button type="button" onClick={onTaken} className="label border-b border-border hoverable:hover:border-foreground">Pick another time</button>
          ) : stage === "broken" ? (
            <button type="button" onClick={() => { setStage("loading"); setTries((t) => t + 1); }} className="label border-b border-border hoverable:hover:border-foreground">Try again</button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Held at the form's height while Stripe's fields load, so the card does not jump. */}
          <div ref={field} aria-busy={stage === "loading"} className="min-h-[9.5rem]" />
          {error ? <p role="alert" className="text-sm normal-case text-foreground">{error}</p> : null}
          <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <span className="max-w-[40ch] text-sm normal-case leading-relaxed text-muted-foreground">(Deposit moves with a new date, or is refunded up to 2 business days before.)</span>
            <button type="button" onClick={pay} disabled={stage !== "ready"} className="label shrink-0 rounded-[2px] border border-accent bg-accent px-6 py-4 text-accent-foreground transition-[opacity,scale] duration-300 hoverable:hover:opacity-85 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50">
              {stage === "paying" ? "Paying" : stage === "confirming" ? "Confirming" : error ? "Try again · $100" : "Pay $100 deposit"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
