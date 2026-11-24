"use client";

/* ── the lead page on Astryx ──────────────────────────────────────
 * One lead with every action on it, laid out as header,
 * sections and a timeline rail. Rendered only
 * inside /admin/leads, so Astryx's CSS stays off the site.
 *
 * Header: back, snooze, lost, the rest under ⋯; the next step as the one
 * filled button beside Reply and the templates. Sections: message,
 * session, money, paperwork, proofs, contact, notes. Wide: the timeline
 * in the end panel; narrower: last section. The invoice sheet (design B)
 * and their uploads are plain components of their own, not Astryx.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Layout, LayoutContent, LayoutHeader, LayoutPanel, HStack, VStack, StackItem, Section } from "@astryxdesign/core/Layout";
import { Card } from "@astryxdesign/core/Card";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Banner } from "@astryxdesign/core/Banner";
import { Badge } from "@astryxdesign/core/Badge";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Divider } from "@astryxdesign/core/Divider";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { DateInput } from "@astryxdesign/core/DateInput";
import { TimeInput } from "@astryxdesign/core/TimeInput";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Kbd } from "@astryxdesign/core/Kbd";
import { References } from "@/components/desk/references";
import { proofApi, type ProofRow } from "@/lib/proofs/proof-desk";
import { InvoiceRow, InvoiceSheetB } from "@/components/leads/invoice";
import { ContractBlock } from "@/components/leads/contract";
import { isSettled } from "@/lib/leads/invoice";
import { endDay, type Size } from "@/lib/leads/lead-desk";
import { errorText } from "@/lib/utils";
import type { Enquiry } from "@/lib/leads/enquiry";
import { canonical } from "@/lib/seal";
import { leadView, type LeadView } from "@/lib/leads/lead-view";
import { isStage, PAPER, REMIND_MAX, STAGES, trashDaysLeft, WON, type Lead, type LeadPatch, type LeadSummary, type Stage } from "@/lib/leads/leads";
import { fillTemplate, mailable, type Template } from "@/lib/leads/lead-crm";
import { leadKey, typingIn } from "@/lib/leads/lead-keys";
import { depositOfLead, usd } from "@/lib/leads/invoice";
import { ago, dateTimeLabel, dayLabel, deskCall, now, needsRenewal, isSnoozed, sendLeadPatch } from "@/lib/leads/lead-desk";
import { DAY_MS } from "@/lib/time-zone";
import { adminCall, authed } from "@/lib/admin/admin-call";
import { glyph } from "@/components/desk/chrome";
import { compose, eventSentence, frostBar, isIosDevice, kindOf, mailto } from "@/components/leads/shared";
import { People } from "@/components/leads/people";
import { Galleries } from "@/components/leads/galleries";
import { PlanSection, TaskSection } from "@/components/leads/plan";

/** A menu row that opens in a new tab. */
const NEW_TAB = { target: "_blank", rel: "noreferrer" } as const;
const LOST_REASONS = ["Price", "Dates", "No reply", "Went elsewhere", "Not a fit", "Other"];
const ROAD = STAGES.filter((s) => s !== "Lost");
const BackGlyph = glyph(<path d="M19 12H5M11 6l-6 6 6 6" />);
const ClockGlyph = glyph(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>);
const PlaneGlyph = glyph(<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" />);
const MailGlyph = glyph(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>);

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text type="code" size="xsm" color="secondary" weight="medium">{children}</Text>;
}

/** A section title with its actions at the end. */
function Head({ title, children }: { title: string; children?: React.ReactNode }) {
  return <HStack gap={2} vAlign="center"><StackItem size="fill"><Heading level={2}>{title}</Heading></StackItem>{children}</HStack>;
}

/** The one filled button. Under a mouse its words turn to what sending it wins, and the plane flies (WIN_CSS in shared.tsx). */
function Win({ label, win, href, onClick }: { label: string; win: string; href: string; onClick: () => void }) {
  const [over, setOver] = React.useState(false);
  return (
    <span className="jg-win" style={{ display: "inline-flex" }} onPointerEnter={(e) => e.pointerType === "mouse" && setOver(true)} onPointerLeave={() => setOver(false)}>
      <Button label={over ? win : label} variant="primary" icon={<Icon icon={PlaneGlyph} />} href={href} target="_blank" rel="noreferrer" onClick={onClick} />
    </span>
  );
}

/** A folded section's row: its title and one line of what is inside. */
function Fold({ title, note }: { title: string; note?: string }) {
  return <HStack gap={3} vAlign="center"><Heading level={2}>{title}</Heading>{note ? <Text type="body" size="sm" color="secondary" maxLines={1}>{note}</Text> : null}</HStack>;
}
const many = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** A mail link: Mail on iOS, a Gmail compose window elsewhere. */
const mail = (to: string, subject: string, body: string) => (isIosDevice() ? mailto(to, subject, body) : compose(to, subject, body));
/** `YYYY-MM-DDTHH:MM` in his clock, for the reminder fields. */
const localParts = (iso: string) => new Date(Date.parse(iso) - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16).split("T");

