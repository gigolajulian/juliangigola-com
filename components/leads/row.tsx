"use client";

/* ── a lead's row, as Today and the Leads list both draw it ───────
 * The name, one readable line in normal case, the next step in teal.
 * A late lead says so in orange.
 * ─────────────────────────────────────────────────────────────── */

import { Badge } from "@astryxdesign/core/Badge";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { isLate, type LeadSummary } from "@/lib/leads/leads";
import { ago, nextStep, now } from "@/lib/leads/lead-desk";

/** "Consultation · Call booked · Sat, Nov 14, 12:00 PM": whatever parts there are. */
export const joinParts = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

export function About({ children }: { children: React.ReactNode }) {
  return <Text type="body" size="sm" color="secondary" maxLines={1}>{children}</Text>;
}

/** Time since they last wrote; a late lead (lib/leads isLate) says so. */
export function Age({ l }: { l: LeadSummary }) {
  return isLate(l, now())
    ? <Badge label={`${ago(l.lastAt)} late`} variant="warning" />
    : <Text type="code" size="xsm" color="secondary" hasTabularNumbers>{ago(l.lastAt)}</Text>;
}

/** The one next step in teal; money stuck as an error dot; grey when the ball is with them. */
export function Next({ l, waiting }: { l: LeadSummary; waiting?: boolean }) {
  const bad = l.flags?.includes("stuck") ? "Deposit stuck" : l.flags?.includes("no-deposit") ? "No deposit" : null;
  if (bad) return <Text type="body" size="sm" color="secondary"><StatusDot variant="error" label="Money stuck" /> {bad}</Text>;
  const step = nextStep(l);
  if (!step) return waiting ? <Text type="body" size="sm" color="secondary">Waiting on them</Text> : null;
  return <Text type="body" weight="semibold" color="accent">{step} →</Text>;
}
