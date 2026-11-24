"use client";

/* ── a gallery's Activity on Astryx ───────────────────────────────
 * The classic Activity rebuilt for the
 * Astryx proofs desk: pick a viewer, their facts, the most picked frames,
 * the event log, Export CSV, and Forget for his own test visits. Same data (`p.viewers`), no new reads.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { proofApi, type ProofRow } from "@/lib/proofs/proof-desk";
import { publicId, THUMB_W, type ViewerEvent } from "@/lib/proofs/proof-model";
import { stampPT } from "@/lib/admin/admin-call";
import { errorText } from "@/lib/utils";

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const secs = (n: number) => (n < 90 ? `${Math.round(n)} s` : `${Math.round(n / 60)} min`);

export function ActivityDesk({ p, changed }: { p: ProofRow; changed: () => void }) {
  const people = Object.entries(p.viewers ?? {}).sort((a, b) => b[1].last.localeCompare(a[1].last));
  const [who, setWho] = React.useState(people[0]?.[0] ?? "");
  const [note, setNote] = React.useState<string | null>(null);
  if (!people.length) return <Text type="code" size="sm" color="secondary">Nobody has opened it yet. Each address typed at the gate shows here.</Text>;
  const file = (id?: string) => (id ? p.frames.find((f) => f.id === id)?.file ?? id : "");
  const num = (id?: string) => (id ? `#${p.frames.findIndex((f) => f.id === id) + 1}` : "");
  const models = [...new Set((p.finals ?? []).map((f) => f.model).filter((m): m is string => !!m))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const isModel = (id?: string) => !!id && models.includes(id);
  const SAID: Record<ViewerEvent["kind"], (id?: string) => string> = { open: () => "opened", pick: (id) => `picked ${num(id)}`, unpick: (id) => `unpicked ${num(id)}`, review: () => "reviewed", pay: () => "paid", send: () => "sent selects", download: (id) => (id === "all" ? "downloaded all" : isModel(id) ? `downloaded ${id} zip` : `saved ${p.finals?.find((f) => f.id === id)?.file ?? id}`) };
  // Deliveries: every download under the address that took it, and which models went.
  const dlOf = (x: (typeof people)[number][1]) => x.events.filter((e) => e.kind === "download");
  const what = (id?: string) => (id === "all" ? "all" : isModel(id) ? `${id} zip` : p.finals?.find((f) => f.id === id)?.file ?? id ?? "");
  const takenBy = (m: string) => [...new Set(people.filter(([, x]) => dlOf(x).some((e) => e.id === m || e.id === "all" || p.finals?.find((f) => f.id === e.id)?.model === m)).map(([k, x]) => x.name ?? k))];
  const tally = new Map<string, number>();
  for (const [, v] of people) for (const id of v.picks) tally.set(id, (tally.get(id) ?? 0) + 1);
  const top = [...tally].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const [email, v] = people.find(([k]) => k === who) ?? people[0];
  const sent = p.submittedBy?.toLowerCase() === email;
  const longest = Object.entries(v.looks).sort((a, b) => b[1] - a[1])[0];
  const unpicked = v.events.filter((e) => e.kind === "unpick").length;

  // His own test visits: off this gallery's Activity and off Leads. Sent selects stay.
  const forget = async () => {
    if (!confirm(`Forget ${email}'s visits to "${p.name}"? They leave this Activity and Leads. Sent selects stay.`)) return;
    try {
      await proofApi({ method: "POST", body: JSON.stringify({ action: "forget", token: p.token, email }) });
      setNote(`${email} forgotten.`);
      changed();
    } catch (e) {
      setNote(errorText(e));
    }
  };

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
        {/* The selector takes the room left, so the buttons beside it keep their full labels. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Selector label="Viewer" size="sm" width="100%" value={email} onChange={setWho}
            options={people.map(([k, x]) => ({ value: k, label: `${x.name ? `${x.name} · ` : ""}${k} · ${p.submittedBy?.toLowerCase() === k ? "sent" : x.picks.length ? "browsing" : "opened"} · ${x.picks.length} picks` }))} />
        </div>
        <Button label="Export CSV" variant="ghost" size="sm" onClick={exportCsv} />
        <Button label="Forget" variant="ghost" size="sm" clickAction={forget} />
      </HStack>
      {note ? <Text type="supporting" role="status">{note}</Text> : null}
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
                <img src={`/proof/${publicId(p)}/f/${id}?w=${THUMB_W}`} alt={num(id)} style={{ width: 48, aspectRatio: "3 / 4", objectFit: "cover" }} />
                <Badge label={String(c)} variant="neutral" />
              </VStack>
            ))}
          </HStack>
        </VStack>
      ) : null}
      {p.finals?.length ? (
        <VStack gap={1}>
          <Text type="code" size="xsm" color="accent" weight="medium">DOWNLOADS BY PERSON</Text>
          {people.map(([k, x]) => (
            <Text key={k} type="code" size="sm" color="secondary">
              {x.name ? `${x.name} · ` : ""}{k} · {dlOf(x).length ? [...new Set(dlOf(x).map((e) => what(e.id)))].join(", ") : "nothing yet"}
            </Text>
          ))}
        </VStack>
      ) : null}
      {models.length ? (
        <VStack gap={1}>
          <Text type="code" size="xsm" color="accent" weight="medium">BY MODEL · {models.filter((m) => takenBy(m).length).length} OF {models.length} TAKEN</Text>
          {models.map((m) => (
            <Text key={m} type="code" size="sm" color={takenBy(m).length ? undefined : "secondary"}>
              {m} · {takenBy(m).join(", ") || "not taken"}
            </Text>
          ))}
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
