"use client";

import * as React from "react";
import Link from "next/link";
import { TimePicker } from "@/components/booking/time-picker";
import { MAX_MOVES, PART_HOURS, REFUND_HOURS, refundCents, refundShare, TZ } from "@/lib/booking/booking-rules";
import { LEGACY_DEPOSIT } from "@/lib/booking/paid";

/* ── a client's own booking: reschedule or cancel ─────────────────
 * Opened from the links in the "You're in." mail (`app/booking/[id]`).
 * Reschedule reuses the picker; picking a time moves the booking. Cancel
 * says first whether the deposit comes back (48 hours or more before the
 * start, Julian 2026-11-03), then asks to confirm.
 * ─────────────────────────────────────────────────────────────── */

export type Managed = { id: string; slug: string; session: string; start: string; end: string; firstStart?: string; where?: string; /** Times moved so far. */ moves?: number; paid: boolean; /** Dollars this booking paid. */ deposit?: number; cancelled: boolean };

const stampIn = (iso: string, timeZone?: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));

export function ManageBooking({ booking, token, open }: { booking: Managed; token: string; open?: string }) {
  const [b, setB] = React.useState(booking);
  const [mode, setMode] = React.useState<"" | "reschedule" | "cancel">(open === "reschedule" || open === "cancel" ? open : "");
  const [state, setState] = React.useState<"" | "busy" | "moved" | "cancelled">(b.cancelled ? "cancelled" : "");
  const [error, setError] = React.useState("");
  const [refunded, setRefunded] = React.useState<boolean | null>(null);
  // The dollars the server sent back: `now` is frozen at page load, so the message reads the answer, not the clock.
  const [back, setBack] = React.useState(0);
  const [now] = React.useState(() => Date.now());
  const usd = b.deposit ?? LEGACY_DEPOSIT;
  const past = Date.parse(b.start) <= now;
  const share = refundShare({ intent: b.paid ? "x" : undefined, start: b.start, firstStart: b.firstStart }, now);
  const part = refundCents(usd, share) / 100;
  const first = b.firstStart && b.firstStart !== b.start ? "the time you first booked" : "your session";

  const act = async (body: { action: "cancel" } | { action: "reschedule"; start: string }) => {
    setState("busy");
    setError("");
    const res = await fetch(`/api/booking/${b.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, ...body }) }).catch(() => null);
    const out = (await res?.json().catch(() => null)) as { record?: Managed; refunded?: boolean; back?: number; error?: string } | null;
    if (!res?.ok || !out?.record) {
      setState("");
      setError(res?.status === 409 ? "That time was just taken. Pick another." : (out?.error ?? "That did not go through. Try again, or reply to your confirmation email."));
      return;
    }
    setB(out.record);
    setRefunded(out.refunded ?? null);
    setBack(out.back ?? 0);
    setMode("");
    setState(body.action === "cancel" ? "cancelled" : "moved");
  };

  return (
    <section className="v3 mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-8 px-4 py-24">
      <div className="flex flex-col gap-3">
        <span className="lbl mute">{state === "cancelled" ? "Cancelled" : state === "moved" ? "Moved" : "Your booking"}</span>
        <h1 className="text-2xl">{b.session}</h1>
        <p className="mute">
          {stampIn(b.start, TZ)}
          {b.where ? <><br />{b.where}</> : null}
        </p>
      </div>

      {state === "cancelled" ? (
        <p>
          {refunded === true
            ? back && back < usd
              ? `It's cancelled, and $${back} of your $${usd} deposit is on its way back to your card. Banks take 5 to 10 days.`
              : `It's cancelled, and your $${usd} deposit is on its way back to your card. Banks take 5 to 10 days.`
            : refunded === false && b.paid && share
              ? "It's cancelled. The refund did not go through on its own; I'll send it by hand and email you."
              : "It's cancelled. A note is on its way to your inbox."}{" "}
          <Link href="/book" className="underline">Book another time</Link>
        </p>
      ) : past ? (
        <p>This session has started. Reply to your confirmation email if something changed.</p>
      ) : mode === "cancel" ? (
        <div className="flex flex-col gap-4">
          <p>
            {!b.paid
              ? "Cancel this call?"
              : share === 1
                ? `It's ${REFUND_HOURS} hours or more before your session, so your $${usd} deposit is refunded to your card.`
                : share
                  ? `It's under ${REFUND_HOURS} hours before ${first}, so $${part} of your $${usd} deposit is refunded to your card and $${usd - part} is kept. Moving to another date carries the whole deposit over.`
                  : `It's under ${PART_HOURS} hours before ${first}, so the $${usd} deposit is not refunded. Moving to another date carries it over.`}
          </p>
          <div className="flex gap-3">
            <button type="button" className="btn fill" disabled={state === "busy"} onClick={() => act({ action: "cancel" })}>
              {state === "busy" ? "Cancelling" : "Cancel booking"}
            </button>
            <button type="button" className="btn" onClick={() => setMode("")}>Keep it</button>
          </div>
        </div>
      ) : mode === "reschedule" ? (
        <div className="flex flex-col gap-4">
          <TimePicker
            path={`juliangigola/${b.slug}`}
            title={b.session}
            onPicked={(start) => act({ action: "reschedule", start })}
            fallback={<p>Times did not load. Reply to your confirmation email and I&apos;ll move it.</p>}
          />
          {b.paid ? (
            <p className="mute">
              {share === 1
                ? `Your $${usd} deposit moves with it. A cancel is judged by the time you first booked, ${stampIn(b.firstStart ?? b.start, TZ)}: a full refund ${REFUND_HOURS} hours or more before it, 70% back ${PART_HOURS} hours or more before, nothing after.`
                : share
                  ? `Your $${usd} deposit moves with it. A cancel now refunds 70% of it: the time you first booked, ${stampIn(b.firstStart ?? b.start, TZ)}, is under ${REFUND_HOURS} hours away.`
                  : `Your $${usd} deposit moves with it. It is no longer refundable: the time you first booked, ${stampIn(b.firstStart ?? b.start, TZ)}, is under ${PART_HOURS} hours away.`}
            </p>
          ) : null}
          <button type="button" className="btn self-start" onClick={() => setMode("")}>Back</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            {(b.moves ?? 0) < MAX_MOVES ? <button type="button" className="btn fill" onClick={() => setMode("reschedule")}>Reschedule</button> : null}
            <button type="button" className="btn" onClick={() => setMode("cancel")}>Cancel</button>
          </div>
          <p className="mute">
            {(b.moves ?? 0) >= MAX_MOVES
              ? "This booking has been moved twice, so it can no longer be moved."
              : (b.moves ?? 0) === 1
                ? "You can move this booking one more time."
                : "A booking can be moved twice."}
          </p>
        </div>
      )}
      {error ? <p role="alert" className="text-accent">{error}</p> : null}
      {state === "moved" ? <p>Moved. A new confirmation is on its way to your inbox.</p> : null}
    </section>
  );
}
