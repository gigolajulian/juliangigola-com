"use client";

import * as React from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

/* ── the deposit ─────────────────────────────────────────────────────
 * Julian (2026-10-16), behind `?deposit`: a paid session's $100 deposit
 * taken in the card, after its form, in place of Cal.com's own checkout.
 * Stripe's card fields, dressed as the site.
 * The server side is JG - BACKEND's: POST /api/deposit makes the
 * PaymentIntent (and says 409 when the time has gone), its webhook books
 * Cal.com, GET /api/deposit/<id> says how that went.
 * ─────────────────────────────────────────────────────────────────── */

type StripeError = { type: string; message?: string };
type Stripe = {
  elements: (o: object) => Elements;
  confirmCardPayment: (secret: string, o: object) => Promise<{ error?: StripeError }>;
  confirmPayment: (o: object) => Promise<{ error?: StripeError }>;
};
type Element = {
  mount: (el: HTMLElement) => void;
  on: (e: string, f: (ev: { availablePaymentMethods?: object }) => void) => void;
  update: (o: object) => void;
  destroy: () => void;
};
type Elements = { create: (t: "cardNumber" | "cardExpiry" | "cardCvc" | "expressCheckout", o?: object) => Element };
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
  // Stripe's variables take rgb() only; the hairline's alpha goes in a rule.
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
}

/** The page's ink, read off it so the fields follow light and dark. */
function ink(el: HTMLElement) {
  const s = getComputedStyle(el);
  const v = (n: string) => rgb(s.getPropertyValue(n).trim());
  return { fg: v("--foreground"), muted: v("--muted-foreground"), accent: v("--accent") };
}

/** The card fields' type and color; their hairlines are the page's own
    (the boxes they mount in). One-color brand icon (Julian, 2026-10-16). */
function fieldStyle(el: HTMLElement) {
  const { fg, muted, accent } = ink(el);
  return {
    base: { color: fg, iconColor: fg, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontWeight: "600", fontSize: "16px", fontSmoothing: "antialiased", ...(document.documentElement.hasAttribute("data-layout") && { letterSpacing: "1.54px" }), "::placeholder": { color: muted } },
    invalid: { color: accent, iconColor: accent },
  };
}

/** The wallet button in the page's ink: black in dark, white in light
    (Julian, 2026-10-16). Light ink means a dark page. */
function walletTheme(el: HTMLElement) {
  const dark = Number(/\d+/.exec(ink(el).fg)?.[0] ?? 0) > 128;
  return dark ? { applePay: "black", googlePay: "black" } : { applePay: "white-outline", googlePay: "white" };
}

