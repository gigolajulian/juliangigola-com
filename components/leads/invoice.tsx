"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { type Lead, type LeadSummary } from "@/lib/leads/leads";
import { cn } from "@/lib/utils";
import { mailable } from "@/lib/leads/lead-crm";
import { balance, dayB, DEPOSIT, isPaid, MAX_ROWS_B, NOTE_B, usd, usdB, type Crop, type Invoice, type InvoiceB, type InvoiceFrom } from "@/lib/leads/invoice";
import { framed, loadImage, place, shrink, toneFor } from "@/lib/leads/invoice-photo";
import { adminCall, day, errorText, inboxCall, plusDays, ymdPT } from "@/lib/leads/lead-desk";
import { btn, compose, field, fieldLabel, kindOf, primary } from "@/components/leads/shared";
import type { Patch } from "@/lib/leads/lead-desk";

/** The PDF of one invoice. Loaded on the tap, fonts and all. A design B one fetches its sealed photo unless `src` is in hand. */
export async function makePdf(inv: Invoice, l: LeadSummary, full: Lead, src?: string) {
  const { from } = await inboxCall<{ from: InvoiceFrom | null }>({ query: "?invoiceFrom" });
  if (!from?.name) throw new Error("Add your details for invoices first.");
  let photo;
  if (inv.b) {
    if (!src) {
      src = (await inboxCall<{ photo?: string }>({ query: `?invoicePhoto=${inv.b.photo}` })).photo;
      if (!src) throw new Error("This invoice's photo is gone.");
    }
    photo = await framed(src, inv.b.crop);
  }
  const { invoicePdf } = await import("@/lib/leads/invoice-pdf");
  return invoicePdf({ from, inv, to: { name: l.name, email: mailable(l.email) ? l.email : undefined, phone: full.phone } }, photo);
}

/** What he can do with the PDF. Nothing here sends. */
export function Deliver({ file, inv, l }: { file: File; inv: Invoice; l: LeadSummary }) {
  const url = React.useMemo(() => URL.createObjectURL(file), [file]);
  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  const first = l.name.split(" ")[0];
  const subject = `Invoice ${inv.no}${l.kind ? `, ${kindOf(l.kind)}` : ""}`;
  const body = `Hi ${first},\n\nAttached is invoice ${inv.no}. The balance is ${usd(balance(inv))}.\n\nThank you,\nJulian`;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2.5">
        {canShare ? (
          <button type="button" className={cn(btn, primary)} onClick={() => navigator.share({ files: [file], title: subject }).catch(() => {})}>Share PDF</button>
        ) : null}
        <a href={url} download={file.name} className={cn(btn, !canShare && primary)}>Download PDF</a>
        {mailable(l.email) ? <a href={compose(l.email, subject, body)} target="_blank" rel="noreferrer" className={btn}>Gmail draft</a> : null}
      </div>
      <p className="font-mono text-[12.5px] text-muted-foreground">Nothing is sent. The Gmail draft has no attachment: add the PDF before you send.</p>
    </div>
  );
}

export function InvoiceRow({ inv, l, full }: { inv: Invoice; l: LeadSummary; full: Lead }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <li className="grid gap-2 border-b border-border py-2.5">
      <p className="flex flex-wrap items-center justify-between gap-3 text-[15px]">
        <span><b className="font-mono font-medium">{inv.no}</b> <span className="text-muted-foreground">· {day(`${inv.date}T12:00:00`)} · {isPaid(inv) ? "paid" : `${usd(balance(inv))} due`}</span></span>
        {file ? null : (
          <button type="button" className={cn(btn, "min-h-10")} onClick={() => { setErr(null); makePdf(inv, l, full).then(setFile, (e: unknown) => setErr(errorText(e))); }}>PDF</button>
        )}
      </p>
      {file ? <Deliver file={file} inv={inv} l={l} /> : null}
      {err ? <p role="alert" className="text-[14px] text-destructive">{err}</p> : null}
    </li>
  );
}

