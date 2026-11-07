"use client";

import * as React from "react";
import { credentials, KEY_STORE } from "@/components/admin-inbox";
import { canonical } from "@/lib/lead-crypto";
import { extras, type Proof } from "@/lib/proofs";
import { cn } from "@/lib/utils";

/* ── proofs in /admin Leads ───────────────────────────────────────
 * Julian (2026-11-06): "will need an interface in Leads to send over to
 * clients". The mock's 04 Leads tab: a card that goes Draft, Preview,
 * Sent, Selects in. Lightroom makes the gallery; nothing goes to the
 * client until Send here. The Proofs tool lists every gallery; each lead
 * shows the ones made for its address.
 * ─────────────────────────────────────────────────────────────── */

type Row = Proof & { url: string };

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-border px-4 text-[15px] font-medium transition-colors duration-200 hoverable:hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40";
const primary = "border-accent bg-accent font-semibold text-accent-foreground hoverable:hover:bg-accent/90";
const mono = "font-mono text-[12.5px] text-muted-foreground";
const when = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

async function api(init: RequestInit & { query?: string } = {}) {
  const res = await fetch(`/api/proof${init.query ?? ""}`, { ...init, headers: { ...credentials(window.localStorage.getItem(KEY_STORE) ?? ""), "content-type": "application/json" }, cache: "no-store" });
  const out = (await res.json()) as Record<string, unknown> & { error?: string };
  if (!res.ok) throw new Error(out.error ?? `Request failed (${res.status})`);
  return out;
}

