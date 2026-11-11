"use client";

import * as React from "react";
import { References } from "@/components/admin/admin-inbox";
import { LeadProofs } from "@/components/admin/admin-proofs";
import type { Enquiry } from "@/lib/inbox";
import { isLate, NUDGES, quoteNudge, REMIND_MAX, STAGES, trashDaysLeft, type Lead, type LeadPatch, type LeadSummary, type Stage } from "@/lib/leads/leads";
import { cn } from "@/lib/utils";
import { fill, mailable, TEMPLATES, type Template } from "@/lib/leads/lead-crm";
import { endDay } from "@/components/leads/lead-licence";
import { leadKey, typingIn } from "@/lib/leads/lead-keys";
import { ago, at, authed, type Call, DAY, day, errorText, loadError, now, type Patch, renew, snoozed } from "@/lib/leads/lead-desk";
import { btn, compose, field, fieldLabel, HEAD, ios, kindOf, line, mailto, MARK, primary, STEPS, Tag } from "@/components/leads/shared";
import { Money, Paperwork } from "@/components/leads/money";

export function Detail({ summary, initial, call, onChange, onBack, reload, tick, templates, others }: { summary: LeadSummary; initial?: Lead | null; call: Call; onChange: (l: Lead) => void; onBack: () => void; reload: () => void; tick: number; templates: Template[]; others: LeadSummary[] }) {
  const [lead, setLead] = React.useState<Lead | null>(initial ?? null);
  const [message, setMessage] = React.useState<Enquiry | null>(null);
  const [msgKey, setMsgKey] = React.useState<string | null>(null);
  const [asked, setAsked] = React.useState(false);
  const [snoozing, setSnoozing] = React.useState(false);
  const [failed, setFailed] = React.useState("");
  const key = `lead:${summary.id}`;

  const patch = React.useCallback(
    async (body: LeadPatch) => {
      const { lead: next } = await call<{ lead: Lead }>({ method: "PATCH", body: JSON.stringify({ key, ...body }) });
      setLead(next);
      onChange(next);
      // A merge deletes the other record; the list has to drop it.
      if (body.mergeFrom) reload();
      return next;
    },
    [call, key, onChange, reload],
  );

  React.useEffect(() => {
    let live = true;
    call<{ lead: Lead }>({ query: `?key=${encodeURIComponent(key)}` }).then(async ({ lead: l }) => {
      if (!live) return;
      setLead(l);
      setFailed("");
      // Their latest words, from the raw row the form stored.
      const ref = [...l.events].reverse().find((e) => e.kind === "inquiry" && e.ref)?.ref;
      if (ref)
        call<{ enquiry: Enquiry }>({ query: `?key=${encodeURIComponent(ref)}` })
          .then((m) => live && (setMessage(m.enquiry), setMsgKey(ref)))
          .catch(() => {});
      if (l.unread) patch({ seen: true }).catch(() => {});
    }).catch((e: unknown) => live && setFailed(loadError(e)));
    return () => void (live = false);
    // Once per lead, and again on a refresh (`tick`): `patch` is stable for the same key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  // On a phone the tapped row is gone, so focus starts at the lead's name.
  const title = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (matchMedia("(max-width: 1023px)").matches) title.current?.focus();
  }, []);

  const l = lead ?? summary;
  const first = l.name.split(" ")[0];
  const late = isLate(l, now());
  // The nudge that is due, as his matching template.
  const nudge = templates.find((t) => t.id === `nudge${NUDGES.indexOf(quoteNudge(l, now()) as (typeof NUDGES)[number]) + 1}`);
  const reply = compose(l.email, `Re: your ${l.kind ?? "shoot"} inquiry`, `Hi ${first},\n\n`);
  const book = compose(l.email, "Booking a time", `Hi ${first},\n\nYou can pick a time here: https://juliangigola.com/book\n\n`);
  // The buttons and the keys share these.
  const snoozeFor = (d: number) => patch({ snoozeUntil: new Date(now() + d * DAY).toISOString() }).then(() => setSnoozing(false));
  const archive = () => patch({ archive: !l.archivedAt });
  const setStage = (s: Stage) => l.stage !== s && patch({ stage: s });
  const replyLink = React.useRef<HTMLAnchorElement>(null);
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      // DeskKeys took it: an overlay is open.
      if (e.defaultPrevented) return;
      const k = leadKey(e, typingIn(e.target), snoozing);
      if (k?.do === "reply" && replyLink.current) replyLink.current.click();
      else if (k?.do === "snooze") setSnoozing((v) => !v);
      else if (k?.do === "snoozeFor") snoozeFor(k.days);
      else if (k?.do === "archive" && !l.trashedAt) archive();
      else if (k?.do === "stage") setStage(STAGES[k.at]);
      else if (k?.do === "close" && snoozing) setSnoozing(false);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 px-6 py-8 lg:px-11 lg:py-9">
      <button type="button" data-detail-back onClick={onBack} className="inline-flex min-h-11 items-center gap-1 justify-self-start text-[16px] text-accent lg:hidden">
        <span aria-hidden="true">‹</span> Leads
      </button>
      <header className="min-w-0">
        {kindOf(l.kind) ? <p className="font-mono text-[11px] font-medium uppercase tracking-[0.09em]">{kindOf(l.kind)}</p> : null}
        <h1 ref={title} tabIndex={-1} style={HEAD} className="mt-1 text-[30px] leading-tight outline-none">{l.name}</h1>
        <p className="mt-1 break-words text-[15px] text-muted-foreground">{l.email}</p>
        {failed ? <p role="alert" className="mt-2 text-[14px] text-destructive">{failed}</p> : null}
        {l.stage === "Lost" ? (
          <p className="mt-5"><Tag tone="quiet" mark={MARK.Lost}>Lost</Tag></p>
        ) : (
          <ol aria-label={`Stage: ${l.stage}`} className="mt-5 grid grid-cols-9 gap-1">
            {STEPS.map((s, k) => {
              const at = STEPS.indexOf(l.stage);
              return (
                <li key={s} aria-current={k === at ? "step" : undefined} className={cn("truncate border-t-[3px] pt-2 font-mono text-[11px]", k < at ? "border-foreground/55 text-muted-foreground" : k === at ? "border-foreground font-medium text-foreground" : "border-border text-muted-foreground")}>
                  {/* A phone is too narrow for nine names: the line alone, the current one named below. */}
                  <span className="max-sm:sr-only">{s === "Call booked" ? "Call" : s}</span>
                </li>
              );
            })}
          </ol>
        )}
        {l.stage !== "Lost" ? <p aria-hidden="true" className="mt-2 font-mono text-[12px] font-medium sm:hidden">{l.stage}</p> : null}
      </header>

      {late ? (
        <p role="status" className="flex items-center gap-3 rounded-xl bg-accent/12 px-4 py-3.5 text-[15px]">
          <span aria-hidden="true" className="text-accent">◷</span>
          <span><b className="font-semibold text-accent">{ago(l.stageAt)} waiting.</b> {l.stage === "Quoted" ? (quoteNudge(l, now()) === "Mark as lost?" ? "Three nudges, no answer. Mark it lost?" : "The quote has had no answer.") : "The site promises a reply within a day."}</span>
          {nudge && mailable(l.email) ? <a href={ios() ? mailto(l.email, fill(nudge.subject, l), fill(nudge.body, l)) : compose(l.email, fill(nudge.subject, l), fill(nudge.body, l))} target="_blank" rel="noreferrer" className="ml-auto shrink-0 font-mono text-[12.5px] font-medium text-accent">{nudge.name} →</a> : null}
        </p>
      ) : null}
      {renew(l) && mailable(l.email) ? (() => {
        const t = templates.find((x) => x.id === "renew") ?? TEMPLATES.find((x) => x.id === "renew")!;
        const subject = fill(t.subject, l);
        const body = fill(t.body, l);
        return (
          <p role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-accent/12 px-4 py-3.5 text-[15px]">
            <span className="flex-1"><b className="font-semibold text-accent">Licence ends {endDay(l.licence!.end)}.</b> {l.licence!.use}</span>
            <a href={ios() ? mailto(l.email, subject, body) : compose(l.email, subject, body)} target="_blank" rel="noreferrer" className={cn(btn, primary)}>Renew licence</a>
          </p>
        );
      })() : null}
      {l.trashedAt ? (
        <p role="status" className="font-mono text-[13px] text-muted-foreground">
          In the trash. Deleted for good in {Math.max(1, trashDaysLeft(l.trashedAt, now()))} days unless recovered.
        </p>
      ) : null}
      {l.flags?.includes("stuck") ? (
        <p role="status" className="rounded-xl bg-destructive/10 px-4 py-3.5 text-[15px] text-destructive">
          A deposit was paid but not booked. Refund or rebook it in Stripe.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        {mailable(l.email) ? (<>
        <a ref={replyLink} href={reply} target="_blank" rel="noreferrer" onClick={() => setAsked(true)} className={cn(btn, !renew(l) && primary, "min-h-[52px] px-5 text-base")}>
          Reply in Gmail
        </a>
        {ios() ? (
          <a
            href={mailto(l.email, `Re: your ${l.kind ?? "shoot"} inquiry`, `Hi ${first},\n\n`, message ? { name: message.name, at: message.at, text: message.message } : undefined)}
            onClick={() => setAsked(true)}
            className={btn}
          >
            Reply in Mail
          </a>
        ) : null}
        <a href={book} target="_blank" rel="noreferrer" className={btn}>Send booking link</a>
        </>) : null}
        <button type="button" onClick={() => setSnoozing((v) => !v)} aria-expanded={snoozing} className={btn}>Snooze</button>
        {snoozed(l) ? <button type="button" className={btn} onClick={() => patch({ snoozeUntil: "" }).then(() => setSnoozing(false))}>Unsnooze</button> : null}
        {l.trashedAt ? null : <button type="button" className={btn} onClick={archive}>{l.archivedAt ? "Unarchive" : "Archive"}</button>}
        <button type="button" className={btn} onClick={() => patch({ trash: !l.trashedAt })}>{l.trashedAt ? "Recover" : "Move to trash"}</button>
        <button type="button" className={btn} onClick={() => patch({ seen: false }).then(onBack)}>Mark unread</button>
        <span className="flex-1" />
        {lead?.notion ? <a href={`https://www.notion.so/${lead.notion.replace(/-/g, "")}`} target="_blank" rel="noreferrer" className={btn}>Notion</a> : null}
      </div>

      {asked && l.stage === "Inquiry" ? (
        <p className="flex flex-wrap items-center gap-3 text-[15px]">
          Sent it?
          <button type="button" className={btn} onClick={() => patch({ stage: "Replied" }).then(() => setAsked(false))}>Mark as Replied</button>
        </p>
      ) : null}
      {snoozing ? (
        <div className="flex flex-wrap gap-2">
          {[["1 day", 1], ["3 days", 3], ["1 week", 7]].map(([t, d]) => (
            <button key={t} type="button" className={btn} onClick={() => snoozeFor(Number(d))}>{t}</button>
          ))}
          <label className={cn(btn, "gap-2")}>
            Until
            <input
              type="date"
              min={new Date(now() + DAY).toISOString().slice(0, 10)}
              onChange={(e) => e.target.value && patch({ snoozeUntil: new Date(`${e.target.value}T09:00:00`).toISOString() }).then(() => setSnoozing(false))}
              className="bg-transparent font-mono text-[14px]"
            />
          </label>
        </div>
      ) : null}

      <fieldset className="grid gap-2.5">
        <legend className="mb-2.5 font-mono text-[13px] text-muted-foreground">Stage</legend>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={l.stage === s}
              onClick={() => setStage(s)}
              className={cn(
                "min-h-11 rounded-[4px] border px-3 font-mono text-[12.5px] transition-colors duration-200",
                l.stage === s
                  ? "border-accent bg-accent font-semibold text-accent-foreground"
                  : STAGES.indexOf(s) < STAGES.indexOf(l.stage) && s !== "Lost"
                    ? "border-border text-foreground hoverable:hover:bg-card"
                    : "border-dashed border-border text-muted-foreground hoverable:hover:bg-card",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </fieldset>

      {(["Confirmed", "Shot", "Delivered"] as Stage[]).includes(l.stage) ? <Paperwork l={l} patch={patch} /> : null}

      <LeadProofs email={l.email} />

      <LeadCrm l={l} full={lead} patch={patch} others={others} templates={templates} />

      {message ? (
        <div className="grid gap-2">
          {message.detail ? <p className="text-[15px] text-muted-foreground">{message.detail}</p> : null}
          <p className="max-w-[64ch] whitespace-pre-line rounded-xl bg-background px-4 py-4 text-[15px] leading-relaxed">{message.message}</p>
          {/* Their uploads come through /api/inbox with the same key as everything here; never a public URL. */}
          {msgKey && (message.files?.length || message.picks?.length) ? (
            <References msgKey={msgKey} enquiry={message} auth={authed()} />
          ) : null}
        </div>
      ) : null}

      <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[15px]">
        <dt className="font-mono text-[13px] leading-6 text-muted-foreground">First seen</dt>
        <dd>{at(l.firstAt)}</dd>
        {l.when ? (<><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Booked for</dt><dd>{at(l.when)}</dd></>) : null}
        {message?.context?.referrer || message?.context?.landing ? (
          <><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Came from</dt><dd className="break-words">{[message.context.referrer, message.context.landing].filter(Boolean).join(", ")}</dd></>
        ) : null}
      </dl>

      {lead ? (
        <section aria-label="Timeline" className="grid gap-2.5">
          <h3 aria-level={2} style={{ ...HEAD, fontFamily: "var(--font-mono)", fontWeight: 400, letterSpacing: 0 }} className="text-[13px] text-muted-foreground">Timeline</h3>
          <ol className="grid gap-2">
            {[...lead.events].reverse().map((e, i) => (
              <li key={i} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 text-[14.5px]">
                <span className="font-mono text-[13px] leading-6 text-muted-foreground">{day(e.at)}</span>
                <span className="break-words">{line(e)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

/** The CRM half of a lead: how to reach them, saved replies, a reminder, the quote, notes, merge. */
function LeadCrm({ l, full, patch, others, templates }: { l: LeadSummary; full: Lead | null; patch: Patch; others: LeadSummary[]; templates: Template[] }) {
  const [editing, setEditing] = React.useState(false);
  const [d, setD] = React.useState({ name: "", phone: "", ig: "", company: "", source: "", kind: "" });
  const [notes, setNotes] = React.useState<string | null>(null);
  const [rAt, setRAt] = React.useState("");
  const [rText, setRText] = React.useState("");
  const [quote, setQuote] = React.useState<string | null>(null);
  const [into, setInto] = React.useState("");
  const [sure, setSure] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const run = (p: Promise<unknown>, ok?: string) => p.then(() => setNote(ok ?? null)).catch((e: unknown) => setNote(errorText(e)));
  const mail = mailable(l.email);
  const ig = full?.ig ?? (l.email.startsWith("ig:") ? l.email.slice(3) : undefined);
  const phone = full?.phone ?? (l.email.startsWith("tel:") ? l.email.slice(4) : undefined);
  const local = (iso: string) => new Date(Date.parse(iso) - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
  const h3 = "font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      {mail && templates.length ? (
        <section className="grid gap-2.5">
          <h3 aria-level={2} className={h3}>Reply with a template</h3>
          <div className="flex flex-wrap gap-2">
            {templates.filter((t) => t.id !== "renew" || l.licence).map((t) => {
              const subject = fill(t.subject, l);
              const body = fill(t.body, l);
              return (
                <a key={t.id} href={ios() ? mailto(l.email, subject, body) : compose(l.email, subject, body)} target="_blank" rel="noreferrer" className={btn}>
                  {t.name}
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-2.5">
        <h3 aria-level={2} className={h3}>Contact</h3>
        {editing ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(patch({ details: d }).then(() => setEditing(false)), "Saved.");
            }}
          >
            {(["name", "phone", "ig", "company", "kind", "source"] as const).map((k) => (
              <label key={k} className={fieldLabel}>
                {{ name: "Name", phone: "Phone", ig: "Instagram", company: "Brand or company", kind: "What they want", source: "Came from" }[k]}
                <input value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} className={field} autoComplete="off" />
              </label>
            ))}
            <div className="flex gap-2.5">
              <button type="submit" className={cn(btn, primary)}>Save</button>
              <button type="button" onClick={() => setEditing(false)} className={btn}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px]">
              {mail ? (<><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Email</dt><dd className="break-words">{l.email}</dd></>) : null}
              {phone ? (<><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Phone</dt><dd><a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-accent">{phone}</a></dd></>) : null}
              {ig ? (<><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Instagram</dt><dd><a href={`https://instagram.com/${ig.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="text-accent">{ig}</a></dd></>) : null}
              {full?.company ? (<><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Company</dt><dd>{full.company}</dd></>) : null}
              {full?.source ? (<><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Came from</dt><dd>{full.source}</dd></>) : null}
            </dl>
            <button
              type="button"
              className={cn(btn, "justify-self-start")}
              onClick={() => {
                setD({ name: l.name, phone: full?.phone ?? "", ig: full?.ig ?? "", company: full?.company ?? "", kind: l.kind ?? "", source: full?.source ?? "" });
                setEditing(true);
              }}
            >
              Edit details
            </button>
          </>
        )}
      </section>

      <section className="grid gap-2.5">
        <h3 aria-level={2} className={h3}>Reminder</h3>
        {full?.remind ? (
          <p className="flex flex-wrap items-center gap-3 text-[15px]">
            <span><b className="font-semibold">{at(full.remind.at)}</b>{full.remind.text ? `: ${full.remind.text}` : ""}</span>
            <button type="button" className={btn} onClick={() => run(patch({ remind: null }), "Reminder cleared.")}>Clear</button>
          </p>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (rAt) run(patch({ remind: { at: new Date(rAt).toISOString(), text: rText } }).then(() => { setRAt(""); setRText(""); }), "Reminder set.");
            }}
          >
            <label className={fieldLabel}>When<input type="datetime-local" required value={rAt} min={local(new Date().toISOString())} onChange={(e) => setRAt(e.target.value)} className={cn(field, "w-auto font-mono text-[14px]")} /></label>
            {/* Short enough that the row always shows all of it. */}
            <label className={cn(fieldLabel, "min-w-[12rem] flex-1")}>
              <span className="flex justify-between">What for<span className="font-mono text-muted-foreground">{rText.length}/{REMIND_MAX}</span></span>
              <input value={rText} maxLength={REMIND_MAX} onChange={(e) => setRText(e.target.value)} placeholder="Send the quote" className={field} />
            </label>
            <button type="submit" className={btn}>Remind me</button>
          </form>
        )}
      </section>

      <Money l={l} full={full} patch={patch} run={run} quote={quote} setQuote={setQuote} />

      <section className="grid gap-2.5">
        <h3 aria-level={2} className={h3}>Notes</h3>
        <textarea
          value={notes ?? full?.notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== null && notes !== (full?.notes ?? "") && run(patch({ notes }), "Notes saved.")}
          rows={5}
          placeholder="Only you see these."
          className={cn(field, "py-3 leading-relaxed")}
        />
      </section>

      {others.length ? (
        <section className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
          <h3 aria-level={2} className={h3}>Same person, another record</h3>
          <div className="flex flex-wrap items-end gap-2.5">
            <select value={into} onChange={(e) => { setInto(e.target.value); setSure(false); }} className={cn(field, "w-auto min-w-0 max-w-full")} aria-label="Record to merge in">
              <option value="">Pick the other record</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.name} · {mailable(o.email) ? o.email : o.email.slice(o.email.indexOf(":") + 1)}</option>)}
            </select>
            {into ? (
              sure ? (
                <button type="button" className={cn(btn, primary)} onClick={() => run(patch({ mergeFrom: `lead:${into}` }).then(() => { setInto(""); setSure(false); }), "Merged.")}>
                  Merge into this one
                </button>
              ) : (
                <button type="button" className={btn} onClick={() => setSure(true)}>Merge</button>
              )
            ) : null}
          </div>
          {sure ? <p className="text-[14px] text-muted-foreground">The timeline and notes of the other record move here, and it is deleted.</p> : null}
        </section>
      ) : null}

      {note ? <p role="status" className="font-mono text-[13px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}