/* ── design B: the dark invoice with a photo ────────────────────────
 * Julian (2026-11-09): "Add this invoice as my default template ... Ask
 * for everything that is on the page and have it fill it out. They need to
 * also be able to reframe the image so it fits nice." The only invoice since
 * 2026-11-10, when the light one was retired (Julian: "only" this one). Every field fills the page
 * beside it; the photo is dragged and zoomed inside its column, and the
 * wordmark on it turns light over a dark patch (Julian: "adjust the top
 * left logo based on the photo"). The PDF is drawn by `layoutB` in
 * lib/leads/invoice-pdf.ts from the same numbers. */

type LineB = { desc: string; sub: string; amt: string };

/** The page as the PDF draws it, scaled to its box. Its CSS is the approved prototype's. */
const PAGE_B_CSS = `
@font-face{font-family:"Archivo B";src:url(/leads-app/invoice/archivo-800-125.ttf) format("truetype");font-weight:800}
.ivb{aspect-ratio:210/297;width:100%;container-type:inline-size;position:relative;overflow:hidden;background:#0D0D0F;color:#EDEDEF;display:grid;grid-template-columns:41% 1fr;font-family:var(--font-display),sans-serif;line-height:1.4}
.ivb .l{font:500 1.55cqw/1.4 var(--font-mono),monospace;letter-spacing:.06em;text-transform:uppercase;color:#7C7F88}
.ivb .ph{position:relative;overflow:hidden;background:#222;cursor:grab;touch-action:none;user-select:none}
.ivb .ph:active{cursor:grabbing}
.ivb .ph img{position:absolute;max-width:none;pointer-events:none}
.ivb .ph::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(13,13,15,0) 55%,rgba(13,13,15,.85));pointer-events:none}
.ivb .ph:focus-visible{outline:2px solid #A99CF0;outline-offset:-2px}
.ivb .vno{position:absolute;top:5.5cqw;left:4.5cqw;z-index:1;font:900 3.6cqw/.9 var(--font-display);letter-spacing:-.045em}
.ivb .cap{position:absolute;left:4.5cqw;right:4cqw;bottom:5cqw;z-index:1;font:500 1.45cqw/1.6 var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:rgba(237,237,239,.75)}
.ivb .cap b{display:block;color:#EDEDEF;font-weight:500}
.ivb .col{padding:6cqw 6cqw 5cqw;display:flex;flex-direction:column;min-width:0}
.ivb .hd{display:flex;flex-direction:column;align-items:flex-end;gap:.5cqw}
.ivb .wm{font:900 3.6cqw/.9 var(--font-display);letter-spacing:-.045em}
.ivb .to{margin-top:calc(6cqw*var(--k,1));font-size:2.3cqw;line-height:1.45;font-weight:400}
.ivb .to .l{margin-bottom:1.2cqw}
.ivb .dim{color:#7C7F88}
.ivb .items{margin-top:calc(4cqw*var(--k,1));border-top:1px solid #2A2B30}
.ivb .it{display:flex;justify-content:space-between;gap:3cqw;padding:calc(2.2cqw*var(--k,1)) 0;border-bottom:1px solid #2A2B30;font-size:2.1cqw;font-weight:400}
.ivb .it>span:last-child{font:500 1.95cqw var(--font-mono);white-space:nowrap}
.ivb .it small{display:block;color:#7C7F88;font-size:1.75cqw;margin-top:.5cqw}
.ivb .amount{margin-top:calc(6cqw*var(--k,1))}
.ivb .amount .l{margin-bottom:2.4cqw;color:#A99CF0}
.ivb .k{font:800 10.5cqw/.82 "Archivo B",sans-serif;letter-spacing:-.035em;white-space:nowrap}
.ivb .sub{display:flex;gap:5cqw;margin-top:3.4cqw;font:500 1.6cqw var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:#7C7F88}
.ivb .sub b{color:#EDEDEF;font-weight:500}
.ivb .sub b.v{color:#A99CF0}
.ivb .pay{margin-top:calc(4.5cqw*var(--k,1));font:500 1.65cqw/1.75 var(--font-mono);color:#B9BBC2}
.ivb .pay .l{margin-bottom:1cqw}
.ivb .pay em{font-style:normal;color:#7C7F88}
.ivb .sign{margin-top:auto;margin-bottom:4.5cqw;display:flex;flex-direction:column;align-items:flex-end;gap:2.6cqw;text-align:right}
.ivb .sign p{font:500 2.05cqw/1.38 var(--font-display);letter-spacing:-.012em}
.ivb .sign i{display:block;font-style:normal;margin-top:1.6cqw;color:#7C7F88}
.ivb .sign .em{margin-top:-1.4cqw;font:500 1.4cqw var(--font-mono);letter-spacing:.04em;color:#7C7F88}
.ivb .wm2{white-space:nowrap;font:900 2.8cqw/1 var(--font-display);letter-spacing:-.045em}
.ivb .ft{display:flex;justify-content:space-between;padding-top:2.5cqw;border-top:1px solid #2A2B30;font:500 1.4cqw var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:#7C7F88}
`;

