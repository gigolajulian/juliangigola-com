"use client";

/* ── contracts in the desk ────────────────────────────────────────
 * Contracts in Leads. On a lead: pick a
 * template, the text fills from the lead, edit it, Send (mail) or Copy
 * link. Signed: who and when, and the signed copy to download. In
 * Settings: the contract templates. All through /api/contract.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { HStack, VStack, Card } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { adminBlob, adminCall, stampPT } from "@/lib/admin/admin-call";
import { errorText } from "@/lib/utils";
import type { Contract, ContractTemplate } from "@/lib/contracts/contract";

type Got = { contract: Contract | null; url: string | null; error?: string };
const api = <T,>({ path = "", ...init }: RequestInit & { path?: string } = {}) => adminCall<T>(`/api/contract${path}`, init);

/** The signed copy, through the desk's key: a file, never opened on this origin. */
async function downloadCopy(c: Contract) {
  const blob = await adminBlob(`/api/contract?copy=${c.id}`, "Download failed");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Contract - ${c.to.name}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** One lead's contract, under Paperwork. `changed` reloads the list when the Contract status moved. */
export function ContractBlock({ leadId, changed }: { leadId: string; changed: () => void }) {
  const [got, setGot] = React.useState<Got | null>(null);
  const [templates, setTemplates] = React.useState<ContractTemplate[]>([]);
  const [pick, setPick] = React.useState<string>("");
  const [edit, setEdit] = React.useState<Pick<Contract, "to" | "text"> | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  // Said under Make contract: without the list, a new contract would go out on no template.
  const [noTemplates, setNoTemplates] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    api<Got>({ path: `?lead=${encodeURIComponent(leadId)}` }).then((o) => live && setGot(o)).catch((e: unknown) => live && setNote(errorText(e)));
    api<{ templates: ContractTemplate[] }>({ path: "?templates" }).then((o) => { if (live) { setTemplates(o.templates); setPick(o.templates[0]?.id ?? ""); } }).catch(() => live && setNoTemplates(true));
    return () => { live = false; };
  }, [leadId]);

  const c = got?.contract ?? null;
  const shown = (o: Got) => { setGot(o); setEdit(null); };
  const make = () => api<Got>({ method: "POST", body: JSON.stringify({ lead: leadId, template: pick }) }).then((o) => { setGot(o); setEdit({ to: o.contract!.to, text: o.contract!.text }); setNote(null); }).catch((e: unknown) => setNote(errorText(e)));
  const save = (send?: "mail" | "link") => {
    if (!c || !edit) return;
    api<Got>({ method: "PATCH", body: JSON.stringify({ id: c.id, ...edit, send }) })
      .then(async (o) => {
        shown(o);
        if (send === "link" && o.url) await navigator.clipboard.writeText(o.url).catch(() => undefined);
        setNote(send === "mail" ? `Sent to ${o.contract?.to.email}.` : send === "link" ? "Link copied." : "Saved.");
        if (send) changed();
      })
      .catch((e: unknown) => setNote(errorText(e)));
  };

  if (!got) return note ? <Text size="sm" color="secondary">{note}</Text> : null;

  if (c?.signed) {
    return (
      <VStack gap={2}>
        <Text>Signed by {c.signed.name}, {stampPT(c.signed.at)}</Text>
        <Text type="code" size="xsm" color="secondary">SHA-256 {c.signed.hash.slice(0, 16)}</Text>
        <HStack gap={2} wrap="wrap">
          <Button label="Download signed copy" variant="secondary" size="sm" onClick={() => downloadCopy(c).catch((e: unknown) => setNote(errorText(e)))} />
          {got.url ? <Button label="Open" variant="ghost" size="sm" onClick={() => open(got.url!, "_blank", "noreferrer")} /> : null}
          <Button label="New contract" variant="ghost" size="sm" onClick={make} />
        </HStack>
        {note ? <Text size="sm" color="secondary" role="status">{note}</Text> : null}
      </VStack>
    );
  }

  if (edit && c) {
    const set = (k: keyof Contract["to"]) => (v: string) => setEdit({ ...edit, to: { ...edit.to, [k]: v } });
    return (
      <VStack gap={3}>
        <TextInput label="Client name" value={edit.to.name} onChange={set("name")} />
        <TextInput label="Client email" value={edit.to.email} onChange={set("email")} />
        <TextInput label="Client address" value={edit.to.address ?? ""} onChange={set("address")} />
        <TextArea label="Contract" value={edit.text} onChange={(v) => setEdit({ ...edit, text: v })} rows={14} />
        <HStack gap={2} wrap="wrap">
          <Button label="Send" variant="primary" size="sm" onClick={() => save("mail")} />
          <Button label="Copy link" variant="secondary" size="sm" onClick={() => save("link")} />
          <Button label="Save" variant="ghost" size="sm" onClick={() => save()} />
          <Button label="Cancel" variant="ghost" size="sm" onClick={() => setEdit(null)} />
        </HStack>
        {note ? <Text size="sm" color="secondary" role="status">{note}</Text> : null}
      </VStack>
    );
  }

  return (
    <VStack gap={2}>
      {c ? <Text>{c.sentAt ? `Sent ${stampPT(c.sentAt)}, not signed yet` : "Draft, not sent"}</Text> : null}
      <HStack gap={2} wrap="wrap" vAlign="center">
        {c ? (
          <>
            <Button label="Edit" variant="secondary" size="sm" onClick={() => setEdit({ to: c.to, text: c.text })} />
            {c.sentAt && got.url ? <Button label="Copy link" variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(got.url!).then(() => setNote("Link copied."), () => setNote(got.url))} /> : null}
          </>
        ) : (
          <>
            {templates.length > 1 ? <Selector label="Template" isLabelHidden size="sm" variant="secondary" value={pick} onChange={(v) => setPick(String(v))} options={templates.map((t) => ({ value: t.id, label: t.name }))} /> : null}
            <Button label="Make contract" variant="secondary" size="sm" onClick={make} />
          </>
        )}
      </HStack>
      {!c && noTemplates ? <Text size="sm" color="secondary">Contract templates did not load.</Text> : null}
      {note ? <Text size="sm" color="secondary" role="status">{note}</Text> : null}
    </VStack>
  );
}

