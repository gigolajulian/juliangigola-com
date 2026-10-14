"use client";

import { useLinkStatus } from "next/link";
import { Orb } from "@/components/orb";

/* Julian: an orb in place of a button's words while the page it opens is
   on its way (Book a session: connecting; Inquire: composing). Only when
   there is a wait: a page already fetched, or a screen on this one, never
   shows it. The words keep their room, so the button does not change
   size. Inside the `Link` it belongs to. */
export function PendingLabel({
  children,
  state,
}: {
  children: React.ReactNode;
  state: "connecting" | "composing";
}) {
  const { pending } = useLinkStatus();
  return (
    <span className="relative inline-grid place-items-center">
      <span className={pending ? "opacity-0" : undefined}>{children}</span>
      {pending ? (
        <span className="absolute inset-0 grid place-items-center">
          <Orb state={state} size={20} />
        </span>
      ) : null}
    </span>
  );
}