type PageBProps = {
  no: string; date: string; due: string; to: InvoiceB["to"]; project: string; caption: string; note: string[];
  rows: { t: string; sub: string; n: number }[]; total: number; from: InvoiceFrom | null;
  src: string | null; crop: Crop; setCrop: React.Dispatch<React.SetStateAction<Crop>>; tone: "dark" | "light";
};

function PageB(p: PageBProps) {
  const ph = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  const [nat, setNat] = React.useState({ w: 0, h: 0 });
  const drag = React.useRef<{ x: number; y: number; c: Crop } | null>(null);
  const { setCrop } = p;
  React.useEffect(() => {
    const el = ph.current!;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    // Wheel zooms the photo; React's wheel listener is passive and cannot keep the page still.
    const wheel = (e: WheelEvent) => { e.preventDefault(); setCrop((c) => ({ ...c, z: Math.min(3, Math.max(1, c.z - e.deltaY * 0.0015)) })); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener("wheel", wheel); };
  }, [setCrop]);
  // As the PDF does: draw the gaps in until the bank block clears the note by 4cqw.
  const page = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = page.current;
    if (!el) return;
    const pay = el.querySelector(".pay")!, sign = el.querySelector(".sign")!, clear = el.clientWidth * 0.04;
    for (let k = 1; k >= 0.3; k -= 0.05) {
      el.style.setProperty("--k", String(k));
      if (sign.getBoundingClientRect().top - pay.getBoundingClientRect().bottom >= clear) break;
    }
  });
  const at = nat.w && box.w ? place(nat.w, nat.h, box.w, box.h, p.crop) : null;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const move = (dx: number, dy: number, from: Crop) => at && p.setCrop({ ...from, x: at.w > box.w ? clamp(from.x - dx / (at.w - box.w)) : 0.5, y: at.h > box.h ? clamp(from.y - dy / (at.h - box.h)) : 0.5 });
  const f = p.from;
  return (
    <div ref={page} className="ivb" aria-label="The invoice page">
      <div
        ref={ph}
        className="ph"
        tabIndex={0}
        role="group"
        aria-label="Photo. Drag or use the arrow keys to move it."
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, c: p.crop }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current; if (d) move(e.clientX - d.x, e.clientY - d.y, d.c); }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 40 : 10, k = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
          if (k) { e.preventDefault(); move(k[0], k[1], p.crop); }
        }}
      >
        {p.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.src} alt="" onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} style={at ? { width: at.w, height: at.h, left: at.left, top: at.top } : { visibility: "hidden" }} />
        ) : null}
        <span className="vno" style={{ color: p.tone === "dark" ? "#2E2F34" : "#D9DADF" }}>Julian Gigola</span>
        <div className="cap"><b>{p.project}</b>{p.caption}</div>
      </div>
      <div className="col">
        <div className="hd"><span className="wm">INVOICE</span><span className="l">#{p.no || "…"}</span></div>
        <div className="to">
          <div className="l">Billed to</div>
          {p.to.name}{p.to.company ? <><br />{p.to.company}</> : null}{p.to.email ? <><br /><span className="dim">{p.to.email}</span></> : null}
        </div>
        <div className="items">
          {p.rows.map((r, i) => <div key={i} className="it"><span>{r.t}{r.sub ? <small>{r.sub}</small> : null}</span><span>{usdB(r.n)}</span></div>)}
        </div>
        <div className="amount">
          <div className="l">Total due</div>
          <div className="k">{usdB(p.total)}</div>
          <div className="sub"><span>Issued <b>{p.date ? dayB(p.date) : ""}</b></span><span>Due <b className="v">{p.due ? dayB(p.due, true) : ""}</b></span></div>
        </div>
        <div className="pay">
          <div className="l">Bank transfer</div>
          {f?.bank}<br />{f?.routing ? `Routing ${f.routing}` : null}<br />{f?.account ? `Account ${f.account}` : null}<br /><em>{f?.late}</em>
        </div>
        <div className="sign">
          <p>{p.note.filter(Boolean).map((n, i) => <React.Fragment key={i}>{i ? <br /> : null}{n}</React.Fragment>)}<i>Cheers,</i></p>
          <span className="wm2">Julian Gigola</span>
          <span className="em">hello@juliangigola.com</span>
        </div>
        <div className="ft"><span>juliangigola.com</span><span>{f?.tax ? `Tax ${f.tax}` : ""}</span></div>
      </div>
    </div>
  );
}