/** The whole log and the lead's own last 50, as one list: the log only starts at the day it shipped. */
const history = (log: Lead["events"] | null, own: Lead["events"]) => {
  const seen = new Set<string>();
  return [...(log ?? []), ...own]
    .filter((e) => { const k = `${e.at}|${e.kind}|${e.ref ?? ""}|${e.note ?? ""}`; return !seen.has(k) && !!seen.add(k); })
    .sort((a, b) => a.at.localeCompare(b.at));
};

/** One lead as its page reads it: the record, the message it came in with, the whole log and the galleries.
    Loaded once per lead and marked seen; `patch` writes a change and hands the new record to the list. */
function useLeadDetail({ summary, initial, onChange, reload, onLoadError }: { summary: LeadSummary; initial?: Lead | null; onChange: (l: Lead) => void; reload: () => void; onLoadError: (text: string) => void }) {
  // A lead added a moment ago comes in whole: KV may not serve its key yet.
  const [lead, setLead] = React.useState<Lead | null>(initial ?? null);
  const [message, setMessage] = React.useState<Enquiry | null>(null);
  const [msgKey, setMsgKey] = React.useState<string | null>(null);
  const [proofs, setProofs] = React.useState<ProofRow[]>([]);
  const id = summary.id!;
  // The parts that did not load, named on one line: a failed load never reads as an empty section.
  const [missed, setMissed] = React.useState<string[]>([]);
  const loaded = React.useCallback((what: string, ok: boolean) => setMissed((m) => (ok ? m.filter((x) => x !== what) : m.includes(what) ? m : [...m, what])), []);

  const patch = React.useCallback(
    async (body: LeadPatch) => {
      const next = await sendLeadPatch(id, body);
      setLead(next);
      onChange(next);
      // A merge deletes the other record; the list has to drop it.
      if (body.mergeFrom) reload();
      return next;
    },
    [id, onChange, reload],
  );
  // The whole activity log (`lib/leads/activity-log.ts`); the lead itself keeps only its last 50 events.
  const [log, setLog] = React.useState<Lead["events"] | null>(null);
  const newest = lead?.events.at(-1)?.at ?? "";
  React.useEffect(() => {
    let live = true;
    deskCall<{ log: Lead["events"] }>({ path: `/log?id=${encodeURIComponent(summary.id ?? "")}` })
      .then((o) => { if (live) { setLog(o.log); loaded("the full timeline", true); } })
      .catch(() => live && loaded("the full timeline", false));
    return () => { live = false; };
  }, [summary.id, newest, loaded]);

  React.useEffect(() => {
    let live = true;
    deskCall<{ lead: Lead }>({ path: `?id=${encodeURIComponent(summary.id ?? "")}` }).then(({ lead: l }) => {
      if (!live) return;
      setLead(l);
      // Their latest words, from the raw row the form stored.
      const ref = [...l.events].reverse().find((e) => e.kind === "inquiry" && e.ref)?.ref;
      if (ref)
        adminCall<{ enquiry: Enquiry }>(`/api/inbox?key=${encodeURIComponent(ref)}`)
          .then((m) => live && (setMessage(m.enquiry), setMsgKey(ref)))
          .catch(() => live && loaded("their message", false));
      if (l.unread) patch({ seen: true }).catch(() => {});
    }).catch((e: unknown) => live && !initial && onLoadError(errorText(e)));
    proofApi<{ proofs: ProofRow[] }>({ path: "/list" })
      .then((o) => live && setProofs(o.proofs.filter((p) => p.email)))
      .catch(() => live && loaded("galleries", false));
    return () => void (live = false);
    // Once per lead: `patch` is stable for the same id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { lead, message, msgKey, proofs, log, missed, patch };
}

type Editing = "contact" | "quote" | "remind" | "licence" | "snooze" | "merge" | "invoice" | null;

/** The lead page's actions that do more than one PATCH: snooze, archive and stage (also on keys:
    R reply, S snooze, E archive, T task, 1 to 9 stage), and cancelling or marking a no-show on the booking the site made.
    It owns which form is open; `run` reports a promise in the note, and the `run` it hands back also closes the form once it lands. */
function useLeadActions({ view, lead, patch, run: report, reload }: { view: LeadView; lead: Lead | null; patch: (b: LeadPatch) => Promise<Lead>; run: (p: Promise<unknown>, ok?: string) => unknown; reload: () => void }) {
  const [editing, setEditing] = React.useState<Editing>(null);
  const [addingTask, setAddingTask] = React.useState(false);
  const run = (p: Promise<unknown>, ok?: string) => {
    const out = report(p, ok);
    p.then(() => setEditing(null), () => {});
    return out;
  };
  const { l, booked, which, first } = view;
  const snoozeFor = (d: number) => run(patch({ snoozeUntil: new Date(now() + d * DAY_MS).toISOString() }), "Snoozed.");
  const archive = () => run(patch({ archive: !l.archivedAt }), l.archivedAt ? "Back in the list." : "Archived.");
  const setStage = (s: Stage) => l.stage !== s && run(patch({ stage: s }));

  const replyLink = React.useRef<HTMLAnchorElement>(null);
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const k = leadKey(e, typingIn(e.target), editing === "snooze");
      if (k?.do === "reply" && replyLink.current) replyLink.current.click();
      else if (k?.do === "snooze") setEditing((v) => (v === "snooze" ? null : "snooze"));
      else if (k?.do === "snoozeFor") snoozeFor(k.days);
      else if (k?.do === "archive" && !l.trashedAt) archive();
      else if (k?.do === "task" && lead) setAddingTask(true);
      else if (k?.do === "stage") setStage(STAGES[k.at]);
      else if (k?.do === "close" && editing) setEditing(null);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  });

  const desk = (action: "cancel-mine" | "no-show", ok: string) => run(adminCall(`/api/booking/${booked}/desk`, { method: "POST", body: JSON.stringify({ action }) }).then(reload), ok);
  const cancelMine = () => {
    if (window.confirm(`Cancel ${which}? The event leaves the calendar, the deposit is refunded in full through Stripe, and ${first} is emailed.`)) desk("cancel-mine", "Cancelled and refunded.");
  };
  const noShow = () => {
    if (window.confirm(`Mark ${which} as a no-show? It is logged here and mailed to hello@. Nothing is refunded and ${first} is not emailed.`)) desk("no-show", "Marked a no-show.");
  };
  return { editing, setEditing, addingTask, setAddingTask, run, snoozeFor, archive, setStage, replyLink, cancelMine, noShow };
}
type LeadActions = ReturnType<typeof useLeadActions>;
type SnoozeItem = { label: string; onClick: () => void } | { type: "divider" };

