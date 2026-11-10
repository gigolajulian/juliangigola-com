"use client";

import * as React from "react";
import { credentials, KEY_STORE } from "@/lib/admin-github";
import { STAGES, type Lead, type Stage } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { btn, type Call, HEAD, money, primary, type Template, field, fieldLabel } from "@/components/leads/shared";

/** Notifications for this device: a new lead pings the installed app. */
const PUSH_FLAG = "jg-leads-push";
const SW_URL = "/admin/leads/sw.js";
/** The app is the whole origin on leads.juliangigola.com, /admin/leads on the main site. */
const swScope = () => (location.hostname.startsWith("leads.") ? "/" : "/admin/leads");
function PushSwitch({ call }: { call: Call }) {
  // The desk renders only in the browser (after its list loads), so these read the page directly.
  const able = typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const [on, setOn] = React.useState<boolean | null>(null);
  const [note, setNote] = React.useState<string | null>(() =>
    able ? null : /iPhone|iPad/.test(navigator.userAgent) ? "Open the installed Leads app to turn these on." : "This browser cannot do notifications.",
  );
  React.useEffect(() => {
    if (!able) return;
    navigator.serviceWorker.getRegistration(swScope()).then((r) => r?.pushManager.getSubscription()).then((s) => setOn(!!s)).catch(() => setOn(false));
  }, [able]);

  const turnOn = async () => {
    setNote(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setNote("Notifications are blocked for this app in Settings.");
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: swScope() });
      await navigator.serviceWorker.ready;
      const { key } = (await call({ query: "?vapid" })) as { key: string };
      const raw = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
      await call({ method: "PATCH", body: JSON.stringify({ push: sub.toJSON() }) });
      try { localStorage.setItem(PUSH_FLAG, "1"); } catch {}
      setOn(true);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };
  const turnOff = async () => {
    try {
      const sub = await (await navigator.serviceWorker.getRegistration(swScope()))?.pushManager.getSubscription();
      if (sub) {
        await call({ method: "PATCH", body: JSON.stringify({ push: { endpoint: sub.endpoint }, off: true }) });
        await sub.unsubscribe();
      }
      setOn(false);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };
  const sendTest = async () => {
    setNote("Sending.");
    try {
      const { devices } = (await call({ method: "PATCH", body: JSON.stringify({ test: true }) })) as { devices: number };
      setNote(devices ? `Arrives in 10 seconds on ${devices} ${devices === 1 ? "device" : "devices"}. Lock the phone now: no banner shows while the app is open.` : "No device is subscribed. Turn notifications off and on again here.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="grid gap-1 px-3 pt-4 font-mono text-[12.5px] text-muted-foreground">
      {on === null ? null : (
        <button type="button" onClick={on ? turnOff : turnOn} className="min-h-11 w-fit text-left hoverable:hover:text-foreground">
          Notifications: <span className={on ? "text-accent" : undefined}>{on ? "on" : "off"}</span>
        </button>
      )}
      {on ? (
        <button type="button" onClick={sendTest} className="min-h-11 w-fit text-left hoverable:hover:text-foreground">
          Send a test
        </button>
      ) : null}
      {note ? <p>{note}</p> : null}
    </div>
  );
}

type Count = { people: number; added: number; updated: number; stages: Partial<Record<Stage, number>> };

/** Julian: "add the stuff i have in my juliangigola admin inbox to my leads".
 * Counts first (a dry run), imports only on his second press. */
function ImportInbox({ call, done }: { call: Call; done: () => void }) {
  const [count, setCount] = React.useState<Count | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const run = (dry: boolean) => {
    setBusy(true);
    setNote(null);
    call({ method: "POST", body: JSON.stringify({ backfill: true, dry }) })
      .then((o) => {
        const c = o as unknown as Count;
        if (dry) return c.added + c.updated ? setCount(c) : setNote("Everything in the Inbox is already here.");
        setCount(null);
        setNote(`Imported: ${c.added} new, ${c.updated} updated.`);
        done();
      })
      .catch((e: unknown) => setNote(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };
  const by = count ? Object.entries(count.stages).map(([s, n]) => `${s} ${n}`).join(", ") : "";
  return (
    <div className="grid gap-2 px-3 pt-4 font-mono text-[12.5px] text-muted-foreground">
      {count ? (
        <>
          <p>
            {count.added} new{by ? ` (${by})` : ""}, {count.updated} updated, from {count.people} {count.people === 1 ? "person" : "people"} in the Inbox.
          </p>
          <p className="flex gap-4">
            <button type="button" disabled={busy} onClick={() => run(false)} className="min-h-11 text-accent">Import</button>
            <button type="button" disabled={busy} onClick={() => setCount(null)} className="min-h-11">Cancel</button>
          </p>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => run(true)} className="min-h-11 w-fit text-left hoverable:hover:text-foreground">
          {busy ? "Counting" : "Import from Inbox"}
        </button>
      )}
      {note ? <p>{note}</p> : null}
    </div>
  );
}

export function SignIn({ onKey, wrong }: { onKey: (k: string) => void; wrong: boolean }) {
  const [k, setK] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (k.trim()) onKey(k.trim());
      }}
      className="grid max-w-md gap-4 py-10 normal-case"
    >
      <h1 className="sr-only">Leads</h1>
      <label htmlFor="lead-key" className="text-[15px]">Inbox key or GitHub token</label>
      <input
        id="lead-key"
        type="password"
        autoComplete="current-password"
        value={k}
        onChange={(e) => setK(e.target.value)}
        className="min-h-12 rounded-[10px] border border-border bg-background px-4 text-base normal-case"
      />
      {wrong ? <p className="text-[15px] text-destructive">That was not accepted. Paste it again.</p> : null}
      <details className="text-[15px] text-muted-foreground">
        <summary className="flex size-11 cursor-pointer list-none items-center font-mono text-[15px]" aria-label="How to get one">?</summary>
        <div className="grid gap-2 pt-2 leading-[1.55]">
          <p>Easiest: paste the same GitHub token I use for /admin on desktop.</p>
          <p>
            To make one on this phone: github.com, Settings, Developer settings, Fine-grained tokens, Generate new token.
            Repository access: only gigolajulian/juliangigola-com. Permissions: Contents, Read and write.
          </p>
          <p>It stays on this device only.</p>
        </div>
      </details>
      <button type="submit" className={cn(btn, primary, "justify-self-start")}>Open leads</button>
    </form>
  );
}


