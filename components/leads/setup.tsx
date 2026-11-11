"use client";

import * as React from "react";
import { STAGES, type Lead, type Stage } from "@/lib/leads/leads";
import { cn } from "@/lib/utils";
import { type Call, errorText } from "@/lib/leads/lead-desk";
import { btn, field, fieldLabel, primary } from "@/components/leads/shared";

/** The inbox key, pasted once per device. On the iPhone the installed app keeps
    its own storage apart from Safari, so it asks once there too. A password
    field, so a password manager can fill it. */
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
      const { key } = await call<{ key: string }>({ query: "?vapid" });
      const raw = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
      await call({ method: "PATCH", body: JSON.stringify({ push: sub.toJSON() }) });
      try { localStorage.setItem(PUSH_FLAG, "1"); } catch {}
      setOn(true);
    } catch (e) {
      setNote(errorText(e));
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
      setNote(errorText(e));
    }
  };
  const sendTest = async () => {
    setNote("Sending.");
    try {
      const { devices } = await call<{ devices: number }>({ method: "PATCH", body: JSON.stringify({ test: true }) });
      setNote(devices ? `Arrives in 10 seconds on ${devices} ${devices === 1 ? "device" : "devices"}. Lock the phone now: no banner shows while the app is open.` : "No device is subscribed. Turn notifications off and on again here.");
    } catch (e) {
      setNote(errorText(e));
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
    call<Count>({ method: "POST", body: JSON.stringify({ backfill: true, dry }) })
      .then((c) => {
        if (dry) return c.added + c.updated ? setCount(c) : setNote("Everything in the Inbox is already here.");
        setCount(null);
        setNote(`Imported: ${c.added} new, ${c.updated} updated.`);
        done();
      })
      .catch((e: unknown) => setNote(errorText(e)))
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
        call<{ id: string; lead: Lead }>({ method: "POST", body: JSON.stringify({ add: f }) })
          .then((o) => done(o.id, o.lead))
          .catch((err: unknown) => setNote(errorText(err)))
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

export { EmptyTrash, ImportInbox, NewLeadForm, PushSwitch, SW_URL, swScope };