/** The header's ⋯ menu. On a phone it also carries snooze and lost, which the header drops there. */
function LeadMoreMenu({ view, lead, actions, patch, snoozeItems, phone, canMerge, onBack, setNote }: { view: LeadView; lead: Lead | null; actions: LeadActions; patch: (b: LeadPatch) => Promise<Lead>; snoozeItems: SnoozeItem[]; phone: boolean; canMerge: boolean; onBack: () => void; setNote: (text: string) => void }) {
  const { l, booked, ahead } = view;
  const { setStage, archive, setEditing, cancelMine, noShow, run } = actions;
  return (
    <MoreMenu
      size="sm"
      alignment="end"
      items={[
        ...(phone ? [{ type: "section" as const, title: "Snooze", items: snoozeItems.filter((i): i is { label: string; onClick: () => void } => "label" in i) }, { label: "Mark as lost", onClick: () => setStage("Lost") }] : []),
        ...(l.trashedAt ? [] : [{ label: l.archivedAt ? "Unarchive" : "Archive", onClick: archive }]),
        { label: "Mark unread", onClick: () => patch({ seen: false }).then(onBack, (e: unknown) => setNote(errorText(e))) },
        ...(canMerge ? [{ label: "Merge with another record", onClick: () => setEditing("merge") }] : []),
        ...(booked ? [ahead ? { label: "Cancel and refund in full", onClick: cancelMine } : { label: "Mark as no-show", onClick: noShow }] : []),
        ...(lead?.notion ? [{ label: "Open in Notion", href: `https://www.notion.so/${lead.notion.replace(/-/g, "")}`, ...NEW_TAB }] : []),
        { type: "divider" as const },
        { label: l.trashedAt ? "Recover" : "Move to trash", variant: (l.trashedAt ? "default" : "destructive") as "default" | "destructive", onClick: () => run(patch({ trash: !l.trashedAt }), l.trashedAt ? "Recovered." : "In the trash.") },
      ]}
    />
  );
}

/** Reply: the next step as the one filled button, Gmail, the templates and the booking link. Only for a lead with a mail address. */
function LeadReplyBar({ view, templates, message, replyLink, onSent }: { view: LeadView; templates: Template[]; message: Enquiry | null; replyLink: React.RefObject<HTMLAnchorElement | null>; onSent: () => void }) {
  const { l, first, primary } = view;
  const replyHref = mail(l.email, `Re: your ${l.kind ?? "shoot"} inquiry`, `Hi ${first},\n\n`);
  const bookHref = mail(l.email, "Booking a time", `Hi ${first},\n\nYou can pick a time here: https://juliangigola.com/book\n\n`);
  const primaryAction = primary ? { label: primary.label, win: primary.win, href: mail(...primary.mail) } : null;
  const usable = templates.filter((t) => t.id !== "renew" || l.licence);
  return (
    <HStack gap={2} wrap="wrap">
      {primaryAction ? <Win label={primaryAction.label} win={primaryAction.win} href={primaryAction.href} onClick={onSent} /> : null}
      <a ref={replyLink} href={replyHref} target="_blank" rel="noreferrer" hidden aria-hidden="true" tabIndex={-1} onClick={onSent} />
      <Button label="Reply in Gmail" variant={primaryAction ? "secondary" : "primary"} icon={<Icon icon={MailGlyph} />} href={replyHref} target="_blank" rel="noreferrer" onClick={onSent} />
      <DropdownMenu
        button={{ label: "Template", variant: "secondary" }}
        items={[
          ...(usable.length ? [{ type: "section" as const, title: "Reply with a template", items: usable.map((t) => ({ label: t.name, href: mail(l.email, fillTemplate(t.subject, l), fillTemplate(t.body, l)), ...NEW_TAB, onClick: onSent })) }, { type: "divider" as const }] : []),
          ...(isIosDevice() ? [{ label: "Reply in Mail", href: mailto(l.email, `Re: your ${l.kind ?? "shoot"} inquiry`, `Hi ${first},\n\n`, message ? { name: message.name, at: message.at, text: message.message } : undefined), onClick: onSent }] : []),
          { label: "Send booking link", href: bookHref, ...NEW_TAB },
        ]}
      />
    </HStack>
  );
}