/** Deletes every lead in the trash for good, after a second press. */
function EmptyTrash({ n, call, done }: { n: number; call: Call; done: () => void }) {
  const [sure, setSure] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const empty = () => {
    setBusy(true);
    call({ method: "DELETE", body: JSON.stringify({ emptyTrash: true }) }).then(done).catch((e) => console.error("empty trash", e)).finally(() => { setBusy(false); setSure(false); });
  };
  return (
    <p className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 text-[15px]">
      {sure ? (
        <>
          <span>Delete {n} for good? This cannot be undone.</span>
          <button type="button" disabled={busy} onClick={empty} className={cn(btn, "text-destructive")}>Delete for good</button>
          <button type="button" disabled={busy} onClick={() => setSure(false)} className={btn}>Cancel</button>
        </>
      ) : (
        <button type="button" onClick={() => setSure(true)} className={btn}>Empty trash</button>
      )}
    </p>
  );
}

const SOURCES = ["Instagram DM", "Referral", "Text", "Phone call", "Email", "In person", "Other"];

/* ── the CRM tools: a lead by hand, the numbers, templates, the export ── */

/** A lead he adds himself: someone who wrote on Instagram, texted, or was referred. */
function NewLeadForm({ call, done }: { call: Call; done: (id: string, lead: Lead) => void }) {
  const [f, setF] = React.useState({ name: "", email: "", ig: "", phone: "", company: "", kind: "", stage: "Inquiry" as Stage, source: "Instagram DM", notes: "" });
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); };
  return (
    <form
      className="grid gap-4 px-1 py-5 lg:px-5"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setNote(null);
        call({ method: "POST", body: JSON.stringify({ add: f }) })
          .then((o) => done(o.id as string, o.lead as Lead))
          .catch((err: unknown) => setNote(err instanceof Error ? err.message : String(err)))
          .finally(() => setBusy(false));
      }}
    >
      <label className={fieldLabel}>Name<input required value={f.name} onChange={set("name")} className={field} autoComplete="off" /></label>
      <p className="font-mono text-[12px] text-muted-foreground">One of these three, so the lead has a way back to them.</p>
      <label className={fieldLabel}>Email<input type="email" value={f.email} onChange={set("email")} className={field} autoComplete="off" /></label>
      <label className={fieldLabel}>Instagram<input value={f.ig} onChange={set("ig")} placeholder="@handle" className={field} autoComplete="off" /></label>
      <label className={fieldLabel}>Phone<input type="tel" value={f.phone} onChange={set("phone")} className={field} autoComplete="off" /></label>
      <label className={fieldLabel}>Brand or company<input value={f.company} onChange={set("company")} className={field} autoComplete="off" /></label>
      <label className={fieldLabel}>What they want<input value={f.kind} onChange={set("kind")} placeholder="Portrait, campaign, wedding" className={field} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className={fieldLabel}>Stage
          <select value={f.stage} onChange={set("stage")} className={field}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className={fieldLabel}>Came from
          <select value={f.source} onChange={set("source")} className={field}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
      </div>
      <label className={fieldLabel}>Notes<textarea value={f.notes} onChange={set("notes")} rows={4} className={cn(field, "py-3 leading-relaxed")} /></label>
      {note ? <p role="alert" className="text-[15px] text-destructive">{note}</p> : null}
      <button type="submit" disabled={busy} className={cn(btn, primary, "justify-self-start")}>{busy ? "Adding" : "Add lead"}</button>
    </form>
  );
}

