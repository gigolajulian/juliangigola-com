import * as React from "react";
import { Orb } from "@/components/effects/orb";
import type { Step } from "@/components/booking/picker/parts";

/* The editorial card's drawn marks: plain elements, no state. */

/* Julian: the arrows more defined, larger. Drawn, not the font's. */
export const arrowMark = () => (
    <svg aria-hidden viewBox="0 0 22 16" className="h-4 w-[1.375rem]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <path d="M20.5 8H2.5M6.5 5 2.5 8 6.5 11" />
    </svg>
  );

/* Booking: the orb, then the ring and its check, over the card. */
export const busyMark = (step: Step) => step === "sending" || step === "check" ? (
        <div role="status" aria-live="polite" className="absolute inset-0 z-20 bg-background/85 backdrop-blur-md">
          {/* The orb in the middle of the card, its word under it, out of
              the reckoning (QA on #143); a phone's card taller than the
              screen keeps it in the middle of what shows. */}
          <div className="sticky top-0 flex h-full max-h-[100svh] flex-col items-center justify-center">
            <div className="relative -translate-y-[var(--card-lift,0px)]">
            <div className="tp-status relative size-28" data-ok={step === "check" ? "" : undefined}>
              {/* Julian: the solving orb while it books (2026-10-14, was
                  working); the ring and tick once it is booked. */}
              {step === "sending" ? (
                <span className="absolute inset-0 grid place-items-center text-foreground">
                  <Orb state="solving" size={64} />
                </span>
              ) : null}
              <svg viewBox="0 0 112 112" className="absolute inset-0 size-full" fill="none" aria-hidden>
                <circle className="tp-ring stroke-accent" cx="56" cy="56" r="44" strokeWidth="3" strokeLinecap="round" />
                <path className="tp-tick stroke-accent" d="M38 58l12 12 24-26" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="label absolute left-1/2 top-full mt-6 -translate-x-1/2 whitespace-nowrap text-muted-foreground">{step === "check" ? "Booked" : "Booking"}</p>
            </div>
          </div>
        </div>
      ) : null;

/* Confirm's words turn into the orbs, then a check. */
export const okMarkOf = (ok: "" | "spin" | "tick") => ok ? (
              <span aria-hidden className="tp-status absolute inset-0 m-auto size-6" data-ok={ok === "tick" ? "" : undefined}>
                {[["1.1s", 6, 1], ["1.6s", 4.5, 0.7], ["0.9s", 3.5, 0.5]].map(([d, size, o], n) => (
                  <span key={n} className="tp-arm absolute inset-0" style={{ animationDuration: d as string, animationDirection: n % 2 ? "reverse" : "normal" }}>
                    <span className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-current" style={{ width: size, height: size, opacity: o }} />
                  </span>
                ))}
                <svg viewBox="0 0 112 112" className="absolute inset-0 size-full" fill="none">
                  <path className="tp-tick" d="M30 58l18 18 34-38" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: "0.15s", strokeDasharray: 80, strokeDashoffset: 80 }} />
                </svg>
              </span>
            ) : null;