/** Every event, newest first, then where the lead came from. Wide: the end panel, with the keys; narrower: a folded section. */
function LeadTimeline({ view, lead, log, message, wide }: { view: LeadView; lead: Lead | null; log: Lead["events"] | null; message: Enquiry | null; wide: boolean }) {
  const { l } = view;
  return (
    <VStack gap={4}>
      {wide ? <Heading level={2}>Timeline</Heading> : null}
      {lead ? (
        <VStack gap={4}>
          {history(log, lead.events).reverse().map((e, i) => (
            <VStack key={i} gap={0}>
              <Eyebrow>{dayLabel(e.at).toUpperCase()}</Eyebrow>
              <Text type="body">{eventSentence(e)}</Text>
            </VStack>
          ))}
        </VStack>
      ) : <Eyebrow>LOADING</Eyebrow>}
      <Divider />
      <MetadataList>
        <MetadataListItem label="First seen">{dateTimeLabel(l.firstAt)}</MetadataListItem>
        {l.when ? <MetadataListItem label="Booked for">{dateTimeLabel(l.when)}</MetadataListItem> : null}
        {lead?.source ? <MetadataListItem label="Came from">{lead.source}</MetadataListItem> : null}
        {message?.context?.referrer || message?.context?.landing ? <MetadataListItem label="Landed from">{[message.context.referrer, message.context.landing].filter(Boolean).join(", ")}</MetadataListItem> : null}
        {lead?.notion ? <MetadataListItem label="Notion">Bookings row linked</MetadataListItem> : null}
      </MetadataList>
      {wide ? (
        <Text type="supporting" color="secondary"><Kbd keys="r" /> reply · <Kbd keys="s" /> snooze · <Kbd keys="e" /> archive · <Kbd keys="t" /> task · <Kbd keys="1" />–<Kbd keys="9" /> stage</Text>
      ) : null}
    </VStack>
  );
}

/** What to do now, first on the page, with how long it has waited. `reply` sits beside it (none on a phone, where it is the bottom bar). */
function LeadNextCard({ view, reply }: { view: LeadView; reply: React.ReactNode }) {
  const { l, step, late, nudgeStep } = view;
  return (
    <Card padding={3}>
      <HStack gap={4} vAlign="center" wrap="wrap">
        <StackItem size="fill">
          <VStack gap={1}>
            <Text type="supporting" color="secondary">Next step</Text>
            <Heading level={2}>{step ?? "Reply"}</Heading>
            {late ? (
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Badge label={`${ago(l.stageAt)} waiting`} variant="warning" />
                <Text type="body" size="sm" color="secondary">{l.stage === "Quoted" ? (nudgeStep === "Mark as lost?" ? "Three nudges, no answer. Mark it lost?" : "The quote has had no answer.") : "The site promises a reply within a day."}</Text>
              </HStack>
            ) : null}
          </VStack>
        </StackItem>
        {reply}
      </HStack>
    </Card>
  );
}

/** An action asked for from the ⌘K palette; `n` makes each ask new. */
export type LeadAsk = { do: "task" | "invoice"; n: number };

