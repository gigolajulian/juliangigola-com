"use client";

import * as React from "react";
import { adminCall, errorText, stampPT } from "@/lib/leads/lead-desk";
import { canonical } from "@/lib/leads/lead-crypto";
import { extras, stage, STAGES, type Proof, type Viewer, type ViewerEvent } from "@/lib/proofs";
import { cn } from "@/lib/utils";

/* ── proofs in /admin Leads ───────────────────────────────────────
 * Julian (2026-11-06): "will need an interface in Leads to send over to
 * clients". The mock's 04 Leads tab: a card that goes Draft, Preview,
 * Sent, Selects in. Lightroom makes the gallery; nothing goes to the
 * client until Send here. The Proofs tool lists every gallery; each lead
 * shows the ones made for its address.
 *
 * 2026-11-08 (mock https://claude.ai/artifact/4SWWESHZZ3ScWgYDPsnEnb, 4 and 5):
 * the tool is a manager, galleries on the left and the open one on the
 * right with Gallery, Activity and Selects. Activity is every address that
 * opened it: devices, city, time, frames seen, picks and unpicks, longest
 * look, and a timeline, plus a CSV of every event.
 * ─────────────────────────────────────────────────────────────── */

export type Row = Proof & { url: string };

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-border px-4 text-[15px] font-medium transition-colors duration-200 hoverable:hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40";
const primary = "border-accent bg-accent font-semibold text-accent-foreground hoverable:hover:bg-accent/90";
const mono = "font-mono text-[12.5px] text-muted-foreground";

export const api = <T = Record<string, unknown>,>({ query = "", ...init }: RequestInit & { query?: string } = {}) => adminCall<T>(`/api/proof${query}`, init);

