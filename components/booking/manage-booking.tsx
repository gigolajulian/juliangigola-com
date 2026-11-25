"use client";

import * as React from "react";
import Link from "next/link";
import { TimePicker } from "@/components/booking/picker/time-picker";
import { EARLY_SHARE, MAX_MOVES, MOVE_HOURS, PART_HOURS, REFUND_HOURS, refundCents, refundShare } from "@/lib/booking/rules";
import { TZ } from "@/lib/time-zone";
import { LEGACY_DEPOSIT } from "@/lib/leads/deposit-terms";
import type { clientView } from "@/lib/booking/engine";
import { postJson } from "@/lib/http";

/* ── a client's own booking: reschedule or cancel ─────────────────
 * Opened from the links in the "You're in." mail (`app/booking/[id]`).
 * Reschedule reuses the picker; picking a time moves the booking. Cancel
 * says first whether the deposit comes back (48 hours or more before the
 * start), then asks to confirm.
 * ─────────────────────────────────────────────────────────────── */

/** What the server sends of a booking (`clientView`); a type only, so no server code reaches the bundle. */
export type Managed = ReturnType<typeof clientView>;

const stampIn = (iso: string, timeZone?: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));

export function ManageBooking({ booking, token, open }: { booking: Managed; token: string; open?: string }) {
  const [b, setB] = React.useState(booking);
  // A booking moves twice at most, and not inside the last day: an old Reschedule link opens the plain page then.
  const [now] = React.useState(() => Date.now());
  const canMove = (booking.moves ?? 0) < MAX_MOVES && Date.parse(booking.start) - now >= MOVE_HOURS * 36e5;
  const [mode, setMode] = React.useState<"" | "reschedule" | "cancel">((open === "reschedule" && canMove) || open === "cancel" ? open : "");
  const [state, setState] = React.useState<"" | "busy" | "moved" | "cancelled">(b.cancelled ? "cancelled" : "");
  const [error, setError] = React.useState("");
  const [refunded, setRefunded] = React.useState<boolean | null>(null);
  // The dollars the server sent back: `now` is frozen at page load, so the message reads the answer, not the clock.
  const [back, setBack] = React.useState(0);
  const usd = b.deposit ?? LEGACY_DEPOSIT;
  const past = Date.parse(b.start) <= now;
  const share = refundShare({ intent: b.paid ? "x" : undefined, start: b.start, firstStart: b.firstStart, fee: b.fee }, now);
  const top = b.fee ? "90% back" : "a full refund";
  const movable = (b.moves ?? 0) < MAX_MOVES && Date.parse(b.start) - now >= MOVE_HOURS * 36e5;
  const part = refundCents(usd, share) / 100;
  const first = b.firstStart && b.firstStart !== b.start ? "the time you first booked" : "your session";

  const act = async (body: { action: "cancel" } | { action: "reschedule"; start: string }) => {
    setState("busy");
    setError("");
    const r = await postJson<{ record?: Managed; refunded?: boolean; back?: number }>(`/api/booking/${b.id}`, { t: token, ...body });
    const out = r.ok ? r.data : null;
    if (!out?.record) {
      setState("");
      // 409 is also "already cancelled" and "has started": only the taken time has its own words, the rest says what the server said.
      setError(
        !r.ok && r.code === "taken"
          ? "That time was just taken. Pick another."
          : (!r.ok && r.error) || "That did not go through. Try again, or reply to your confirmation email.",
      );
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
        <span className="lbl mute">{state === "cancelled" ? "Canceled" : state === "moved" ? "Moved" : "Your booking"}</span>
        <h1 className="text-2xl">{b.session}</h1>
        <p className="mute">
          {stampIn(b.start, TZ)}
          {b.where ? (
            <>
              <br />
              {b.where}
            </>
          ) : null}
        </p>
      </div>

      {state === "cancelled" ? (
        <p>
          {refunded === true
            ? back && back < usd
              ? `It's canceled, and $${back} of your $${usd} deposit is on its way back to your card. Banks take 5 to 10 days.`
              : `It's canceled, and your $${usd} deposit is on its way back to your card. Banks take 5 to 10 days.`
            : refunded === false && b.paid && share
              ? "It's canceled. The refund did not go through on its own; I'll send it by hand and email you."
              : "It's canceled. A note is on its way to your inbox."}{" "}
          <Link href="/book" className="underline">
            Book another time
          </Link>
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
                : share === EARLY_SHARE
                  ? `It's ${REFUND_HOURS} hours or more before your session, so $${part} of your $${usd} deposit is refunded to your card. $${usd - part} is kept as the booking fee.`
                  : share
                    ? `It's under ${REFUND_HOURS} hours before ${first}, so $${part} of your $${usd} deposit is refunded to your card and $${usd - part} is kept.${movable ? " Moving to another date carries the whole deposit over." : ""}`
                    : `It's under ${PART_HOURS} hours before ${first}, so the $${usd} deposit is not refunded.`}
          </p>
          <div className="flex gap-3">
            <button type="button" className="btn fill" disabled={state === "busy"} onClick={() => act({ action: "cancel" })}>
              {state === "busy" ? "Canceling" : "Cancel booking"}
            </button>
            <button type="button" className="btn" onClick={() => setMode("")}>
              Keep it
            </button>
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
              {share >= EARLY_SHARE
                ? `Your $${usd} deposit moves with it. A cancellation is judged by the time you first booked, ${stampIn(b.firstStart ?? b.start, TZ)}: ${top} ${REFUND_HOURS} hours or more before it, 70% back ${PART_HOURS} hours or more before, nothing after.`
                : share
                  ? `Your $${usd} deposit moves with it. A cancellation now refunds 70% of it: the time you first booked, ${stampIn(b.firstStart ?? b.start, TZ)}, is under ${REFUND_HOURS} hours away.`
                  : `Your $${usd} deposit moves with it. It is no longer refundable: the time you first booked, ${stampIn(b.firstStart ?? b.start, TZ)}, is under ${PART_HOURS} hours away.`}
            </p>
          ) : null}
          <button type="button" className="btn self-start" onClick={() => setMode("")}>
            Back
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            {movable ? (
              <button type="button" className="btn fill" onClick={() => setMode("reschedule")}>
                Reschedule
              </button>
            ) : null}
            <button type="button" className="btn" onClick={() => setMode("cancel")}>
              Cancel
            </button>
          </div>
          <p className="mute">
            {(b.moves ?? 0) >= MAX_MOVES
              ? "This booking has been moved twice, so it can no longer be moved."
              : !movable
                ? `Your session is less than ${MOVE_HOURS} hours away, so it can no longer be moved.`
                : (b.moves ?? 0) === 1
                  ? `You can move this booking one more time, until ${MOVE_HOURS} hours before it.`
                  : `A booking can be moved twice, until ${MOVE_HOURS} hours before it.`}
          </p>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-accent">
          {error}
        </p>
      ) : null}
      {state === "moved" ? <p>Moved. A new confirmation is on its way to your inbox.</p> : null}
    </section>
  );
}