export function LeadDesk({ summary, initial, onChange, onBack, reload, templates, others, size, toProofs, ask }: { ask?: LeadAsk | null; toProofs?: (token?: string) => void; summary: LeadSummary; initial?: Lead | null; onChange: (l: Lead) => void; onBack: () => void; reload: () => void; templates: Template[]; others: LeadSummary[]; size: Size }) {
  const [asked, setAsked] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const { lead, message, msgKey, proofs, log, missed, patch } = useLeadDetail({ summary, initial, onChange, reload, onLoadError: setNote });
  const view = leadView(lead, summary, templates, now());
  const actions = useLeadActions({ view, lead, patch, run: (p, ok) => p.then(() => setNote(ok ?? null)).catch((e: unknown) => setNote(errorText(e))), reload });
  const { editing, setEditing, addingTask, setAddingTask, run, snoozeFor, setStage, replyLink } = actions;

  // A new ask from the palette opens its form, once (state adjusted in render, not an effect).
  const [seenAsk, setSeenAsk] = React.useState(ask?.n);
  if (ask && ask.n !== seenAsk) {
    setSeenAsk(ask.n);
    if (ask.do === "task") setAddingTask(true);
    else setEditing("invoice");
  }
  const { l, mailOk, ig, phone, late, step, paidAt, invoiced, owed } = view;
  // The client's galleries: sent to the lead's address or to any of its people.
  const theirs = new Set([l.email, ...(lead?.people ?? []).map((p) => p.email)].map(canonical));
  const galleries = proofs.filter((p) => theirs.has(canonical(p.email!)));

  const phoneSize = size === "phone";
  const snoozeItems: SnoozeItem[] = [
    { label: "1 day", onClick: () => snoozeFor(1) },
    { label: "3 days", onClick: () => snoozeFor(3) },
    { label: "1 week", onClick: () => snoozeFor(7) },
    { label: "Pick a date", onClick: () => setEditing("snooze") },
    ...(isSnoozed(l) ? [{ type: "divider" as const }, { label: "Unsnooze", onClick: () => run(patch({ snoozeUntil: "" }), "Unsnoozed.") }] : []),
  ];
  const more = <LeadMoreMenu view={view} lead={lead} actions={actions} patch={patch} snoozeItems={snoozeItems} phone={phoneSize} canMerge={others.length > 0} onBack={onBack} setNote={setNote} />;
  const reply = mailOk ? <LeadReplyBar view={view} templates={templates} message={message} replyLink={replyLink} onSent={() => setAsked(true)} /> : null;
  const timeline = <LeadTimeline view={view} lead={lead} log={log} message={message} wide={size === "wide"} />;

  const at0 = ROAD.indexOf(l.stage as (typeof ROAD)[number]);

  const [contactOpen, setContactOpen] = React.useState(false);
  // What to do now, first on the page. On a phone its buttons sit in the bar at the bottom.
  const nextCard = step || late ? <LeadNextCard view={view} reply={phoneSize ? null : reply} /> : null;

  return (
    <>
    <Layout
      height="fill"
      defaultHasDividers
      header={
        <LayoutHeader>
          <VStack gap={3}>
            <HStack gap={2} vAlign="center">
              <Button label="Leads" variant="ghost" size="sm" icon={<Icon icon={BackGlyph} />} onClick={onBack} />
              <StackItem size="fill" />
              {phoneSize ? null : <DropdownMenu button={{ label: isSnoozed(l) ? `Snoozed to ${dayLabel(l.snoozeUntil!)}` : "Snooze", variant: "ghost", size: "sm", icon: <Icon icon={ClockGlyph} /> }} alignment="end" items={snoozeItems} />}
              {phoneSize || l.stage === "Lost" ? null : <Button label="Mark as lost" variant="ghost" size="sm" onClick={() => setStage("Lost")} />}
              {more}
            </HStack>
            <HStack gap={4} vAlign="end" wrap="wrap">
              <StackItem size="fill">
                <VStack gap={1}>
                  <Text type="body" size="sm" color="secondary">{[kindOf(l.kind), l.when ? dayLabel(l.when) : null, lead?.source ? `Came from ${lead.source}` : null].filter(Boolean).join(" · ") || "Lead"}</Text>
                  <Heading level={1}>{l.name}</Heading>
                  <Text type="body" color="secondary">{[mailOk ? l.email : null, ig, phone].filter(Boolean).join(" · ")}</Text>
                </VStack>
              </StackItem>
              {nextCard || phoneSize ? null : reply}
            </HStack>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent role="main" label="Lead" padding={4}>
          <VStack gap={4}>
            {nextCard}
            {note ? <Text type="code" size="sm" color="secondary" role="status">{note}</Text> : null}
            {missed.length ? <Text type="code" size="sm" color="secondary" role="status">{`Did not load: ${missed.join(", ")}.`}</Text> : null}
            {l.trashedAt ? <Banner status="warning" title="In the trash" description={`Deleted for good in ${Math.max(1, trashDaysLeft(l.trashedAt, now()))} days unless recovered.`} endContent={<Button label="Recover" variant="secondary" size="sm" onClick={() => run(patch({ trash: false }), "Recovered.")} />} /> : null}
            {l.flags?.includes("stuck") ? <Banner status="error" title="A deposit was paid but not booked" description="Refund or rebook it in Stripe, or send the booking link." endContent={lead?.deposit ? <Button label="Open Stripe" variant="secondary" size="sm" href={lead.deposit} target="_blank" rel="noreferrer" /> : undefined} /> : null}
            {needsRenewal(l) && l.licence ? <Banner status="info" title={`Licence ends ${endDay(l.licence.end)}`} description={l.licence.use} /> : null}
            {asked && l.stage === "Inquiry" ? <Banner status="info" title="Sent it?" endContent={<Button label="Mark as Replied" variant="secondary" size="sm" onClick={() => run(patch({ stage: "Replied" }).then(() => setAsked(false)))} />} /> : null}
            {editing === "snooze" ? (
              <Banner status="info" title="Snooze until" isDismissable onDismiss={() => setEditing(null)}
                endContent={<DateInput label="Snooze until" isLabelHidden size="sm" min={new Date(now() + DAY_MS).toISOString().slice(0, 10) as never} onChange={(v) => v && run(patch({ snoozeUntil: new Date(`${v}T09:00:00`).toISOString() }), "Snoozed.")} />} />
            ) : null}
            {editing === "merge" ? <Merge others={others} onMerge={(other) => run(patch({ mergeFrom: other }), "Merged.")} onClose={() => setEditing(null)} /> : null}

            <Section>
              <HStack gap={4} vAlign="end" wrap="wrap">
                <StackItem size="fill">
                  <VStack gap={1}>
                    <HStack gap={2} vAlign="center"><StackItem size="fill"><Text type="label">{l.stage}</Text></StackItem>{at0 >= 0 ? <Text type="code" size="xsm" color="secondary">{at0 + 1} of {ROAD.length}</Text> : null}</HStack>
                    {at0 >= 0 ? <ProgressBar label="Stage" isLabelHidden value={at0 + 1} max={ROAD.length} /> : null}
                  </VStack>
                </StackItem>
                <Selector label="Stage" isLabelHidden size="sm" variant="secondary" value={l.stage} onChange={(v) => isStage(v) && setStage(v)} options={[...STAGES]} />
                {l.stage === "Lost" ? <Selector label="Why it was lost" isLabelHidden size="sm" variant="secondary" placeholder="Why it was lost" value={lead?.lostReason || undefined} onChange={(v) => run(patch({ lostReason: v }), "Saved.")} options={LOST_REASONS} /> : null}
              </HStack>
            </Section>

            {message ? (
              <Section>
                <VStack gap={3}>
                  <Head title="Their message"><Eyebrow>{dateTimeLabel(message.at).toUpperCase()}</Eyebrow></Head>
                  {message.detail ? <Text type="body" color="secondary">{message.detail}</Text> : null}
                  <Text type="body">{message.message}</Text>
                  {/* Their uploads come through /api/inbox with the same key as everything here; never a public URL. */}
                  {msgKey && (message.files?.length || message.picks?.length) ? <References msgKey={msgKey} enquiry={message} auth={authed()} /> : null}
                </VStack>
              </Section>
            ) : null}

            <Section>
              <VStack gap={3}>
                <Head title="Money">
                  <Button label={lead?.quote !== undefined ? "Edit quote" : "Add a quote"} variant="ghost" size="sm" isDisabled={!lead} onClick={() => setEditing("quote")} />
                  <Button label="New invoice" variant="secondary" size="sm" isDisabled={!lead} onClick={() => setEditing("invoice")} />
                </Head>
                {editing === "quote" ? <QuoteForm value={lead?.quote} onSave={(n) => run(patch({ quote: n }), "Quote saved.")} onCancel={() => setEditing(null)} /> : null}
                <MetadataList>
                  <MetadataListItem label="Quote">{lead?.quote !== undefined ? <Text type="code">{usd(lead.quote)}</Text> : <Text color="secondary">None yet</Text>}</MetadataListItem>
                  <MetadataListItem label="Deposit">
                    {lead?.deposit ? <HStack gap={2} vAlign="center"><StackItem size="fill"><Text type="code">{usd(depositOfLead(lead))} paid{paidAt ? `, ${dayLabel(paidAt)}` : ""}</Text></StackItem><Button label="Stripe" variant="ghost" size="sm" href={lead.deposit} target="_blank" rel="noreferrer" /></HStack> : <Text color="secondary">None</Text>}
                  </MetadataListItem>
                  {invoiced !== undefined ? <MetadataListItem label="Invoiced"><Text type="code">{usd(invoiced)}</Text></MetadataListItem> : null}
                  {owed !== undefined ? <MetadataListItem label="Balance"><Text type="code" weight="bold" color="accent">{usd(owed)}</Text></MetadataListItem> : null}
                  <MetadataListItem label="Licence">
                    {editing === "licence" ? null : lead?.licence ? (
                      <HStack gap={2} vAlign="center"><StackItem size="fill"><Text>{lead.licence.use || "Licence"}, ends {endDay(lead.licence.end)}</Text></StackItem><Button label="Edit" variant="ghost" size="sm" onClick={() => setEditing("licence")} /></HStack>
                    ) : <HStack gap={2} vAlign="center"><StackItem size="fill"><Text color="secondary">None</Text></StackItem><Button label="Add a licence" variant="ghost" size="sm" isDisabled={!lead} onClick={() => setEditing("licence")} /></HStack>}
                  </MetadataListItem>
                </MetadataList>
                {editing === "licence" ? <LicenceForm has={lead?.licence} onSave={(v) => run(patch({ licence: v }), v ? "Licence saved." : "Licence cleared.")} onCancel={() => setEditing(null)} /> : null}
                {/* The invoice rows and design B are plain components: the sheet is its own page. */}
                {lead?.invoices?.length ? <ul>{[...lead.invoices].reverse().map((inv) => (
                  <React.Fragment key={inv.no}>
                    <InvoiceRow inv={inv} l={l} full={lead} />
                    <li style={{ listStyle: "none" }}><HStack gap={2} vAlign="center">
                      {isSettled(inv) ? <Badge label={inv.paidAt ? `Paid ${dayLabel(inv.paidAt)}` : "Paid"} variant="success" /> : <Badge label="Unpaid" variant="neutral" />}
                      <Button label={isSettled(inv) ? "Mark unpaid" : "Mark paid"} variant="ghost" size="sm" onClick={() => run(patch({ invoicePaid: { no: inv.no, paid: !isSettled(inv) } }), isSettled(inv) ? "Unpaid again." : "Marked paid.")} />
                    </HStack></li>
                  </React.Fragment>
                ))}</ul> : null}
                {editing === "invoice" && lead ? <InvoiceSheetB l={l} full={lead} patch={patch} done={() => setEditing(null)} /> : null}
              </VStack>
            </Section>

            <Section>
              <VStack gap={3}>
                <Head title="Session">
                  {editing === "remind" ? null : lead?.remind ? (
                    <Button label="Clear reminder" variant="ghost" size="sm" onClick={() => run(patch({ remind: null }), "Reminder cleared.")} />
                  ) : <Button label="Set reminder" variant="ghost" size="sm" isDisabled={!lead} onClick={() => setEditing("remind")} />}
                </Head>
                <MetadataList>
                  <MetadataListItem label="Shoot">{kindOf(l.kind) ?? <Text color="secondary">Not set</Text>}</MetadataListItem>
                  <MetadataListItem label="Date">{l.when ? dateTimeLabel(l.when) : <Text color="secondary">Not booked</Text>}</MetadataListItem>
                  <MetadataListItem label="Reminder">{lead?.remind ? `${dateTimeLabel(lead.remind.at)}${lead.remind.text ? `: ${lead.remind.text}` : ""}` : <Text color="secondary">None</Text>}</MetadataListItem>
                </MetadataList>
                {editing === "remind" ? <RemindForm onSave={(iso, text) => run(patch({ remind: { at: iso, text } }), "Reminder set.")} onCancel={() => setEditing(null)} /> : null}
              </VStack>
            </Section>

            {/* A plan is for a shoot in sight: from the quote on, or once one exists. */}
            {lead?.plan || (["Quoted", "Confirmed", "Shot"] as Stage[]).includes(l.stage) ? <Section>
              <PlanSection plan={lead?.plan} people={lead?.people ?? []} isDisabled={!lead} phone={phoneSize} onSave={(plan) => patch({ plan })} />
            </Section> : null}

            <Section>
              <TaskSection tasks={lead?.tasks ?? []} people={lead?.people ?? []} isDisabled={!lead} adding={addingTask && !!lead} setAdding={setAddingTask} keys={size === "wide"} onSave={(tasks) => patch({ tasks })} />
            </Section>

            {WON.includes(l.stage) ? (
              <Section>
                <VStack gap={3}>
                  <Heading level={2}>Paperwork</Heading>
                  <MetadataList>
                    {(["contract", "release"] as const).map((k) => (
                      <MetadataListItem key={k} label={k === "contract" ? "Contract" : "Model release"}>
                        <Selector
                          label={k === "contract" ? "Contract" : "Model release"}
                          isLabelHidden
                          size="sm"
                          variant="ghost"
                          value={l[k] ?? "Not sent"}
                          onChange={(v) => run(patch({ [k]: v }))}
                          options={[...PAPER]}
                          renderValue={(o) => <HStack gap={2} vAlign="center"><StatusDot variant={o.value === "Signed" ? "success" : o.value === "Sent" ? "accent" : "neutral"} label={String(o.value)} /><Text>{String(o.label)}</Text></HStack>}
                        />
                      </MetadataListItem>
                    ))}
                  </MetadataList>
                  {summary.id ? <ContractBlock leadId={summary.id} changed={reload} /> : null}
                </VStack>
              </Section>
            ) : null}

            {galleries.length ? (
              <Section>
                <Galleries galleries={galleries} lead={l.email} open={(t) => toProofs?.(t)} />
              </Section>
            ) : null}

            <Section>
              <Collapsible isOpen={contactOpen || editing === "contact"} onOpenChange={setContactOpen} trigger={<Fold title="Contact" note={[lead?.company, lead?.source].filter(Boolean).join(" · ")} />}>
              <VStack gap={3}>
                <HStack hAlign="end">{editing === "contact" ? null : <Button label="Edit details" variant="ghost" size="sm" onClick={() => setEditing("contact")} />}</HStack>
                {editing === "contact" ? (
                  <ContactForm l={l} full={lead} onSave={(d) => run(patch({ details: d }), "Saved.")} onCancel={() => setEditing(null)} />
                ) : (
                  <MetadataList>
                    {mailOk ? <MetadataListItem label="Email">{l.email}</MetadataListItem> : null}
                    {phone ? <MetadataListItem label="Phone"><a href={`tel:${phone.replace(/[^\d+]/g, "")}`}><Text color="accent">{phone}</Text></a></MetadataListItem> : null}
                    {ig ? <MetadataListItem label="Instagram"><a href={`https://instagram.com/${ig.replace(/^@/, "")}`} target="_blank" rel="noreferrer"><Text color="accent">{ig}</Text></a></MetadataListItem> : null}
                    {lead?.company ? <MetadataListItem label="Company">{lead.company}</MetadataListItem> : null}
                    {lead?.source ? <MetadataListItem label="Came from">{lead.source}</MetadataListItem> : null}
                  </MetadataList>
                )}
              </VStack>
              </Collapsible>
            </Section>

            <Section>
              <People people={lead?.people ?? []} isDisabled={!lead} onSave={(people) => patch({ people })} />
            </Section>

            <Section>
              <Collapsible key={lead ? "loaded" : "loading"} defaultIsOpen={!!lead?.notes} trigger={<Fold title="Notes" note={lead?.notes ? "1 note" : "None"} />}>
                <Notes key={lead ? "loaded" : "loading"} value={lead?.notes ?? ""} onSave={(notes) => run(patch({ notes }), "Notes saved.")} />
              </Collapsible>
            </Section>

            {size === "wide" ? null : <Section><Collapsible defaultIsOpen={false} trigger={<Fold title="Timeline" note={lead ? many(history(log, lead.events).length, "event") : ""} />}>{timeline}</Collapsible></Section>}
          </VStack>
        </LayoutContent>
      }
      end={size === "wide" ? <LayoutPanel width={360} hasDivider label="Timeline">{timeline}</LayoutPanel> : undefined}
    />
    {phoneSize && reply ? <div style={{ ...frostBar, padding: 12 }}>{reply}</div> : null}
    </>
  );
}

