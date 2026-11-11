"use client";

/* ── a gallery's Activity on Astryx ───────────────────────────────
 * The classic Activity (components/admin/admin-proofs.tsx) rebuilt for the
 * Astryx proofs desk: pick a viewer, their facts, the most picked frames,
 * the event log, Export CSV. Same data (`p.viewers`), no new reads.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import type { Row } from "@/components/admin/admin-proofs";
import type { ViewerEvent } from "@/lib/proofs";
import { stampPT } from "@/lib/leads/lead-desk";

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const secs = (n: number) => (n < 90 ? `${Math.round(n)} s` : `${Math.round(n / 60)} min`);

export function ActivityAstryx({ p }: { p: Row }) {
  const people = Object.entries(p.viewers ?? {}).sort((a, b) => b[1].last.localeCompare(a[1].last));
  const [who, setWho] = React.useState(people[0]?.[0] ?? "");
  if (!people.length) return <Text type="code" size="sm" color="secondary">Nobody has opened it yet. Each address typed at the gate shows here.</Text>;
  const file = (id?: string) => (id ? p.frames.find((f) => f.id === id)?.file ?? id : "");
  const num = (id?: string) => (id ? `#${p.frames.findIndex((f) => f.id === id) + 1}` : "");
  const SAID: Record<ViewerEvent["kind"], (id?: string) => string> = { open: () => "opened", pick: (id) => `picked ${num(id)}`, unpick: (id) => `unpicked ${num(id)}`, review: () => "reviewed", pay: () => "paid", send: () => "sent selects" };
  const tally = new Map<string, number>();
  for (const [, v] of people) for (const id of v.picks) tally.set(id, (tally.get(id) ?? 0) + 1);
  const top = [...tally].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const [email, v] = people.find(([k]) => k === who) ?? people[0];
  const sent = p.submittedBy?.toLowerCase() === email;
  const longest = Object.entries(v.looks).sort((a, b) => b[1] - a[1])[0];
  const unpicked = v.events.filter((e) => e.kind === "unpick").length;

  const exportCsv = () => {
    const rows = [["email", "time", "event", "frame", "file", "device", "place"]];
    for (const [k, x] of people) for (const e of x.events) rows.push([k, e.at, e.kind, num(e.id), file(e.id), e.device ?? "", e.place ?? ""]);
    for (const [k, x] of people) for (const [id, ms] of Object.entries(x.looks)) rows.push([k, x.last, "look", num(id), file(id), `${Math.round(ms / 1000)} s`, ""]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" }));
    a.download = `${p.name.replace(/[^\w-]+/g, "-")}-activity.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <VStack gap={4}>
      <HStack gap={2} vAlign="end">
        <Selector label="Viewer" size="sm" value={email} onChange={setWho}
          options={people.map(([k, x]) => ({ value: k, label: `${x.name ? `${x.name} · ` : ""}${k} · ${p.submittedBy?.toLowerCase() === k ? "sent" : x.picks.length ? "browsing" : "opened"} · ${x.picks.length} picks` }))} />
        <Button label="Export CSV" variant="ghost" size="sm" onClick={exportCsv} />
      </HStack>
      <MetadataList>
        <MetadataListItem label="First open">{stampPT(v.first)}</MetadataListItem>
        <MetadataListItem label="Last seen">{stampPT(v.last)}</MetadataListItem>
        <MetadataListItem label="Visits">{v.visits}</MetadataListItem>
        <MetadataListItem label="Time in gallery">{secs(v.seconds)}</MetadataListItem>
        <MetadataListItem label="Devices">{v.devices.join(", ") || "Unknown"}</MetadataListItem>
        <MetadataListItem label="Location">{v.places.join(" · ") || "Unknown"}</MetadataListItem>
        <MetadataListItem label="Frames viewed">{Object.keys(v.looks).length} of {p.frames.length}</MetadataListItem>
        <MetadataListItem label="Picks">{v.picks.length}</MetadataListItem>
        <MetadataListItem label="Changed mind">{unpicked} unpicked</MetadataListItem>
        <MetadataListItem label="Longest look">{longest ? `${num(longest[0])} · ${secs(longest[1] / 1000)}` : "None yet"}</MetadataListItem>
        <MetadataListItem label="Paid">{sent && p.paid ? `$${(p.paid.amount / 100).toFixed(0)} · Stripe` : "No"}</MetadataListItem>
      </MetadataList>
      {top.length ? (
        <VStack gap={2}>
          <Text type="code" size="xsm" color="accent" weight="medium">MOST PICKED</Text>
          <HStack gap={1} wrap="wrap">
            {top.map(([id, c]) => (
              <VStack key={id} gap={0} hAlign="center">
                {/* eslint-disable-next-line @next/next/no-img-element -- private proof frame */}
                <img src={`/proof/${p.token}/f/${id}`} alt={num(id)} style={{ width: 48, aspectRatio: "3 / 4", objectFit: "cover" }} />
                <Badge label={String(c)} variant="neutral" />
              </VStack>
            ))}
          </HStack>
        </VStack>
      ) : null}
      <VStack gap={0}>
        {[...v.events].reverse().map((e, i) => (
          <Text key={i} type="code" size="sm" color={e.kind === "pick" ? "accent" : "secondary"}>
            {stampPT(e.at)} · {SAID[e.kind](e.id)}{e.kind === "open" ? ` · ${[e.device, e.place].filter(Boolean).join(" · ")}` : e.id ? ` · ${file(e.id)}` : ""}
          </Text>
        ))}
      </VStack>
    </VStack>
  );
}