const FONTS = [{ cssSrc: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap" }];
const PAY_FAILED = "That did not go through. Try again, or write to hello@juliangigola.com.";

export type DepositBody = {
  slug: string;
  start: string;
  timeZone: string;
  name: string;
  email: string;
  /** E.164; the server adds it to the notes itself. */
  phone: string;
  notes?: string;
  where?: string;
  session?: string;
};

type Stage = "loading" | "ready" | "paying" | "confirming" | "taken" | "refunded" | "failed" | "slow" | "broken" | "declined";

export function DepositStep({
  body,
  rows,
  onBooked,
  onTaken,
  onBack,
  className,
  editorial,
  head,
}: {
  className?: string;
  /** `?editorial` (editorial.css): its step bar and heading over it. */
  editorial?: boolean;
  head?: React.ReactNode;
  body: DepositBody;
  rows: [string, string][];
  onBooked: () => void;
  /** The time went before the payment: back to the times. */
  onTaken: () => void;
  /** Back to the form, what was typed still in it. */
  onBack: () => void;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const number = React.useRef<HTMLDivElement>(null);
  const expiry = React.useRef<HTMLDivElement>(null);
  const cvc = React.useRef<HTMLDivElement>(null);
  const wallet = React.useRef<HTMLDivElement>(null);
  const els = React.useRef<{ stripe: Stripe; card: Element } | null>(null);
  const [stage, setStage] = React.useState<Stage>("loading");
  const [error, setError] = React.useState("");
  const [tries, setTries] = React.useState(0);
  const [wallets, setWallets] = React.useState(false);
  const payBtn = React.useRef<HTMLButtonElement>(null);
  /* Editorial: Pay turns red and shakes on a decline, then grows into the
     red card; paid, it grows into the teal booked card (Julian). */
  const [bad, setBad] = React.useState(false);
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const grow = (no: boolean, then: () => void) => {
    const b = payBtn.current;
    const card = box.current?.closest<HTMLElement>("#book-card") ?? box.current;
    if (!editorial || !b || !card || calm()) return then();
    const c = card.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    const g = document.createElement("div");
    g.className = "ed-grow";
    if (no) g.dataset.bad = "";
    card.append(g);
    gsap.set(g, { left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height, borderRadius: 2 });
    gsap.to(g, {
      left: 0, top: 0, width: c.width, height: c.height, borderRadius: getComputedStyle(card).borderRadius, duration: 0.7, ease: "expo.inOut",
      onComplete: () => {
        then();
        gsap.to(g, { autoAlpha: 0, duration: 0.35, delay: 0.05, onComplete: () => g.remove() });
      },
    });
  };
  const decline = (msg: string) => {
    setError(msg);
    setBad(true);
    if (!calm() && payBtn.current) gsap.to(payBtn.current, { keyframes: { x: [0, -6, 5, -3, 2, 0] }, duration: 0.34, ease: "power1.out", clearProps: "transform" });
    gsap.delayedCall(calm() ? 0 : 0.6, () => grow(true, () => setStage("declined")));
  };
  /* The red card and back again come in as the steps do. */
  const was = React.useRef(stage);
  React.useLayoutEffect(() => {
    const from = was.current;
    was.current = stage;
    if (!editorial || calm() || !box.current || (stage !== "declined" && from !== "declined")) return;
    gsap.fromTo(box.current.querySelectorAll(".ed-l > *, .ed-r > *, .ed-floor"), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.035, clearProps: "opacity,visibility,transform" });
  }, [stage, editorial]);
  /* Development only, to see the ends without a charge: `?sim=no` (a
     decline), `ok`, `taken`, `refunded`, `failed`, `slow`, `broken`. */
  const sim = process.env.NODE_ENV === "production" ? null : typeof location === "undefined" ? null : new URLSearchParams(location.search).get("sim");

  /* The intent, made on Pay (409: the time has gone). */
  const make = async (): Promise<{ clientSecret: string; intentId: string } | null> => {
    const res = await fetch("/api/deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 409) {
      setStage("taken");
      return null;
    }
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };
  const back = (msg: string) => {
    setError(msg);
    setStage("ready");
  };
  // Stripe's own words for a declined card; mine for anything else.
  const words = (no: StripeError) => (no.type === "card_error" || no.type === "validation_error" ? no.message || "Your card was declined." : PAY_FAILED);
  /* Paid: the booking is the webhook's. Asked once a second for 20. */
  const paid = async (intentId: string) => {
    setStage("confirming");
    for (let n = 0; n < 20; n++) {
      await new Promise((go) => setTimeout(go, 1000));
      try {
        const r = await fetch(`/api/deposit/${encodeURIComponent(intentId)}`);
        const { status } = await r.json();
        if (status === "booked") return grow(false, onBooked);
        if (status === "refunded" || status === "failed") return setStage(status);
      } catch {}
    }
    setStage("slow");
  };
  // The wallet's handler is set once; it calls these as they are now.
  // A card the bank turned down is the red card in the editorial look.
  const no = (e: StripeError) => (editorial && e.type === "card_error" ? decline(words(e)) : back(words(e)));
  const now = React.useRef({ make, back, words, paid, no });
  React.useEffect(() => {
    now.current = { make, back, words, paid, no };
  });

  /* Stripe's separate card fields (they carry a one-color brand icon,
     which the Payment Element does not), and Apple Pay or Google Pay
     over them where the browser has one (Express Checkout). */
  React.useEffect(() => {
    let gone = false;
    const made: Element[] = [];
    loadStripe()
      .then((s) => {
        if (gone || !box.current || !number.current || !expiry.current || !cvc.current || !wallet.current) return;
        const style = fieldStyle(box.current);
        const fields = s.elements({ fonts: FONTS });
        const card = fields.create("cardNumber", { style, showIcon: true, iconStyle: "solid", disableLink: true, placeholder: "1234 1234 1234 1234" });
        const exp = fields.create("cardExpiry", { style });
        const code = fields.create("cardCvc", { style });
        card.on("ready", () => !gone && setStage("ready"));
        card.mount(number.current);
        exp.mount(expiry.current);
        code.mount(cvc.current);
        const express = s.elements({ mode: "payment", amount: AMOUNT, currency: "usd", allowedPaymentMethodTypes: ["card"], appearance: { variables: { borderRadius: "2px" } } });
        const wall = express.create("expressCheckout", {
          paymentMethods: { applePay: "always", googlePay: "always", link: "never", paypal: "never", amazonPay: "never", klarna: "never" },
          buttonHeight: 48,
          buttonTheme: walletTheme(box.current),
        });
        wall.on("ready", (e) => !gone && setWallets(!!e.availablePaymentMethods));
        wall.on("confirm", async () => {
          setError("");
          try {
            const m = await now.current.make();
            if (!m) return;
            const { error: no } = await s.confirmPayment({
              elements: express,
              clientSecret: m.clientSecret,
              redirect: "if_required",
              confirmParams: { return_url: location.href, payment_method_data: { billing_details: { name: body.name, email: body.email } } },
            });
            if (no) return now.current.no(no);
            void now.current.paid(m.intentId);
          } catch {
            now.current.back(PAY_FAILED);
          }
        });
        wall.mount(wallet.current);
        made.push(card, exp, code, wall);
        els.current = { stripe: s, card };
      })
      .catch(() => !gone && setStage("broken"));
    // Light and dark, as the rest of the card.
    const retheme = () => {
      if (!box.current) return;
      made.slice(0, 3).forEach((f) => f.update({ style: fieldStyle(box.current!) }));
      made[3]?.update({ buttonTheme: walletTheme(box.current) });
    };
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", retheme);
    const mo = new MutationObserver(() => requestAnimationFrame(retheme));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => {
      gone = true;
      mq.removeEventListener("change", retheme);
      mo.disconnect();
      made.forEach((f) => f.destroy());
      els.current = null;
    };
  }, [tries, body.name, body.email]);

  const pay = async () => {
    const e = els.current;
    if (stage === "paying") return;
    if (sim) {
      setStage("paying");
      setError("");
      await new Promise((go) => setTimeout(go, 900));
      if (sim === "no") return decline("Your card was declined.");
      if (sim === "ok") return grow(false, onBooked);
      return setStage(sim as Stage);
    }
    if (!e) return;
    setStage("paying");
    setError("");
    let m: Awaited<ReturnType<typeof make>>;
    try {
      m = await make();
    } catch {
      return back(PAY_FAILED);
    }
    if (!m) return;
    // 3D Secure, where the bank asks for it, opens over the page.
    const { error: no } = await e.stripe.confirmCardPayment(m.clientSecret, { payment_method: { card: e.card, billing_details: { name: body.name, email: body.email } } })
      .catch(() => ({ error: { type: "api_connection_error" } as StripeError }));
    if (no) return now.current.no(no);
    void paid(m.intentId);
  };
  const retry = () => {
    setBad(false);
    setError("");
    setStage("loading");
    setTries((t) => t + 1);
  };

  const after: Partial<Record<Stage, string>> = {
    taken: "That time was just taken. Nothing was charged. Pick another.",
    refunded: "That time was just taken. Your deposit is on its way back.",
    failed: "Payment received. I’ll email you to set the time.",
    slow: "Still confirming. You’ll get an email.",
    broken: "The payment form did not load.",
  };
  const said = after[stage];

  if (editorial) {
    /* The ends: a word, a headline, what happened, and the way on. */
    const ends: Partial<Record<Stage, [mark: string, line: string, why: string, act?: [string, () => void]]>> = {
      declined: ["Not paid", "Card declined.", `${error} Nothing was charged, and the time isn’t held yet.`, ["Try again · $100", retry]],
      taken: ["Not paid", "Time taken.", after.taken!, ["Pick another time", onTaken]],
      refunded: ["Refunded", "Time taken.", after.refunded!, ["Pick another time", onTaken]],
      failed: ["Paid", "Paid.", after.failed!],
      slow: ["Paid", "Confirming.", after.slow!],
      broken: ["Not paid", "Not loaded.", after.broken!, ["Try again", retry]],
    };
    const end = ends[stage];
    return (
      <div ref={box} aria-label="Deposit" role="region" data-declined={stage === "declined" ? "" : undefined} className={cn("tp ed", className)}>
        {head}
        {end ? (
          <>
            <div className="ed-body" role="status">
              <div className="ed-l">
                <p className="ed-said"><b>{end[1]}</b> {end[2]}</p>
              </div>
              <div className="ed-r">
                {rows.map(([k, v]) => (
                  <div key={k} className="ed-row"><span className="label">{k}</span><span className="ed-v break-words">{v}</span></div>
                ))}
                <div className="ed-row"><span className="label">Help</span><a href="mailto:hello@juliangigola.com" className="ed-v break-words">hello@juliangigola.com</a></div>
              </div>
            </div>
            <div className="ed-floor">
              {stage === "declined" || stage === "broken" ? <button type="button" onClick={onBack} className="label ed-quiet">Edit details</button> : <span />}
              {end[3] ? <button type="button" onClick={end[3][1]} className="ed-btn">{end[3][0]}</button> : null}
            </div>
          </>
        ) : (
          <>
            <div className="ed-body">
              {/* What the $100 is for; the amount is the heading over it (2026-10-20). */}
              <div className="ed-l">
                {rows.map(([k, v]) => (
                  <div key={k} className="ed-row"><span className="label">{k}</span><span className="ed-v break-words">{v}</span></div>
                ))}
                <div className="ed-row"><span className="label">Due now</span><span className="ed-v">$100</span></div>
              </div>
              <div className="ed-r" aria-busy={stage === "loading"}>
                <label className="ed-row"><span className="label">Card</span><div ref={number} className="ed-field" /></label>
                <div className="ed-exp">
                  <label className="ed-row"><span className="label">Expiry</span><div ref={expiry} className="ed-field" /></label>
                  <label className="ed-row"><span className="label">CVC</span><div ref={cvc} className="ed-field" /></label>
                </div>
                <div ref={wallet} className={cn("ed-wallet", !wallets && "hidden")} />
                <p className="ed-copy">$100 holds your date. Refundable or transferable up to 2 business days before booking. Balance due after the shoot.</p>
                {error && !bad ? <p role="alert" className="ed-err">{error}</p> : null}
              </div>
            </div>
            <div className="ed-floor">
              <span className="label ed-lock">
                <svg aria-hidden viewBox="0 0 12 14" className="w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="6" width="10" height="7" rx="1" /><path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2" /></svg>
                Secured by Stripe. I never see your card.
              </span>
              <button ref={payBtn} type="button" onClick={pay} disabled={bad || (stage !== "ready" && !(sim && stage === "loading"))} data-accent="" data-bad={bad ? "" : undefined} className="ed-btn">
                {bad ? "Declined" : stage === "paying" ? "Paying" : stage === "confirming" ? "Confirming" : error ? "Try again · $100" : "Pay $100"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div ref={box} aria-label="Deposit" role="region" className={cn("tp !flex flex-col gap-6 p-6 sm:gap-8 sm:p-10 [&>*]:shrink-0", className)}>
      <div className="flex items-center justify-between gap-4">
        <p className="label tp-roll text-muted-foreground">Reserve your date</p>
        {stage === "ready" || stage === "loading" || stage === "broken" ? (
          <button type="button" onClick={onBack} className="label text-muted-foreground hoverable:hover:text-foreground">Edit details</button>
        ) : null}
      </div>
      <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        {rows.map(([k, v], n) => (
          <div key={k} className="tp-roll flex min-w-0 flex-col gap-1.5" style={{ animationDelay: `${140 + n * 70}ms` }}>
            <dt className="label text-muted-foreground">{k}</dt>
            <dd className="whitespace-pre-line break-words text-base normal-case leading-snug">{v}</dd>
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
          <div aria-busy={stage === "loading"} className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <label className="label flex flex-col gap-2 text-muted-foreground col-span-2">Card number<div ref={number} className="border-b border-border py-2.5 transition-colors focus-within:border-foreground" /></label>
            <label className="label flex flex-col gap-2 text-muted-foreground">Expiry<div ref={expiry} className="border-b border-border py-2.5 transition-colors focus-within:border-foreground" /></label>
            <label className="label flex flex-col gap-2 text-muted-foreground">CVC<div ref={cvc} className="border-b border-border py-2.5 transition-colors focus-within:border-foreground" /></label>
          </div>
          {/* Apple Pay or Google Pay, where there is one, under the card
              fields (Julian, 2026-10-16); nothing otherwise. */}
          <div ref={wallet} className={cn(!wallets && "hidden")} />
          {/* What the $100 does, under the card it comes off (Julian, 2026-10-16). */}
          <p className="text-sm normal-case leading-relaxed text-muted-foreground text-pretty">
            $100 holds your date. Refundable or transferable up to 2 business days before booking. Balance due after the shoot.
          </p>
          {error ? <p role="alert" className="text-sm normal-case text-foreground">{error}</p> : null}
          <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            {/* The card goes to Stripe's own fields, never to this site (Julian). */}
            <span className="label flex items-center gap-2 whitespace-nowrap text-muted-foreground">
              <svg aria-hidden viewBox="0 0 12 14" className="w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="6" width="10" height="7" rx="1" /><path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2" /></svg>
              Secured by Stripe. I never see your card.
            </span>
            <button type="button" onClick={pay} data-stick="fill" disabled={stage !== "ready"} className="label shrink-0 rounded-[2px] border border-accent bg-accent px-6 py-4 text-accent-foreground transition-[opacity,scale] duration-300 hoverable:hover:opacity-85 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50">
              {stage === "paying" ? "Paying" : stage === "confirming" ? "Confirming" : error ? "Try again · $100" : "Pay $100 deposit"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
