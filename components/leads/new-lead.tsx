"use client";

/* ── New lead on Astryx ───────────────────────────────────────────
 * Julian (2026-11-10) approved the mock (claude.ai/artifact/WWQy2jVbaeTG7sdDKgGmU5,
 * #new): how they reached him, the name, one way back to them, what they
 * want, the stage and notes. Same POST `{ add }` as the classic
 * NewLeadForm (components/leads/setup.tsx). New here: a lead already on
 * the desk with the same name, email, Instagram or phone shows before he adds a second.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Layout, LayoutContent, LayoutHeader, HStack, VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Banner } from "@astryxdesign/core/Banner";
import { STAGES, type Lead, type LeadSummary, type Stage } from "@/lib/leads/leads";
import { type Call, errorText } from "@/lib/leads/lead-desk";

const SOURCES = ["Instagram DM", "Referral", "Text", "Phone call", "Email", "In person", "Other"];
const norm = (s: string) => s.trim().toLowerCase().replace(/^@/, "");
const digits = (s: string) => s.replace(/\D/g, "");

/** A lead on the desk that is likely the same person: same name, email, handle or phone. */
export function sameAs(leads: LeadSummary[], f: { name: string; email: string; ig: string; phone: string }) {
  const name = norm(f.name);
  const keys = [f.email && norm(f.email), f.ig && `ig:${norm(f.ig)}`, digits(f.phone).length >= 7 && `tel:${digits(f.phone)}`].filter(Boolean) as string[];
  return leads.find((l) => {
    const e = l.email.toLowerCase();
    const id = e.startsWith("tel:") ? `tel:${digits(e)}` : e.startsWith("ig:") ? `ig:${norm(e.slice(3))}` : e;
    return keys.includes(id) || (name.length > 2 && norm(l.name) === name);
  });
}

export function NewLeadDesk({ call, leads, size, done, open, cancel }: { call: Call; leads: LeadSummary[]; size: "phone" | "mid" | "wide"; done: (id: string, lead: Lead) => void; open: (l: LeadSummary) => void; cancel: () => void }) {
  const [f, setF] = React.useState({ name: "", email: "", ig: "", phone: "", company: "", kind: "", stage: "Inquiry" as Stage, source: "Instagram DM", notes: "" });
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const twin = sameAs(leads, f);
  const reachable = !!(f.email.trim() || f.ig.trim() || f.phone.trim());

  const add = () => {
    setBusy(true);
    setNote(null);
    call<{ id: string; lead: Lead }>({ method: "POST", body: JSON.stringify({ add: f }) })
      .then((o) => done(o.id, o.lead))
      .catch((err: unknown) => setNote(errorText(err)))
      .finally(() => setBusy(false));
  };

  return (
    <Layout
      height="fill"
      defaultHasDividers
      header={<LayoutHeader><VStack gap={0}><Text type="code" size="xsm" color="secondary" weight="medium">BY HAND · A CALL, A DM, A REFERRAL</Text><Heading level={1} weight="bold">New lead</Heading></VStack></LayoutHeader>}
      content={
        <LayoutContent role="main" label="New lead" padding={4}>
          <form onSubmit={(e) => { e.preventDefault(); if (f.name.trim() && reachable) add(); }}>
            <VStack gap={4} maxWidth={560}>
              {size === "phone" ? (
                <Selector label="How they reached you" value={f.source} onChange={set("source")} options={SOURCES} />
              ) : (
                <VStack gap={2}>
                  <Text type="label">How they reached you</Text>
                  <SegmentedControl label="How they reached you" value={f.source} onChange={set("source")} size="sm">
                    {SOURCES.map((s) => <SegmentedControlItem key={s} value={s} label={s} />)}
                  </SegmentedControl>
                </VStack>
              )}
              <TextInput label="Name" value={f.name} onChange={set("name")} isRequired autoComplete="off" />
              {twin ? (
                <Banner status="warning" title={`${twin.name || twin.email} is already a lead`} description={`${twin.stage}, last heard ${new Date(twin.lastAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`}
                  endContent={<Button label="Open it" variant="secondary" size="sm" onClick={() => open(twin)} />} />
              ) : null}
              <Text type="supporting" color="secondary">One of email, Instagram or phone, so the lead has a way back to them.</Text>
              <Grid columns={{ minWidth: 220 }} gap={3}>
                <TextInput label="Email" value={f.email} onChange={set("email")} autoComplete="off" inputMode="email" />
                <TextInput label="Instagram" value={f.ig} onChange={set("ig")} placeholder="@handle" autoComplete="off" />
                <TextInput label="Phone" value={f.phone} onChange={set("phone")} autoComplete="off" inputMode="tel" />
                <TextInput label="Brand or company" value={f.company} onChange={set("company")} isOptional autoComplete="off" />
              </Grid>
              <Grid columns={{ minWidth: 220 }} gap={3}>
                <TextInput label="What they want" value={f.kind} onChange={set("kind")} placeholder="Portrait, campaign, wedding" isOptional />
                <Selector label="Stage" value={f.stage} onChange={set("stage")} options={[...STAGES]} />
              </Grid>
              <TextArea label="Notes" value={f.notes} onChange={set("notes")} rows={4} placeholder="What they said" isOptional />
              {note ? <Text color="secondary" role="alert">{note}</Text> : null}
              <HStack gap={2}>
                <Button label={busy ? "Adding" : "Add lead"} variant="primary" type="submit" isDisabled={busy || !f.name.trim() || !reachable} />
                <Button label="Cancel" variant="ghost" onClick={cancel} />
              </HStack>
            </VStack>
          </form>
        </LayoutContent>
      }
    />
  );
}