/** The desk itself on a wide screen (it is `lg:relative`), for the invoice page to cover its left side; null on a phone. */
function useDeskLeft() {
  const [el, setEl] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    const mq = matchMedia("(min-width: 1024px)");
    const set = () => setEl(mq.matches ? document.querySelector<HTMLElement>("[data-desk]") : null);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  // What the page covers leaves the tab order and the screen reader while it is up.
  React.useEffect(() => {
    if (!el) return;
    const hid = [...el.querySelectorAll<HTMLElement>(':scope > nav, :scope > section[aria-label="Leads"], :scope > [role="separator"]')];
    hid.forEach((n) => (n.inert = true));
    return () => hid.forEach((n) => (n.inert = false));
  }, [el]);
  return el;
}

export function InvoiceSheetB({ l, full, patch, done }: { l: LeadSummary; full: Lead; patch: Patch; done: () => void }) {
  const [from, setFrom] = React.useState<InvoiceFrom | null>(null);
  const [editFrom, setEditFrom] = React.useState(false);
  const [date, setDate] = React.useState(ymdPT);
  const [due, setDue] = React.useState(() => plusDays(ymdPT(), 7));
  const [no, setNo] = React.useState("");
  const shot = l.when ? l.when.slice(0, 10) : ymdPT();
  const [project, setProject] = React.useState(full.company ?? "");
  const [caption, setCaption] = React.useState(`Editorial · ${dayB(shot, true)}`);
  const [to, setTo] = React.useState<InvoiceB["to"]>({ name: l.name, company: full.company ?? "", email: mailable(l.email) ? l.email : "" });
  const [lines, setLines] = React.useState<LineB[]>([{ desc: kindOf(l.kind) ?? "Photography", sub: "", amt: full.quote !== undefined ? String(full.quote) : "" }]);
  const [paid, setPaid] = React.useState(full.deposit ? String(DEPOSIT) : "0");
  const [depositNote, setDepositNote] = React.useState("Paid at booking");
  const [note, setNote] = React.useState<string[]>([...NOTE_B]);
  const [src, setSrc] = React.useState<string | null>(null);
  const [photoKey, setPhotoKey] = React.useState<string | null>(null);
  const [crop, setCropRaw] = React.useState<Crop>({ x: 0.5, y: 0.5, z: 1 });
  const [tone, setTone] = React.useState<"dark" | "light">("dark");
  const [made, setMade] = React.useState<{ inv: Invoice; file: File } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const img = React.useRef<HTMLImageElement | null>(null);

  React.useEffect(() => {
    inboxCall<{ from: InvoiceFrom | null; no?: string }>({ query: `?invoiceNo=${date}` })
      .then((o) => {
        setNo(o.no ?? "");
        setFrom((f) => f ?? { ...EMPTY_FROM, ...o.from });
        if (!o.from?.name || !o.from.bank) setEditFrom(true);
      })
      .catch((e: unknown) => setErr(errorText(e)));
  }, [date]);

  // The last B invoice on this lead lends its photo and framing, so a second one starts where the first ended.
  React.useEffect(() => {
    const last = [...(full.invoices ?? [])].reverse().find((i) => i.b)?.b;
    if (!last) return;
    inboxCall<{ photo?: string }>({ query: `?invoicePhoto=${last.photo}` })
      .then((o) => { if (o.photo) { setSrc(o.photo); setPhotoKey(last.photo); setCropRaw(last.crop); setTone(last.tone); } })
      // Only a head start: without it the sheet opens empty, as a first invoice does.
      .catch(() => {});
  }, [full.invoices]);

  // The tone follows the framing, read from the pixels under the wordmark.
  React.useEffect(() => {
    if (!src) return;
    let live = true;
    (img.current?.src === src ? Promise.resolve(img.current) : loadImage(src)).then((i) => { img.current = i; if (live) setTone(toneFor(i, crop)); }, () => {});
    return () => { live = false; };
  }, [src, crop]);

  const pick = async (file?: File) => {
    if (!file) return;
    setErr(null);
    try { setSrc(await shrink(file)); setPhotoKey(null); setCropRaw({ x: 0.5, y: 0.5, z: 1 }); }
    catch (e) { setErr(errorText(e)); }
  };

  const dep = Number(paid) || 0;
  const rows = [...lines.map((x) => ({ t: x.desc, sub: x.sub, n: Number(x.amt) || 0 })), ...(dep ? [{ t: "Deposit received", sub: depositNote, n: -dep }] : [])];
  const total = rows.reduce((s, r) => s + r.n, 0);
  const setLine = (i: number, k: keyof LineB) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setLines(lines.map((x, j) => (j === i ? { ...x, [k]: k === "amt" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value } : x)));

  const saved = React.useRef<Lead | null>(null);
  const left = useDeskLeft();
  const save = async () => {
    if (!src) return setErr("Add a photo.");
    setBusy(true);
    setErr(null);
    try {
      let key = photoKey;
      if (!key) {
        const o = await adminCall<{ key?: string }>("/api/inbox", { method: "PATCH", body: JSON.stringify({ invoicePhoto: src }) }, "Could not save the photo.");
        if (!o.key) throw new Error("Could not save the photo.");
        setPhotoKey((key = o.key));
      }
      // Saved once: a retry after a failed PDF makes the PDF again, never a second invoice.
      saved.current ??= (await patch({
        invoice: {
          date,
          lines: lines.map((x) => ({ desc: x.desc.trim(), sub: x.sub.trim(), qty: 1, rate: Number(x.amt) })),
          paid: dep,
          b: { due, to, project, caption, note, depositNote, photo: key, crop, tone },
        },
      }));
      // The PATCH answers with the lead as stored, so no second read (that one asked for a key the full lead has no id for).
      const fresh = saved.current;
      const inv = fresh.invoices!.at(-1)!;
      setMade({ inv, file: await makePdf(inv, l, fresh, src) });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (made)
    return (
      <div className="grid gap-3 rounded-xl border border-border p-3.5">
        <p className="text-[15px]">Invoice <b className="font-mono font-medium">{made.inv.no}</b> made, {usd(balance(made.inv))} due.</p>
        <Deliver file={made.file} inv={made.inv} l={l} />
        <button type="button" onClick={done} className={cn(btn, "justify-self-start")}>Done</button>
      </div>
    );

  const legend = "mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground";
  const mono = "font-mono text-[14px]";
  return (
    <form className="grid gap-5 rounded-xl border border-border p-3.5 @container" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <style>{PAGE_B_CSS}</style>
      <div className={cn("grid gap-5", !left && "@[760px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] @[760px]:items-start")}>
        {(() => {
          const page = <PageB no={no} date={date} due={due} to={to} project={project} caption={caption} note={note} rows={rows} total={total} from={from} src={src} crop={crop} setCrop={setCropRaw} tone={tone} />;
          // Julian: on desktop the full-size page sits on the left, over the tabs and the list.
          return left
            ? createPortal(<div className="absolute inset-y-0 left-0 z-20 w-[calc(220px+var(--list-w,420px))] overflow-y-auto border-r border-border bg-background p-6">{page}</div>, left)
            : <div className="grid gap-5 @[760px]:order-2 @[760px]:sticky @[760px]:top-4">{page}</div>;
        })()}
        <div className="grid gap-5">
          {from && editFrom ? <FromForm from={from} saved={(f) => { setFrom(f); setEditFrom(false); }} /> : null}
          <fieldset className="grid gap-2.5">
            <legend className={legend}>Photo</legend>
            <div className="flex flex-wrap gap-2.5">
              <label className={cn(btn, "min-h-10 cursor-pointer")}>
                {src ? "Replace photo" : "Add a photo"}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
              </label>
              {src ? <button type="button" onClick={() => setCropRaw({ x: 0.5, y: 0.5, z: 1 })} className={cn(btn, "min-h-10")}>Reset framing</button> : null}
            </div>
            {src ? (
              <label className="flex items-center gap-3 font-mono text-[12.5px] text-muted-foreground">
                Zoom
                <input type="range" min={1} max={3} step={0.01} value={crop.z} onChange={(e) => setCropRaw({ ...crop, z: Number(e.target.value) })} className="flex-1 accent-foreground" />
                <span className="w-10 text-right">{Math.round(crop.z * 100)}%</span>
              </label>
            ) : null}
            <p className="font-mono text-[12.5px] text-muted-foreground">Drag the photo on the page to move it. The framing is saved with the invoice.</p>
          </fieldset>
          <fieldset className="grid gap-2.5">
            <legend className={legend}>Caption on the photo</legend>
            <label className={fieldLabel}>Project<input required maxLength={40} value={project} onChange={(e) => setProject(e.target.value)} className={field} /></label>
            <label className={fieldLabel}>Line under it<input maxLength={40} value={caption} onChange={(e) => setCaption(e.target.value)} className={field} /></label>
          </fieldset>
          <fieldset className="grid grid-cols-3 gap-2.5">
            <legend className={legend}>Invoice</legend>
            <div className={fieldLabel}>No.<span className="flex min-h-11 items-center font-mono text-[15px] text-foreground">{no || "…"}</span></div>
            <label className={fieldLabel}>Issued<input type="date" required value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(field, "px-2", mono)} /></label>
            <label className={fieldLabel}>Due<input type="date" required value={due} onChange={(e) => e.target.value && setDue(e.target.value)} className={cn(field, "px-2", mono)} /></label>
          </fieldset>
          <fieldset className="grid gap-2.5">
            <legend className={legend}>Billed to</legend>
            <label className={fieldLabel}>Name<input required maxLength={60} value={to.name} onChange={(e) => setTo({ ...to, name: e.target.value })} className={field} /></label>
            <label className={fieldLabel}>Company<input maxLength={60} value={to.company} onChange={(e) => setTo({ ...to, company: e.target.value })} className={field} /></label>
            <label className={fieldLabel}>Email<input type="email" maxLength={80} value={to.email} onChange={(e) => setTo({ ...to, email: e.target.value })} className={field} /></label>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className={legend}>Lines: title, what was done, amount</legend>
            {lines.map((x, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_44px] gap-2 border-b border-border pb-2.5">
                <input aria-label={`Line ${i + 1} title`} required maxLength={48} value={x.desc} onChange={setLine(i, "desc")} className={cn(field, "px-3")} />
                <input aria-label={`Line ${i + 1} amount`} required inputMode="decimal" value={x.amt} onChange={setLine(i, "amt")} placeholder="0" className={cn(field, "px-2 text-right", mono)} />
                {lines.length > 1 ? (
                  <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="grid size-11 place-items-center text-muted-foreground hoverable:hover:text-foreground">×</button>
                ) : <span aria-hidden="true" />}
                <input aria-label={`Line ${i + 1}, what was done`} maxLength={60} value={x.sub} onChange={setLine(i, "sub")} placeholder="What was done" className={cn(field, "px-3")} />
              </div>
            ))}
            {lines.length + (dep ? 1 : 0) < MAX_ROWS_B ? (
              <button type="button" onClick={() => setLines([...lines, { desc: "", sub: "", amt: "" }])} className={cn(btn, "min-h-10 justify-self-start")}>Add a line</button>
            ) : null}
          </fieldset>
          <fieldset className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5">
            <legend className={legend}>Deposit received</legend>
            <label className={fieldLabel}>Amount<input inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ""))} className={cn(field, "px-2 text-right", mono)} /></label>
            <label className={fieldLabel}>Line under it<input maxLength={60} value={depositNote} onChange={(e) => setDepositNote(e.target.value)} className={field} /></label>
            <p className="col-span-2 font-mono text-[12.5px] text-muted-foreground">0 leaves it off. Above 0 it shows as a line and comes off the total.</p>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className={legend}>Note</legend>
            {note.map((n, i) => <input key={i} aria-label={`Note, line ${i + 1}`} maxLength={44} value={n} onChange={(e) => setNote(note.map((m, j) => (j === i ? e.target.value : m)))} className={field} />)}
          </fieldset>
          <p className="flex justify-between font-mono text-[14px] text-muted-foreground">Total due<b className="text-[16px] font-medium text-accent">{usd(total)}</b></p>
          {err ? <p role="alert" className="text-[15px] text-destructive">{err}</p> : null}
          <div className="flex flex-wrap gap-2.5">
            <button type="submit" disabled={busy || !no} className={cn(btn, primary)}>{busy ? "Making" : "Save and make PDF"}</button>
            <button type="button" onClick={done} className={btn}>Cancel</button>
            {from && !editFrom ? <button type="button" onClick={() => setEditFrom(true)} className="min-h-11 px-2 font-mono text-[12.5px] text-muted-foreground hoverable:hover:text-foreground">Your details</button> : null}
          </div>
        </div>
      </div>
    </form>
  );
}