function RemindForm({ onSave, onCancel }: { onSave: (iso: string, text: string) => void; onCancel: () => void }) {
  const [d0, t0] = localParts(new Date(now() + DAY_MS).toISOString());
  const [d, setD] = React.useState(d0);
  const [t, setT] = React.useState(t0);
  const [text, setText] = React.useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (d && t) onSave(new Date(`${d}T${t}`).toISOString(), text); }}>
      <HStack gap={2} vAlign="end" wrap="wrap">
        <DateInput label="Day" size="sm" value={d as never} min={localParts(new Date().toISOString())[0] as never} onChange={(v) => setD(v ?? "")} />
        <TimeInput label="Time" size="sm" value={t as never} onChange={(v) => setT(v ?? "")} />
        <StackItem size="fill"><TextInput label={`What for (${text.length}/${REMIND_MAX})`} size="sm" value={text} onChange={(v) => setText(v.slice(0, REMIND_MAX))} placeholder="Send the quote" /></StackItem>
        <Button label="Remind me" variant="primary" size="sm" type="submit" />
        <Button label="Cancel" variant="ghost" size="sm" onClick={onCancel} />
      </HStack>
    </form>
  );
}

function QuoteForm({ value, onSave, onCancel }: { value?: number; onSave: (n: number | null) => void; onCancel: () => void }) {
  const [n, setN] = React.useState<number | null>(value ?? null);
  return (
    <HStack gap={2} vAlign="end" wrap="wrap">
      <NumberInput label="Quote in dollars" size="sm" value={n} onChange={(v) => setN(v ?? null)} min={0} hasClear width={180} onEnter={() => onSave(n)} />
      <Button label="Save" variant="primary" size="sm" onClick={() => onSave(n)} />
      <Button label="Cancel" variant="ghost" size="sm" onClick={onCancel} />
    </HStack>
  );
}