type Stats = {
  total: number;
  weeks: { start: string; inquiries: number; booked: number }[];
  replyHours: number | null;
  bookedRate: number | null;
  sources: { source: string; leads: number; booked: number }[];
  lost: { reason: string; n: number }[];
  pipeline: number;
  won: number;
  stages: Partial<Record<Stage, number>>;
};
const hours = (h: number | null) => (h === null ? "None yet" : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`);

/** The numbers: is the site turning inquiries into bookings, and how fast does he answer. */
function StatsView({ call }: { call: Call }) {
  const [s, setS] = React.useState<Stats | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => {
    call({ query: "?stats" }).then((o) => setS(o.stats as Stats)).catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [call]);
  if (err) return <p className="px-1 py-8 text-[15px] text-muted-foreground lg:px-5">{err}</p>;
  if (!s) return <p className="px-1 py-8 font-mono text-[13px] text-muted-foreground lg:px-5">Counting</p>;
  const top = Math.max(1, ...s.weeks.map((w) => w.inquiries));
  const tile = (k: string, v: string, hint: string) => (
    <div className="grid gap-1 rounded-xl border border-border p-3.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{k}</span>
      <span style={HEAD} className="text-[26px] leading-none">{v}</span>
      <span className="text-[12.5px] text-muted-foreground">{hint}</span>
    </div>
  );
  return (
    <div className="grid gap-6 px-1 py-5 lg:px-5">
      <div className="grid grid-cols-2 gap-2.5">
        {tile("Booked", s.bookedRate === null ? "None yet" : `${Math.round(s.bookedRate * 100)}%`, "of leads over a week old")}
        {tile("First reply", hours(s.replyHours), "median, inquiry to answer")}
        {tile("Quoted, open", money(s.pipeline), "waiting on an answer")}
        {tile("Booked value", money(s.won), "from the quotes you entered")}
      </div>
      <section className="grid gap-2.5">
        <h3 aria-level={2} className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Last 12 weeks</h3>
        <div className="flex h-32 items-end gap-1.5" role="img" aria-label={s.weeks.map((w) => `Week of ${w.start}: ${w.inquiries} inquiries, ${w.booked} booked`).join(". ")}>
          {s.weeks.map((w) => (
            <div key={w.start} className="relative flex h-full flex-1 items-end" title={`Week of ${w.start}: ${w.inquiries} in, ${w.booked} booked`}>
              <div className="w-full rounded-t-[3px] bg-border" style={{ height: `${(w.inquiries / top) * 100}%` }} />
              <div className="absolute bottom-0 w-full rounded-t-[3px] bg-accent" style={{ height: `${(Math.min(w.booked, w.inquiries || w.booked) / top) * 100}%` }} />
            </div>
          ))}
        </div>
        <p className="flex gap-4 font-mono text-[12px] text-muted-foreground">
          <span><span className="mr-1.5 inline-block size-2.5 rounded-[2px] bg-border align-middle" />Inquiries</span>
          <span><span className="mr-1.5 inline-block size-2.5 rounded-[2px] bg-accent align-middle" />Booked</span>
        </p>
      </section>
      <section className="grid gap-1">
        <h3 aria-level={2} className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Where they came from</h3>
        {s.sources.length ? s.sources.map((r) => (
          <p key={r.source} className="flex justify-between gap-3 border-b border-border py-2.5 text-[15px]">
            <span className="truncate">{r.source}</span>
            <span className="shrink-0 font-mono text-[13px] text-muted-foreground">{r.leads} in · <b className="font-medium text-accent">{r.booked} booked</b></span>
          </p>
        )) : <p className="text-[15px] text-muted-foreground">Nothing yet.</p>}
      </section>
      <section className="grid gap-1">
        <h3 aria-level={2} className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Why they were lost</h3>
        {s.lost.length ? s.lost.map((r) => (
          <p key={r.reason} className="flex justify-between border-b border-border py-2.5 text-[15px]"><span>{r.reason}</span><span className="font-mono text-[13px] text-muted-foreground">{r.n}</span></p>
        )) : <p className="text-[15px] text-muted-foreground">None lost.</p>}
      </section>
      <section className="grid gap-1">
        <h3 aria-level={2} className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">By stage · {s.total} leads</h3>
        {STAGES.map((st) => (
          <p key={st} className="flex justify-between border-b border-border py-2.5 text-[15px]"><span>{st}</span><span className="font-mono text-[13px] text-muted-foreground">{s.stages[st] ?? 0}</span></p>
        ))}
      </section>
    </div>
  );
}

/** His saved replies. {first}, {name}, {kind} and {when} are filled per lead. */
function TemplatesEditor({ call, templates, saved }: { call: Call; templates: Template[]; saved: (t: Template[]) => void }) {
  const [list, setList] = React.useState(templates);
  const [note, setNote] = React.useState<string | null>(null);
  const edit = (i: number, k: keyof Template) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setList(list.map((t, j) => (j === i ? { ...t, [k]: e.target.value } : t)));
  const save = () =>
    call({ method: "PATCH", body: JSON.stringify({ templates: list }) })
      .then((o) => { saved(o.templates as Template[]); setList(o.templates as Template[]); setNote("Saved."); })
      .catch((e: unknown) => setNote(e instanceof Error ? e.message : String(e)));
  return (
    <div className="grid gap-5 px-1 py-5 lg:px-5">
      <p className="text-[14px] text-muted-foreground">
        <code className="font-mono text-[13px] text-foreground">{"{first}"}</code>, <code className="font-mono text-[13px] text-foreground">{"{name}"}</code>,{" "}
        <code className="font-mono text-[13px] text-foreground">{"{kind}"}</code> and <code className="font-mono text-[13px] text-foreground">{"{when}"}</code> fill in for each lead.
      </p>
      {list.map((t, i) => (
        <fieldset key={t.id + i} className="grid gap-2.5 rounded-xl border border-border p-3.5">
          <label className={fieldLabel}>Name<input value={t.name} onChange={edit(i, "name")} className={field} /></label>
          <label className={fieldLabel}>Subject<input value={t.subject} onChange={edit(i, "subject")} className={field} /></label>
          <label className={fieldLabel}>Message<textarea value={t.body} onChange={edit(i, "body")} rows={6} className={cn(field, "py-3 leading-relaxed")} /></label>
          <button type="button" onClick={() => setList(list.filter((_, j) => j !== i))} className={cn(btn, "justify-self-start text-destructive")}>Remove</button>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={() => setList([...list, { id: `t${Date.now()}`, name: "New template", subject: "", body: "Hi {first},\n\n\n\nJulian" }])} className={btn}>Add a template</button>
        <button type="button" onClick={save} className={cn(btn, primary)}>Save templates</button>
      </div>
      {note ? <p role="status" className="font-mono text-[13px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** Every lead as a CSV file, through the same key as the rest of the desk. */
async function exportCsv() {
  const res = await fetch("/api/inbox?csv", { headers: credentials(window.localStorage.getItem(KEY_STORE) ?? ""), cache: "no-store" });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: `leads-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export { SW_URL, swScope, PushSwitch, ImportInbox, EmptyTrash, NewLeadForm, StatsView, TemplatesEditor, exportCsv };