/** Settings, Contracts: the templates, plain text with fields. */
export function ContractTemplatesDesk() {
  const [list, setList] = React.useState<ContractTemplate[] | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  React.useEffect(() => {
    api<{ templates: ContractTemplate[] }>({ path: "?templates" }).then((o) => setList(o.templates)).catch((e: unknown) => setNote(errorText(e)));
  }, []);
  const edit = (i: number, k: keyof ContractTemplate) => (v: string) => setList(list!.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  const save = () =>
    api<{ templates: ContractTemplate[] }>({ method: "PUT", body: JSON.stringify({ templates: list }) })
      .then((o) => { setList(o.templates); setNote("Saved."); })
      .catch((e: unknown) => setNote(errorText(e)));
  return (
    <VStack gap={4}>
      <Heading level={2}>Contracts</Heading>
      <Text color="secondary">{"{client}, {date}, {fee}, {deposit}, {usage} and {today} fill in from the lead."}</Text>
      {(list ?? []).map((t, i) => (
        <Card key={t.id + i} padding={4}>
          <VStack gap={3}>
            <TextInput label="Name" value={t.name} onChange={edit(i, "name")} />
            <TextArea label="Contract" value={t.body} onChange={edit(i, "body")} rows={12} />
            <HStack><Button label="Remove" variant="ghost" size="sm" onClick={() => setList(list!.filter((_, j) => j !== i))} /></HStack>
          </VStack>
        </Card>
      ))}
      {list ? (
        <HStack gap={2}>
          <Button label="Add a contract" variant="secondary" onClick={() => setList([...list, { id: `c${Date.now()}`, name: "New contract", body: "Between Julian Gigola and {client}.\n\n" }])} />
          <Button label="Save contracts" variant="primary" onClick={save} />
        </HStack>
      ) : null}
      {note ? <Text type="code" size="sm" color="secondary" role="status">{note}</Text> : null}
    </VStack>
  );
}
