"use client";

/* ── more people on one lead ──────────────────────────────────────
 * A brand job with an
 * art director, a producer and a stylist is one client, not three leads.
 * Each person here: their mail lands on this lead, and gallery and delivery
 * mail copies them while "Copy on gallery mail" is ticked.
 * The whole list goes up on every change (`people` in LeadPatch).
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { HStack, VStack, StackItem } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Divider } from "@astryxdesign/core/Divider";
import type { Person } from "@/lib/leads/leads";
import { errorText } from "@/lib/utils";

const BLANK: Person = { name: "", email: "", role: "", phone: "" };

export function People({ people, onSave, isDisabled }: { people: Person[]; onSave: (next: Person[]) => Promise<unknown>; isDisabled?: boolean }) {
  // The row being edited, or "new" for the add form.
  const [open, setOpen] = React.useState<number | "new" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const save = (next: Person[]) => onSave(next).then(() => { setOpen(null); setError(null); }, (e: unknown) => setError(errorText(e)));

  return (
    <VStack gap={3}>
      <HStack gap={2} vAlign="center">
        <StackItem size="fill"><Heading level={2}>People</Heading></StackItem>
        {open === "new" ? null : <Button label="Add a person" variant="ghost" size="sm" isDisabled={isDisabled} onClick={() => { setOpen("new"); setError(null); }} />}
      </HStack>
      {!people.length && open !== "new" ? <Text type="supporting" color="secondary">Add the art director, producer or stylist. Their mail lands here, and gallery mail copies them.</Text> : null}
      {people.map((p, i) =>
        open === i ? (
          <PersonForm key={p.email} value={p} error={error} onSave={(v) => save(people.map((x, j) => (j === i ? v : x)))} onCancel={() => { setOpen(null); setError(null); }} />
        ) : (
          <React.Fragment key={p.email}>
            {i ? <Divider /> : null}
            <HStack gap={3} vAlign="center" wrap="wrap">
              <StackItem size="fill">
                <VStack gap={0}>
                  <Text type="label">{p.name}{p.role ? <Text color="secondary">{` · ${p.role}`}</Text> : null}</Text>
                  <Text type="supporting" color="secondary">{[p.email, p.phone].filter(Boolean).join(" · ")}</Text>
                </VStack>
              </StackItem>
              <CheckboxInput label="Copy on gallery mail" size="sm" value={p.cc !== false} isDisabled={isDisabled}
                onChange={(on) => save(people.map((x, j) => (j === i ? { ...x, cc: on ? undefined : false } : x)))} />
              <Button label="Edit" variant="ghost" size="sm" isDisabled={isDisabled} onClick={() => { setOpen(i); setError(null); }} />
              <Button label="Remove" variant="ghost" size="sm" isDisabled={isDisabled} onClick={() => save(people.filter((_, j) => j !== i))} />
            </HStack>
          </React.Fragment>
        ),
      )}
      {open === "new" ? <PersonForm value={BLANK} error={error} onSave={(v) => save([...people, v])} onCancel={() => { setOpen(null); setError(null); }} /> : null}
      {error && open === null ? <Text type="code" size="sm" color="secondary" role="alert">{error}</Text> : null}
    </VStack>
  );
}

function PersonForm({ value, error, onSave, onCancel }: { value: Person; error: string | null; onSave: (v: Person) => void; onCancel: () => void }) {
  const [d, setD] = React.useState({ name: value.name, role: value.role ?? "", email: value.email, phone: value.phone ?? "" });
  const set = (k: keyof typeof d) => (v: string) => setD({ ...d, [k]: v });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...value, ...d }); }}>
      <VStack gap={3}>
        <HStack gap={2} wrap="wrap">
          <StackItem size="fill"><TextInput label="Name" size="sm" value={d.name} onChange={set("name")} autoComplete="off" hasAutoFocus /></StackItem>
          <StackItem size="fill"><TextInput label="Role" size="sm" value={d.role} onChange={set("role")} placeholder="Art director" autoComplete="off" /></StackItem>
        </HStack>
        <HStack gap={2} wrap="wrap">
          <StackItem size="fill"><TextInput label="Email" type="email" size="sm" value={d.email} onChange={set("email")} isRequired autoComplete="off" /></StackItem>
          <StackItem size="fill"><TextInput label="Phone" type="tel" size="sm" value={d.phone} onChange={set("phone")} isOptional autoComplete="off" /></StackItem>
        </HStack>
        {error ? <Text type="code" size="sm" color="secondary" role="alert">{error}</Text> : null}
        <HStack gap={2}><Button label="Save" variant="primary" size="sm" type="submit" isDisabled={!d.email.trim()} /><Button label="Cancel" variant="ghost" size="sm" onClick={onCancel} /></HStack>
      </VStack>
    </form>
  );
}
