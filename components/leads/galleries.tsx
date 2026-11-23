"use client";

/* ── the client's galleries on the lead ───────────────────────────
 * A client's proof and
 * delivery galleries beside their details, each with where it stands. Sent
 * to the lead's address or to any of its people. Open takes him to that
 * gallery on the Proofs desk.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { HStack, VStack, StackItem } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Divider } from "@astryxdesign/core/Divider";
import { canonical } from "@/lib/leads/lead-crypto";
import { dayLabel } from "@/lib/leads/lead-desk";
import { pastCloseDate, type ProofRow } from "@/lib/proofs/desk";
import { stage } from "@/lib/proofs/proof";
import { Timeline } from "@/components/proofs/timeline";

/** Where a gallery stands, in one word, and how loud its badge is. */
function state(p: ProofRow): { label: string; variant: "success" | "blue" | "gray" } {
  if (p.deliveredAt) return p.firstDownloadAt ? { label: "Downloaded", variant: "success" } : { label: "Delivered", variant: "blue" };
  const s = stage(p);
  return { label: s, variant: p.submittedAt ? "blue" : "gray" };
}

/** What it is and when things happened: "Proofs · 48 frames · sent Nov 13 · opened 3 times". */
function facts(p: ProofRow, lead: string): string {
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? "" : "s"}`;
  const parts = p.deliveredAt
    ? ["Finals", n(p.finals?.length ?? 0, "photo"), `delivered ${dayLabel(p.deliveredAt)}`, p.firstDownloadAt ? `downloaded ${dayLabel(p.firstDownloadAt)}` : null]
    : ["Proofs", n(p.frames.length, "frame"), p.sentAt ? `sent ${dayLabel(p.sentAt)}` : "not sent", p.submittedAt ? `${n(p.selects.length, "select")} sent ${dayLabel(p.submittedAt)}` : p.views ? `opened ${n(p.views, "time")}` : null];
  if (pastCloseDate(p)) parts.push("closed");
  if (p.email && canonical(p.email) !== canonical(lead)) parts.push(`to ${p.email}`);
  return parts.filter(Boolean).join(" · ");
}

export function Galleries({ galleries, lead, open }: { galleries: ProofRow[]; lead: string; open: (token?: string) => void }) {
  return (
    <VStack gap={3}>
      <HStack gap={2} vAlign="center">
        <StackItem size="fill"><Heading level={2}>Galleries</Heading></StackItem>
        <Button label="All proofs" variant="ghost" size="sm" onClick={() => open()} />
      </HStack>
      {galleries.map((p, i) => {
        const s = state(p);
        return (
          <React.Fragment key={p.token}>
            {i ? <Divider /> : null}
            <HStack gap={3} vAlign="center">
              <StackItem size="fill">
                <VStack gap={0}>
                  <Text type="label">{p.name}</Text>
                  <Text type="supporting" color="secondary">{facts(p, lead)}</Text>
                </VStack>
              </StackItem>
              <Badge label={s.label} variant={s.variant} />
              <Button label="Open" variant="ghost" size="sm" onClick={() => open(p.token)} />
            </HStack>
            {/* Where it stands at a glance, the same timeline as the gallery itself. */}
            {p.sentAt || p.firstViewAt || p.submittedAt || p.pulledAt || p.deliveredAt ? <Timeline p={p} /> : null}
          </React.Fragment>
        );
      })}
    </VStack>
  );
}