function LicenceForm({ has, onSave, onCancel }: { has?: { use: string; end: string }; onSave: (v: { use: string; end: string } | null) => void; onCancel: () => void }) {
  const [use, setUse] = React.useState(has?.use ?? "");
  const [end, setEnd] = React.useState(has?.end ?? "");
  return (
    <HStack gap={2} vAlign="end" wrap="wrap">
      <StackItem size="fill"><TextInput label="Licence" size="sm" value={use} onChange={setUse} placeholder="Web + social, US" /></StackItem>
      <DateInput label="Ends" size="sm" value={(end || undefined) as never} onChange={(v) => setEnd(v ?? "")} />
      <Button label="Save" variant="primary" size="sm" isDisabled={!end} onClick={() => onSave({ use, end })} />
      {has ? <Button label="Clear" variant="ghost" size="sm" onClick={() => onSave(null)} /> : null}
      <Button label="Cancel" variant="ghost" size="sm" onClick={onCancel} />
    </HStack>
  );
}

function ContactForm({ l, full, onSave, onCancel }: { l: LeadSummary; full: Lead | null; onSave: (d: NonNullable<LeadPatch["details"]>) => void; onCancel: () => void }) {
  const [d, setD] = React.useState({ name: l.name, phone: full?.phone ?? "", ig: full?.ig ?? "", company: full?.company ?? "", kind: l.kind ?? "", source: full?.source ?? "" });
  const names = { name: "Name", phone: "Phone", ig: "Instagram", company: "Brand or company", kind: "What they want", source: "Came from" } as const;
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(d); }}>
      <VStack gap={3}>
        {(Object.keys(names) as (keyof typeof names)[]).map((k) => <TextInput key={k} label={names[k]} size="sm" value={d[k]} onChange={(v) => setD({ ...d, [k]: v })} autoComplete="off" />)}
        <HStack gap={2}><Button label="Save" variant="primary" size="sm" type="submit" /><Button label="Cancel" variant="ghost" size="sm" onClick={onCancel} /></HStack>
      </VStack>
    </form>
  );
}

/** Saved when he leaves the box. */
function Notes({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = React.useState(value);
  return <TextArea label="Notes" isLabelHidden description="Only you see these. Saved when you leave the box." value={v} onChange={setV} onBlur={() => v !== value && onSave(v)} rows={5} placeholder="Anything worth remembering" />;
}

function Merge({ others, onMerge, onClose }: { others: LeadSummary[]; onMerge: (id: string) => void; onClose: () => void }) {
  const [into, setInto] = React.useState<string | undefined>();
  return (
    <Banner status="warning" title="Merge another record into this one" description="Its timeline and notes move here, and the other record is deleted." isDismissable onDismiss={onClose}
      endContent={
        <HStack gap={2}>
          <Selector label="Other record" isLabelHidden size="sm" hasSearch placeholder="Pick the other record" value={into} onChange={setInto}
            options={others.map((o) => ({ value: o.id ?? "", label: `${o.name} · ${mailable(o.email) ? o.email : o.email.slice(o.email.indexOf(":") + 1)}` }))} />
          <Button label="Merge" variant="primary" size="sm" isDisabled={!into} onClick={() => into && onMerge(into)} />
        </HStack>
      } />
  );
}