/** Shared so the tool view and every lead card see the same list. */
function useProofs() {
  const [list, setList] = React.useState<Row[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(() => {
    api<{ proofs: Row[] }>({ query: "?list" }).then((o) => setList(o.proofs)).catch((e: unknown) => setError(errorText(e)));
  }, []);
  React.useEffect(load, [load]);
  return { list, error, load };
}

/** Seven short bars, the current stage in the accent. */
function Track({ p }: { p: Proof }) {
  const at = STAGES.indexOf(stage(p));
  return (
    <span className="inline-flex gap-[3px] align-middle" aria-hidden="true">
      {STAGES.map((s, i) => <span key={s} className={cn("h-1 w-3.5", i === at ? "bg-accent" : i < at ? "bg-muted-foreground" : "bg-border")} />)}
    </span>
  );
}

export const closed = (p: Proof) => !!p.closesAt && Date.parse(p.closesAt) < Date.now();
export const status = (p: Proof) => `${stage(p)}${p.checkout && !p.submittedAt ? ", paying" : ""}${closed(p) ? " · closed" : ""}`;

/** Every step with its time, for the card on a lead. */
function Timeline({ p }: { p: Proof }) {
  const x = extras(p.selects.length, p.included, p.price);
  const steps: [string, string, string | undefined][] = [
    ["Draft", `Published from Lightroom · ${p.frames.length} frames`, p.createdAt],
    ["Sent", p.email ? `Proof mail to ${p.email}` : "Not sent", p.sentAt],
    ["Opened", p.views ? `${p.views} ${p.views === 1 ? "view" : "views"}` : "Not opened", p.firstViewAt],
    ["Selecting", `${p.selects.length} selected`, p.firstSelectAt],
    ["Selects in", `${p.submittedBy ?? "They"} sent ${p.selects.length}${x.n ? ` · ${x.n} extra` : ""}`, p.submittedAt],
    ...(x.n || p.paid || p.balance ? [["Paid", p.paid ? `$${(p.paid.amount / 100).toFixed(2)} · Stripe${p.paid.pending ? " · bank, clearing" : ""}${p.paid.failed ? " · bank payment failed, follow up" : ""}` : "Not paid", p.paid?.at] as [string, string, string | undefined]] : []),
    ["In Lightroom", "Labels and Comments pulled on Publish", p.pulledAt],
  ];
  return (
    <ol className="grid border-t border-border font-mono text-[12.5px]">
      {steps.map(([k, v, at]) => (
        <li key={k} className="grid grid-cols-[110px_1fr_auto] gap-3 border-b border-border py-2 max-sm:grid-cols-[1fr_auto]">
          <b className={cn("font-medium", !at && "text-muted-foreground")}>{k}</b>
          <span className="text-muted-foreground max-sm:hidden">{v}</span>
          <i className="not-italic text-muted-foreground">{at ? stampPT(at) : "waiting"}</i>
        </li>
      ))}
    </ol>
  );
}

/** The Proofs tool: every gallery on the left, newest first; the open one on the right. */
export function ProofsDesk() {
  const { list, error, load } = useProofs();
  const [sel, setSel] = React.useState<string | null>(null);
  if (error) return <p className="px-1 py-10 text-[15px] text-muted-foreground lg:px-5">{error}</p>;
  if (!list) return <p className="px-1 py-10 text-[15px] text-muted-foreground lg:px-5">Loading.</p>;
  if (!list.length) return <p className="px-1 py-10 text-[15px] text-muted-foreground lg:px-5">No galleries yet. Publish a collection from Lightroom under Client proofs.</p>;
  const open = list.filter((p) => !closed(p));
  const waiting = open.filter((p) => p.sentAt && !p.submittedAt).length;
  const toPull = list.filter((p) => p.submittedAt && !p.pulledAt).length;
  const cur = list.find((p) => p.token === sel) ?? list[0];
  return (
    <div className="grid grid-cols-1 gap-4 px-1 py-4 lg:px-5">
      <p className={mono}>{open.length} open · {list.length - open.length} closed · {waiting} waiting on client · {toPull} selects to pull in Lightroom · new galleries arrive from Lightroom Publish</p>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_1fr]">
        <ul className="grid border-t border-border">
          {list.map((p) => (
            <li key={p.token}>
              <button type="button" onClick={() => setSel(p.token)} aria-current={p.token === cur.token || undefined} className={cn("grid w-full grid-cols-[44px_1fr] items-center gap-3 border-b border-border px-2 py-2.5 text-left transition-colors hoverable:hover:bg-card", p.token === cur.token && "bg-accent/10")}>
                {p.frames[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private proof frame
                  <img src={`/proof/${p.token}/f/${p.frames[0].id}`} alt="" className="aspect-[3/4] w-11 object-cover" />
                ) : <span className="aspect-[3/4] w-11 bg-border" />}
                <span className="grid gap-0.5">
                  <span className="text-[15px] font-medium">{p.name}</span>
                  <span className="font-mono text-[11.5px] text-muted-foreground">{p.frames.length} frames · {status(p)}{p.viewers ? ` · ${Object.keys(p.viewers).length} emails` : ""}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <ProofCard key={cur.token} p={cur} changed={load} />
      </div>
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
  const [tab, setTab] = React.useState<"gallery" | "activity" | "selects">("gallery");
  const [set, setSet] = React.useState({ balance: String(p.balance ?? 0), included: String(p.included), price: String(p.price), days: String(p.days) });
  const changedSet = set.balance !== String(p.balance ?? 0) || set.included !== String(p.included) || set.price !== String(p.price) || set.days !== String(p.days);
  const people = Object.keys(p.viewers ?? {}).length;
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
      setNote(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const showPreview = async () => {
    setBusy(true);
    try {
      setPreview((await api<{ html: string }>({ query: `?preview=${p.token}` })).html);
    } catch (e) {
      setNote(errorText(e));
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
    <article className="grid grid-cols-1 gap-3 rounded-[14px] border border-border p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[17px] font-medium">{p.name}</h3>
        <span className="flex items-center gap-2.5"><Track p={p} /><span className={cn("font-mono text-[11.5px] uppercase tracking-[0.08em]", p.submittedAt ? "text-accent" : "text-muted-foreground")}>{status(p)}</span></span>
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
        {p.sentAt ? ` · sent ${stampPT(p.sentAt)}` : ` · open ${p.days} days once sent`}
        {p.closesAt ? ` · closes ${stampPT(p.closesAt)}` : ""}
        {p.sentAt && !p.submittedAt ? ` · opened ${p.views} ${p.views === 1 ? "time" : "times"} · ${p.selects.length} selected so far` : ""}
      </p>

      <nav className="flex gap-5 border-b border-border font-mono text-[11.5px] uppercase tracking-[0.1em] text-muted-foreground" aria-label="Gallery views">
        {(["gallery", "activity", "selects"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn("-mb-px border-b py-2", tab === t ? "border-foreground text-foreground" : "border-transparent")}>
            {t === "gallery" ? "Gallery" : t === "activity" ? `Activity · ${people}` : `Selects · ${p.selects.length}`}
          </button>
        ))}
      </nav>

      {tab === "activity" ? <Activity p={p} /> : null}

      {tab === "gallery" ? <Timeline p={p} /> : null}

      {tab === "selects" && !p.selects.length ? <p className={mono}>No selects yet.</p> : null}
      {tab === "selects" && p.selects.length ? (
        <>
          <p className="text-[15px]">
            {p.selects.length} selected{x.n ? `, ${x.n} extra` : ""}{p.paid ? `, $${(p.paid.amount / 100).toFixed(2)} paid` : ""}{p.submittedAt ? `. Sent ${stampPT(p.submittedAt)}${p.submittedBy ? ` by ${p.submittedBy}` : ""}.` : ". Not sent yet: the latest address's picks."}
          </p>
          <ol className="grid gap-0.5 font-mono text-[12.5px] sm:grid-cols-2">
            {p.selects.map((id) => <li key={id}>{file(id)}{p.notes[id] ? <span className="text-muted-foreground"> · {p.notes[id]}</span> : null}</li>)}
          </ol>
          {p.message ? <p className="text-[15px] text-muted-foreground">&ldquo;{p.message}&rdquo;</p> : null}
        </>
      ) : null}

      {tab === "gallery" ? (
        <div className="grid gap-3 sm:grid-cols-5">
          <label className="grid gap-1 sm:col-span-5">
            <span className={mono}>Client email</span>
            <span className="flex gap-2">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" className="min-h-11 w-full rounded-[10px] border border-border bg-transparent px-3.5 text-base" />
              {email !== (p.email ?? "") ? <button type="button" className={btn} disabled={busy} onClick={() => act({ email }, "PATCH", "Saved.")}>Save</button> : null}
            </span>
          </label>
          {([["balance", "Shoot balance, $ (paid at Send)"], ["included", "Included frames"], ["price", "Each extra, $"], ["days", p.sentAt ? "Days open (set at send)" : "Days open once sent"]] as const).map(([k, label]) => (
            <label key={k} className="grid gap-1">
              <span className={mono}>{label}</span>
              <input inputMode="numeric" value={set[k]} disabled={k === "days" && !!p.sentAt} onChange={(e) => setSet((o) => ({ ...o, [k]: e.target.value }))} className="min-h-11 w-full rounded-[10px] border border-border bg-transparent px-3.5 text-base disabled:opacity-50" />
            </label>
          ))}
          <span className="flex items-end">
            {changedSet ? <button type="button" className={btn} disabled={busy} onClick={() => act({ balance: set.balance, included: set.included, price: set.price, days: set.days }, "PATCH", "Saved.")}>Save</button> : null}
          </span>
          <label className="flex min-h-11 items-center gap-2.5 sm:col-span-5">
            <input type="checkbox" checked={!!p.watermark} disabled={busy} onChange={(e) => act({ watermark: e.target.checked }, "PATCH", e.target.checked ? "Watermark on." : "Watermark off.")} className="size-4 accent-[var(--accent)]" />
            <span className={mono}>Watermark: Julian Gigola in the bottom third of every frame</span>
          </label>
          <CardPick p={p} busy={busy} act={act} />
        </div>
      ) : null}

      <p className="flex items-center gap-3 rounded-[10px] border border-border px-3.5 py-2.5 font-mono text-[12.5px]">
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.url.replace(/^https?:\/\//, "")}</span>
        <button type="button" className="text-accent" onClick={() => copy(p.url, "Link")}>Copy</button>
      </p>

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
        <a className={btn} href={`/proof/${p.token}`} target="_blank" rel="noreferrer">Open gallery</a>
      </div>
      {note ? <p className={mono} role="status">{note}</p> : null}
    </article>
  );
}

/** The card's photo panel, width over height (`CARD` in lib/proof-watermark: 1200 of 1800 wide, 945 tall). */
const PANEL = 1200 / 945;

/** The link preview: which frame, and how it sits in the card. Saved as `card` on the gallery (Julian 2026-11-10). */
function CardPick({ p, busy, act }: { p: Row; busy: boolean; act: (body: Record<string, unknown>, method?: string, done?: string) => void }) {
  const first = p.frames[0];
  const start = () => {
    const f = p.frames.find((x) => x.id === p.card?.id) ?? first;
    return p.card?.id === f?.id && p.card ? { ...p.card } : f ? { id: f.id, x: 0, y: Math.round(f.h * 0.08), w: f.w } : null;
  };
  const [d, setD] = React.useState(start);
  if (!d || !first) return null;
  const f = p.frames.find((x) => x.id === d.id) ?? first;
  const h = Math.round(d.w / PANEL);
  const fit = (c: typeof d) => {
    const w = Math.min(Math.max(c.w, Math.round(f.w * 0.3)), f.w, Math.round(f.h * PANEL));
    const ch = Math.round(w / PANEL);
    return { ...c, w, x: Math.min(Math.max(c.x, 0), f.w - w), y: Math.min(Math.max(c.y, 0), f.h - ch) };
  };
  const pick = (id: string) => {
    const g = p.frames.find((x) => x.id === id)!;
    setD({ id, x: 0, y: Math.round(g.h * 0.08), w: Math.min(g.w, Math.round(g.h * PANEL)) });
  };
  const saved = p.card && p.card.id === d.id && p.card.x === d.x && p.card.y === d.y && p.card.w === d.w;
  const slider = (label: string, value: number, min: number, max: number, on: (v: number) => void) => (
    <label className="grid gap-1">
      <span className={mono}>{label}</span>
      <input type="range" min={min} max={Math.max(min, max)} value={value} disabled={busy || max <= min} onChange={(e) => on(Number(e.target.value))} className="accent-[var(--accent)]" />
    </label>
  );
  return (
    <div className="grid gap-2 sm:col-span-5">
      <span className={mono}>Link preview: the frame and crop shown when the gallery link is shared{p.watermark ? "" : ". Needs the watermark on."}</span>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {p.frames.map((x, i) => (
          <button key={x.id} type="button" onClick={() => pick(x.id)} aria-pressed={x.id === d.id} aria-label={`Frame ${i + 1}`} className={cn("shrink-0", x.id === d.id && "outline outline-2 -outline-offset-2 outline-accent")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- private proof frame */}
            <img src={`/proof/${p.token}/f/${x.id}`} alt="" loading="lazy" className="aspect-[3/4] w-12 object-cover" />
          </button>
        ))}
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,360px)_1fr]">
        <div className="relative w-full overflow-hidden bg-border" style={{ aspectRatio: `${PANEL}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- private proof frame, placed to show the crop */}
          <img src={`/proof/${p.token}/f/${d.id}`} alt="" className="absolute max-w-none" style={{ width: `${(f.w / d.w) * 100}%`, left: `${(-d.x / d.w) * 100}%`, top: `${(-d.y / h) * 100}%` }} />
        </div>
        <div className="grid gap-2">
          {slider("Zoom", f.w - d.w, 0, f.w - Math.round(f.w * 0.3), (v) => setD((c) => c && fit({ ...c, w: f.w - v, x: c.x + Math.round((c.w - (f.w - v)) / 2), y: c.y + Math.round((c.w - (f.w - v)) / PANEL / 2) })))}
          {slider("Across", d.x, 0, f.w - d.w, (v) => setD((c) => c && fit({ ...c, x: v })))}
          {slider("Up and down", d.y, 0, f.h - h, (v) => setD((c) => c && fit({ ...c, y: v })))}
          <span className="flex flex-wrap gap-2">
            <button type="button" className={cn(btn, !saved && primary)} disabled={busy || !!saved} onClick={() => act({ card: d }, "PATCH", "Preview saved.")}>{saved ? "Saved" : "Save preview"}</button>
            {p.card ? <button type="button" className={btn} disabled={busy} onClick={() => act({ card: null }, "PATCH", "Preview back to the first frame.")}>Use first frame</button> : null}
          </span>
        </div>
      </div>
    </div>
  );
}

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const secs = (n: number) => (n < 90 ? `${Math.round(n)} s` : `${Math.round(n / 60)} min`);

/** Everyone who opened one gallery, and what they did. */
export function Activity({ p }: { p: Row }) {
  const people = Object.entries(p.viewers ?? {}).sort((a, b) => b[1].last.localeCompare(a[1].last));
  const [who, setWho] = React.useState(people[0]?.[0] ?? null);
  if (!people.length) return <p className={mono}>Nobody has opened it yet. Each address typed at the gate shows here.</p>;
  const file = (id?: string) => (id ? p.frames.find((f) => f.id === id)?.file ?? id : "");
  const num = (id?: string) => (id ? `#${p.frames.findIndex((f) => f.id === id) + 1}` : "");
  /** One viewer event, in words. */
  const SAID: Record<ViewerEvent["kind"], (id?: string) => string> = { open: () => "opened", pick: (id) => `picked ${num(id)}`, unpick: (id) => `unpicked ${num(id)}`, review: () => "reviewed", pay: () => "paid", send: () => "sent selects" };
  const tally = new Map<string, number>();
  for (const [, v] of people) for (const id of v.picks) tally.set(id, (tally.get(id) ?? 0) + 1);
  const top = [...tally].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const v = (people.find(([k]) => k === who) ?? people[0])[1];
  const email = (people.find(([k]) => k === who) ?? people[0])[0];
  const sent = p.submittedBy && p.submittedBy.toLowerCase() === email;
  const longest = Object.entries(v.looks).sort((a, b) => b[1] - a[1])[0];
  const unpicked = v.events.filter((e) => e.kind === "unpick").length;
  const label = (x: Viewer, k: string) => (p.submittedBy?.toLowerCase() === k ? `Sent · ${x.picks.length} picks` : x.picks.length ? `Browsing · ${x.picks.length} picks` : "Opened · 0 picks");

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

  const facts: [string, string][] = [
    ["First open", stampPT(v.first)],
    ["Last seen", stampPT(v.last)],
    ["Visits", String(v.visits)],
    ["Time in gallery", secs(v.seconds)],
    ["Devices", v.devices.join(", ") || "Unknown"],
    ["Location", v.places.join(" · ") || "Unknown"],
    ["Frames viewed", `${Object.keys(v.looks).length} of ${p.frames.length}`],
    ["Picks", String(v.picks.length)],
    ["Changed mind", `${unpicked} unpicked`],
    ["Longest look", longest ? `${num(longest[0])} · ${secs(longest[1] / 1000)}` : "None yet"],
    ["Paid", sent && p.paid ? `$${(p.paid.amount / 100).toFixed(0)} · Stripe` : "No"],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="grid content-start gap-3">
        <ul className="grid border-t border-border">
          {people.map(([k, x]) => (
            <li key={k}>
              <button type="button" onClick={() => setWho(k)} className={cn("grid w-full gap-0.5 border-b border-border px-2 py-2 text-left", k === email && "bg-accent/10")}>
                <span className="truncate text-[14px] font-medium">{x.name ? `${x.name} · ${k}` : k}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{label(x, k)}</span>
              </button>
            </li>
          ))}
        </ul>
        {top.length ? (
          <div className="grid gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">Most picked</span>
            <div className="flex flex-wrap gap-1">
              {top.map(([id, c]) => (
                <span key={id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private proof frame */}
                  <img src={`/proof/${p.token}/f/${id}`} alt={num(id)} className="aspect-[3/4] w-12 object-cover" />
                  <i className="absolute bottom-0.5 right-0.5 bg-foreground px-1 font-mono text-[10px] not-italic text-background">{c}</i>
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <button type="button" className={btn} onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="grid content-start gap-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {facts.map(([k, val]) => (
            <div key={k} className="grid gap-0.5">
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{k}</dt>
              <dd className="text-[14px] font-medium">{val}</dd>
            </div>
          ))}
        </dl>
        <ol className="grid max-h-[420px] overflow-auto border-t border-border pt-2 font-mono text-[12px] leading-[1.9] text-muted-foreground">
          {[...v.events].reverse().map((e, i) => (
            <li key={i}>
              {stampPT(e.at)} · <b className={cn("font-medium", e.kind === "pick" ? "text-accent" : "text-foreground")}>{SAID[e.kind](e.id)}</b>
              {e.kind === "open" ? ` · ${[e.device, e.place].filter(Boolean).join(" · ")}` : e.id ? ` · ${file(e.id)}` : ""}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
