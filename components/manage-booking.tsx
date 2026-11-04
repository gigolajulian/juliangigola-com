"use client";

import * as React from "react";
import Link from "next/link";
import { TimePicker } from "@/components/time-picker";
import { REFUND_HOURS, refundable } from "@/lib/booking-rules";

/* ── a client's own booking: reschedule or cancel ─────────────────
 * Opened from the links in the "You're in." mail (`app/booking/[id]`).
 * Reschedule reuses the picker; picking a time moves the booking. Cancel
 * says first whether the $100 comes back (48 hours or more before the
 * start, Julian 2026-11-03), then asks to confirm.
 * ─────────────────────────────────────────────────────────────── */

export type Managed = { id: string; slug: string; session: string; start: string; end: string; firstStart?: string; where?: string; paid: boolean; cancelled: boolean };

const when = (iso: string, timeZone?: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));

export function ManageBooking({ booking, token, open }: { booking: Managed; token: string; open?: string }) {
  const [b, setB] = React.useState(booking);
  const [mode, setMode] = React.useState<"" | "reschedule" | "cancel">(open === "reschedule" || open === "cancel" ? open : "");
  const [state, setState] = React.useState<"" | "busy" | "moved" | "cancelled">(b.cancelled ? "cancelled" : "");
  const [error, setError] = React.useState("");
  const [refunded, setRefunded] = React.useState<boolean | null>(null);
  const [now] = React.useState(() => Date.now());
  const past = Date.parse(b.start) <= now;
  const refund = refundable({ intent: b.paid ? "x" : undefined, start: b.start, firstStart: b.firstStart }, now);

  const act = async (body: { action: "cancel" } | { action: "reschedule"; start: string }) => {
    setState("busy");
    setError("");
    const res = await fetch(`/api/booking/${b.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, ...body }) }).catch(() => null);
    const out = (await res?.json().catch(() => null)) as { record?: Managed; refunded?: boolean; error?: string } | null;
    if (!res?.ok || !out?.record) {
      setState("");
      setError(res?.status === 409 ? "That time was just taken. Pick another." : (out?.error ?? "That did not go through. Try again, or reply to your confirmation email."));
      return;
    }
    setB(out.record);
    setRefunded(out.refunded ?? null);
    setMode("");
    setState(body.action === "cancel" ? "cancelled" : "moved");
  };

  return (
    <section className="v3 mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-8 px-4 py-24">
      <div className="flex flex-col gap-3">
        <span className="lbl mute">{state === "cancelled" ? "Cancelled" : state === "moved" ? "Moved" : "Your booking"}</span>
        <h1 className="text-2xl">{b.session}</h1>
        <p className="mute">
          {when(b.start, "America/Los_Angeles")}
          {b.where ? <><br />{b.where}</> : null}
        </p>
      </div>

      {state === "cancelled" ? (
        <p>
          {refunded === true
            ? "It's cancelled, and your $100 deposit is on its way back to your card. Banks take 5 to 10 days."
            : refunded === false && b.paid && refund
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
              : refund
                ? `It's ${REFUND_HOURS} hours or more before your session, so your $100 deposit is refunded to your card.`
                : `It's under ${REFUND_HOURS} hours before ${b.firstStart && b.firstStart !== b.start ? "the time you first booked" : "your session"}, so the $100 deposit is not refunded. Moving to another date carries it over.`}
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
            own
            onPicked={(start) => act({ action: "reschedule", start })}
            fallback={<p>Times did not load. Reply to your confirmation email and I&apos;ll move it.</p>}
          />
          {b.paid ? (
            <p className="mute">
              {refund
                ? `Your $100 deposit moves with it. It is refunded only if you cancel ${REFUND_HOURS} hours or more before the time you first booked, ${when(b.firstStart ?? b.start, "America/Los_Angeles")}.`
                : `Your $100 deposit moves with it. It is no longer refundable: the time you first booked, ${when(b.firstStart ?? b.start, "America/Los_Angeles")}, is under ${REFUND_HOURS} hours away.`}
            </p>
          ) : null}
          <button type="button" className="btn self-start" onClick={() => setMode("")}>Back</button>
        </div>
      ) : (
        <div className="flex gap-3">
          <button type="button" className="btn fill" onClick={() => setMode("reschedule")}>Reschedule</button>
          <button type="button" className="btn" onClick={() => setMode("cancel")}>Cancel</button>
        </div>
      )}
      {error ? <p role="alert" className="text-accent">{error}</p> : null}
      {state === "moved" ? <p>Moved. A new confirmation is on its way to your inbox.</p> : null}
    </section>
  );
}