/** Shared so the tool view and every lead card see the same list. */
function useProofs() {
  const [list, setList] = React.useState<Row[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(() => {
    api({ query: "?list" }).then((o) => setList(o.proofs as Row[])).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  React.useEffect(load, [load]);
  return { list, error, load };
}

const status = (p: Proof) => (p.submittedAt ? "Selects in" : p.checkout ? "Paying" : p.sentAt ? "Waiting on client" : "Draft");

/** The Proofs tool: every gallery, newest first. */
export function ProofsDesk() {
  const { list, error, load } = useProofs();
  if (error) return <p className="px-1 py-10 text-[15px] text-muted-foreground lg:px-5">{error}</p>;
  if (!list) return <p className="px-1 py-10 text-[15px] text-muted-foreground lg:px-5">Loading.</p>;
  if (!list.length) return <p className="px-1 py-10 text-[15px] text-muted-foreground lg:px-5">No galleries yet. Publish a collection from Lightroom under Client proofs.</p>;
  return (
    <div className="grid gap-4 px-1 py-4 lg:px-5">
      {list.map((p) => <ProofCard key={p.token} p={p} changed={load} />)}
    </div>
  );
}

/** The galleries made for one lead's address, on the lead. */
export function LeadProofs({ email }: { email: string }) {
  const { list, load } = useProofs();
  const mine = (list ?? []).filter((p) => p.email && canonical(p.email) === canonical(email));
  if (!mine.length) return null;
  return (
    <section aria-label="Proofs" className="grid gap-3">
      {mine.map((p) => <ProofCard key={p.token} p={p} changed={load} />)}
    </section>
  );
}

function ProofCard({ p, changed }: { p: Row; changed: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState(p.email ?? "");
  const x = extras(p.selects.length, p.included, p.price);
  const thumbs = (p.submittedAt ? p.selects : p.frames.map((f) => f.id)).slice(0, 6);
  const file = (id: string) => p.frames.find((f) => f.id === id)?.file ?? id;

  const act = async (body: Record<string, unknown>, method = "POST", done?: string) => {
    setBusy(true);
    setNote(null);
    try {
      await api({ method, body: JSON.stringify({ token: p.token, ...body }) });
      if (done) setNote(done);
      setPreview(null);
      changed();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const showPreview = async () => {
    setBusy(true);
    try {
      setPreview(String((await api({ query: `?preview=${p.token}` })).html));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote(`${what} copied.`);
    } catch {
      setNote(text);
    }
  };

  return (
    <article className="grid gap-3 rounded-[14px] border border-border p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[17px] font-medium">{p.name}</h3>
        <span className={cn("font-mono text-[11.5px] uppercase tracking-[0.08em]", p.submittedAt ? "text-accent" : "text-muted-foreground")}>{status(p)}</span>
      </header>
      {thumbs.length ? (
        <div className="grid grid-cols-6 gap-1">
          {thumbs.map((id) => (
            // eslint-disable-next-line @next/next/no-img-element -- private proof frames from the Worker
            <img key={id} src={`/proof/${p.token}/f/${id}`} alt="" className={cn("aspect-[3/4] w-full object-cover", p.submittedAt && "outline outline-2 -outline-offset-2 outline-accent")} />
          ))}
        </div>
      ) : null}
      <p className={mono}>
        {p.frames.length} frames · {p.included} included · ${p.price} each extra
        {p.sentAt ? ` · sent ${when(p.sentAt)}` : ` · open ${p.days} days once sent`}
        {p.closesAt ? ` · closes ${when(p.closesAt)}` : ""}
        {p.sentAt && !p.submittedAt ? ` · opened ${p.views} ${p.views === 1 ? "time" : "times"} · ${p.selects.length} selected so far` : ""}
      </p>

      {p.submittedAt ? (
        <>
          <p className="text-[15px]">
            {p.selects.length} selected{x.n ? `, ${x.n} extra` : ""}{p.paid ? `, $${(p.paid.amount / 100).toFixed(2)} paid` : ""}. Sent {when(p.submittedAt)}.
          </p>
          <ol className="grid gap-0.5 font-mono text-[12.5px] sm:grid-cols-2">
            {p.selects.map((id) => <li key={id}>{file(id)}{p.notes[id] ? <span className="text-muted-foreground"> · {p.notes[id]}</span> : null}</li>)}
          </ol>
          {p.message ? <p className="text-[15px] text-muted-foreground">&ldquo;{p.message}&rdquo;</p> : null}
        </>
      ) : null}

      {!p.sentAt ? (
        <label className="grid gap-1">
          <span className={mono}>Client email</span>
          <span className="flex gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" className="min-h-11 w-full rounded-[10px] border border-border bg-transparent px-3.5 text-base" />
            {email !== (p.email ?? "") ? <button type="button" className={btn} disabled={busy} onClick={() => act({ email }, "PATCH", "Saved.")}>Save</button> : null}
          </span>
        </label>
      ) : null}

      {preview ? (
        <div className="grid gap-2">
          <p className={mono}>To {p.email} · Your proofs are ready</p>
          <iframe title="Email preview" srcDoc={preview} sandbox="" className="h-[560px] w-full rounded-[10px] border border-border bg-white" />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!p.sentAt && !preview ? <button type="button" className={cn(btn, primary)} disabled={busy || !p.email || !p.frames.length} onClick={showPreview}>Preview email</button> : null}
        {!p.sentAt && preview ? <button type="button" className={cn(btn, primary)} disabled={busy} onClick={() => act({ action: "send" }, "POST", "Sent.")}>Send to {p.email}</button> : null}
        {p.sentAt && !p.submittedAt ? <button type="button" className={btn} disabled={busy} onClick={() => act({ action: "extend", days: 7 }, "POST", "Seven more days.")}>Extend 7 days</button> : null}
        {p.submittedAt ? <button type="button" className={btn} onClick={() => copy(p.selects.map(file).join("\n"), "File names")}>Copy file names</button> : null}
        {p.submittedAt ? <button type="button" className={btn} disabled={busy} onClick={() => act({ action: "reopen" }, "POST", "Reopened. They can change their selects.")}>Reopen for changes</button> : null}
        <button type="button" className={btn} onClick={() => copy(p.url, "Link")}>Copy link</button>
        <a className={btn} href={`/proof/${p.token}`} target="_blank" rel="noreferrer">Open gallery</a>
      </div>
      {note ? <p className={mono} role="status">{note}</p> : null}
    </article>
  );
}