const EMPTY_FROM: InvoiceFrom = { name: "", a1: "", a2: "", a3: "", email: "hello@juliangigola.com", phone: "", ein: "", signoff: "Best,", notes: "", bank: "", routing: "", account: "", late: "Late payments add 5% per week.", tax: "" };
const FROM_FIELDS: [keyof InvoiceFrom, string][] = [["name", "Name on the invoice"], ["a1", "Address, line 1"], ["a2", "Address, line 2"], ["a3", "City, state, zip"], ["email", "Email"], ["phone", "Phone"], ["ein", "EIN line"], ["signoff", "Sign-off"], ["notes", "Notes on every invoice"], ["bank", "Bank name"], ["routing", "Routing number"], ["account", "Account number"], ["late", "Late fee line"], ["tax", "Tax number"]];

/** His details, once: sealed on the Worker, never in the code (the repo is public). */
function FromForm({ from, saved }: { from: InvoiceFrom; saved: (f: InvoiceFrom) => void }) {
  const [f, setF] = React.useState(from);
  const [err, setErr] = React.useState<string | null>(null);
  const save = () =>
    adminCall<{ from?: InvoiceFrom }>("/api/inbox", { method: "PATCH", body: JSON.stringify({ invoiceFrom: f }) }, "Could not save.")
      .then((o) => {
        if (!o.from) throw new Error("Could not save.");
        saved(o.from);
      })
      .catch((e: unknown) => setErr(errorText(e)));
  return (
    <fieldset className="grid gap-2.5 border-b border-border pb-3.5">
      <legend className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Your details for invoices</legend>
      {FROM_FIELDS.map(([k, t]) => (
        <label key={k} className={fieldLabel}>
          {t}
          {k === "notes"
            ? <textarea value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} rows={3} className={cn(field, "py-3 leading-relaxed")} />
            : <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={field} autoComplete="off" />}
        </label>
      ))}
      {err ? <p role="alert" className="text-[15px] text-destructive">{err}</p> : null}
      <button type="button" onClick={save} className={cn(btn, "justify-self-start")}>Save details</button>
    </fieldset>
  );
}
