"use client";

/* ── /delivery/<id>: the client's finished photos ─────────────────
 * The proof gallery becomes the delivery. Its gate
 * is the proof's wall: the top picks (five stars in Lightroom,
 * else every final) drifting under a card asking name and email; the split
 * gate stays behind `?proofwall=0`. Any email opens it and every download
 * is logged under it. Finals with a model (a delivery published from a
 * Lightroom collection set, one collection per model, named as the label)
 * get a By model view: a card per model with its own zip (`/zip?m=<label>`),
 * and an All photos view. Then the finals at
 * 800px in the grid and 2000px in the lightbox. Save gets one full-size
 * JPEG, Save for web the 2000px copy; Download all gets one zip. Same proof.css as the proof gallery.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import Link from "next/link";
import { useClock } from "@/components/proofs/use-clock";
import { closingSoon, isEmail, modelLabel, type PublicDelivery } from "@/lib/proofs/proof";
import { ProofCursor } from "@/components/proofs/cursor";
import { ProofWall } from "@/components/proofs/wall";

const size = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`);
const pad = (i: number) => String(i + 1).padStart(2, "0");

/** The delivery's door: the cover photo beside (or above) a header, a line and the email. */
function SplitGate({ cover, sub, subhead, onEnter }: { cover: string; sub: string; subhead?: string | null; onEnter: (email: string) => void }) {
  const [value, setValue] = React.useState("");
  const [bad, setBad] = React.useState(false);
  return (
    <div className="dlv-gate">
      <div className="dlv-photo">
        {/* eslint-disable-next-line @next/next/no-img-element -- private final, 2000px copy */}
        <img src={cover} alt="" />
      </div>
      {/* No `name` on the field: a tap before the script runs would put the address in the URL. */}
      <form
        className="dlv-side"
        onSubmit={(e) => {
          e.preventDefault();
          if (isEmail(value)) onEnter(value.trim());
          else setBad(true);
        }}
      >
        <Link className="proof-word" href="/">Julian Gigola</Link>
        <div>
          <h1>Your photos.</h1>
          {subhead ? <p className="proof-sub">{subhead}</p> : null}
          <p className="proof-mu">{sub}</p>
        </div>
        <label>
          <span className="proof-lab">Your email</span>
          <input type="email" inputMode="email" autoComplete="email" required value={value} onChange={(e) => { setValue(e.target.value); setBad(false); }} aria-invalid={bad || undefined} />
        </label>
        {bad ? <p className="proof-err" role="alert">That email does not look right.</p> : null}
        <button type="submit" className="proof-btn" data-off={!isEmail(value) || undefined}>Open photos</button>
      </form>
    </div>
  );
}

type Final = PublicDelivery["finals"][number];
const readWall = () => new URLSearchParams(location.search).get("proofwall") !== "0";
const noop = () => () => {};
const day = (s: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).format(new Date(s));

export function DeliveryGallery({ id, initial }: { id: string; initial: PublicDelivery }) {
  const { finals } = initial;
  const [email, setEmail] = React.useState<string | null>(null);
  const [opened, setOpened] = React.useState(false);
  const wall = React.useSyncExternalStore(noop, readWall, () => false);
  const grid = React.useRef<HTMLDivElement>(null);
  // Models in key order, photos inside each in shot order. Empty for a delivery with no models: it looks as before.
  const models = React.useMemo(() => {
    const by = new Map<string, Final[]>();
    for (const f of finals) if (f.model) by.set(f.model, [...(by.get(f.model) ?? []), f]);
    // Set order: Lightroom lists a set's collections by name, so "2" before "10".
    return [...by].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [finals]);
  const [view, setView] = React.useState<string>(models.length ? "models" : "all");
  const shown = view === "all" || view === "models" ? finals : finals.filter((f) => f.model === view);
  const one = models.find(([k]) => k === view);
  const [open, setOpen] = React.useState<number | null>(null);
  const swipe = React.useRef<number | null>(null);
  // `v` changes when Lightroom republishes an edit, so a cached old copy is never shown.
  const src = React.useCallback((f: { id: string; v: number }) => `/delivery/${id}/f/${f.id}?v=${f.v}`, [id]);
  const total = finals.reduce((n, f) => n + f.bytes, 0);
  const sizeOf = (fs: Final[]) => size(fs.reduce((n, f) => n + f.bytes, 0));
  const closes = initial.closesAt ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "America/Los_Angeles" }).format(new Date(initial.closesAt)) : null;
  // The last days say so on the page. Read after mount: server and phone can disagree near midnight.
  const clock = useClock();
  const soon = clock ? closingSoon(initial.closesAt, clock) : null;
  // The wall's photos: the top picks, else every final. One array, so the wall is not rebuilt under its own landing.
  const wallFrames = React.useMemo(() => {
    const top = finals.filter((f) => f.top);
    return (top.length ? top : finals).map((f) => ({ src: `${src(f)}&w=800`, w: f.w, h: f.h }));
  }, [finals, src]);
  const walling = wall && !opened;

  // What this address already took, kept in this browser: the button reads "Downloaded · Nov 19" after.
  const [done, setDone] = React.useState<Record<string, string>>({});
  const keyOf = (address: string) => `dlv-done:${id}:${address.toLowerCase()}`;
  const doneKey = email ? keyOf(email) : null;

  const track = React.useCallback(
    (b: Record<string, unknown>) => fetch(`/api/proof/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "track", ...b }), keepalive: true }).catch(() => {}),
    [id],
  );
  /** Logged first, then the browser takes the file: a plain link, so phones save it their own way. */
  const download = (what: string, href: string) => {
    if (email) track({ email, kind: "download", id: what });
    if (doneKey && (what === "all" || models.some(([k]) => k === what))) {
      const next = { ...done, [what]: new Date().toISOString() };
      setDone(next);
      try {
        localStorage.setItem(doneKey, JSON.stringify(next));
      } catch {}
    }
    window.location.assign(href);
  };
  const zipLabel = (what: string, label: string) => (done[what] ? `Downloaded · ${day(done[what])}` : label);
  const enter = (address: string, name?: string) => {
    setEmail(address);
    try {
      setDone(JSON.parse(localStorage.getItem(keyOf(address)) ?? "{}"));
    } catch {}
    track({ email: address, kind: "open", ...(name ? { name } : {}) });
  };

  const step = (i: number, d: number) => (i + d + shown.length) % shown.length;
  React.useEffect(() => {
    if (open === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : step(o, 1)));
      if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : step(o, -1)));
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });
  const go = (v: string) => {
    setView(v);
    setOpen(null);
    scrollTo({ top: 0 });
  };

  // `?proofwall=0`: the split gate, as before.
  if (!email && !wall) {
    return (
      <div className="proof">
        <SplitGate
          cover={src(finals.find((f) => f.id === initial.cover) ?? finals[0])}
          subhead={initial.subhead}
          sub={`Your photos at full resolution.${closes ? ` Save them by ${closes}.` : ""}`}
          onEnter={(address) => enter(address)}
        />
      </div>
    );
  }

  const zipHref = (k: string) => `/delivery/${id}/zip?m=${encodeURIComponent(k)}`;

  return (
    <div className="proof" data-wall={wall ? (walling ? (email ? "settle" : "gate") : "on") : undefined}>
      <div inert={walling || open !== null || undefined}>
        <ProofCursor />
        <header className="proof-top dlv-top">
          <Link className="proof-word" href="/">Julian Gigola</Link>
          <span />
          {/* The tabs top right (Julian's mock comments); the count lives in the intro line only. */}
          {models.length ? (
            <nav className="proof-tabs" aria-label="Photos">
              <button type="button" data-on={view !== "all" || undefined} onClick={() => go("models")}>BY MODEL</button>
              <button type="button" data-on={view === "all" || undefined} onClick={() => go("all")}>ALL PHOTOS</button>
            </nav>
          ) : <p className="proof-meta"><b>{finals.length}</b> photos</p>}
        </header>

        {one ? (
          <div className="proof-intro dlv-intro dlv-mh">
            <button type="button" className="dlv-back" onClick={() => go("models")}>&larr; All models</button>
            <p className="proof-lab">Model · {one[1].length} photos · {sizeOf(one[1])}</p>
            {/* A numbered model reads SUBJECT02 in the tiles' heavy face; a named model keeps its name. */}
            <h1>{/^\d+$/.test(modelLabel(one[0])) ? `SUBJECT${modelLabel(one[0])}` : modelLabel(one[0])}</h1>
            <button type="button" className="proof-btn" data-done={done[one[0]] ? "" : undefined} onClick={() => download(one[0], zipHref(one[0]))}>
              {zipLabel(one[0], `Download zip · ${sizeOf(one[1])}`)}
            </button>
          </div>
        ) : (
          <div className="proof-intro dlv-intro">
            <p className="proof-lab">Finals · {models.length ? `${models.length} models · ` : ""}{finals.length} photos · {size(total)}{soon !== null && closes ? ` · ${soon} ${soon === 1 ? "day" : "days"} left` : ""}</p>
            <h1>Your photos.</h1>
            {initial.subhead ? <p className="proof-sub">{initial.subhead}</p> : null}
            <p className="proof-mu" style={{ marginTop: 18 }}>
              {models.length ? "Full size JPEGs, grouped by model. Open a model to see its photos, take one model as a zip, or take everything at once." : "Full size JPEGs. Save the ones you want, or all of them at once."}
            </p>
            <div className="dlv-dl">
              <button type="button" className="proof-btn" data-done={done.all ? "" : undefined} onClick={() => download("all", `/delivery/${id}/zip`)}>
                {zipLabel("all", `Download all · ${size(total)}`)}
              </button>
              {closes ? <p className="proof-mu"><b>Closes {closes}</b>. Keep a copy.</p> : null}
            </div>
          </div>
        )}

        {view === "models" ? (
          <div className="proof-grid dlv-models" ref={grid}>
            {models.map(([k, fs], i) => {
              // One top pick (five stars, else the first) with the next three under it, styling and angles.
              const top = fs.find((f) => f.top) ?? fs[0];
              const under = fs.filter((f) => f !== top).slice(0, 3);
              return (
              <div key={k} className="dlv-card">
                <div className="dlv-cover">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private final, 800px copy */}
                  <img src={`${src(top)}&w=800`} alt="" loading={i < 6 ? "eager" : "lazy"} draggable={false} />
                  <span className="dlv-num" aria-hidden="true">{modelLabel(k)}</span>
                  <button type="button" className="proof-open" aria-label={`Open model ${modelLabel(k)}`} onClick={() => go(k)} />
                </div>
                {under.length ? (
                  <button type="button" className="dlv-minis" tabIndex={-1} aria-hidden="true" onClick={() => go(k)}>
                    {under.map((f) => (
                      <span key={f.id} className="dlv-mini">
                        {/* eslint-disable-next-line @next/next/no-img-element -- private final, 800px copy */}
                        <img src={`${src(f)}&w=800`} alt="" loading={i < 6 ? "eager" : "lazy"} draggable={false} />
                        <i className="dlv-mn">{pad(fs.indexOf(f))}</i>
                      </span>
                    ))}
                  </button>
                ) : null}
                <div className="dlv-cap">
                  <span>{fs.length} photos</span>
                  <button type="button" className="dlv-zip" data-done={done[k] ? "" : undefined} onClick={() => download(k, zipHref(k))}>
                    {done[k] ? zipLabel(k, "") : <>Download zip<span className="dlv-sz"> · {sizeOf(fs)}</span></>}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="proof-grid dlv-grid" ref={grid}>
            {shown.map((f, i) => (
              <div key={f.id} className="proof-cell">
                {/* eslint-disable-next-line @next/next/no-img-element -- private finals from the Worker, not the image CDN */}
                <img src={`${src(f)}&w=800`} alt="" loading={i < 8 ? "eager" : "lazy"} width={f.w || undefined} height={f.h || undefined} draggable={false} />
                <button type="button" className="proof-open" aria-label={`Open photo ${i + 1}`} onClick={() => setOpen(i)} />
                <span className="proof-no">{pad(i)}{initial.labels ? ` · ${f.file}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {walling ? (
        <ProofWall
          frames={wallFrames}
          sub={initial.subhead}
          grid={grid}
          isEmail={isEmail}
          words={{ lab: `Finals · ${models.length ? `${models.length} models · ` : ""}${finals.length} photos`, title: "Your photos.", cta: "Open photos", note: closes ? `The link closes ${closes}.` : "Your photos at full resolution." }}
          onAccept={(name, address) => enter(address, name)}
          onDone={() => setOpened(true)}
        />
      ) : null}

      {open !== null && shown[open] ? (
        <div className="proof-lb" role="dialog" aria-modal="true" aria-label={`Photo ${open + 1}`}>
          <div className="proof-lt">
            <span>{one ? `${modelLabel(one[0])} · ` : ""}{pad(open)} / {shown.length}</span>
            <button type="button" className="proof-close" onClick={() => setOpen(null)}>Close</button>
          </div>
          <div
            className="proof-li"
            onTouchStart={(e) => (swipe.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - (swipe.current ?? e.changedTouches[0].clientX);
              if (Math.abs(dx) > 50) setOpen(step(open, dx < 0 ? 1 : -1));
              swipe.current = null;
            }}
          >
            <button type="button" className="proof-arr l" aria-label="Previous" onClick={() => setOpen(step(open, -1))}>&larr;</button>
            {/* eslint-disable-next-line @next/next/no-img-element -- private final, 2000px copy */}
            <img src={src(shown[open])} alt={`Photo ${open + 1}`} />
            <button type="button" className="proof-arr r" aria-label="Next" onClick={() => setOpen(step(open, 1))}>&rarr;</button>
          </div>
          <div className="proof-lf">
            <span>{shown[open].file} · {size(shown[open].bytes)}</span>
            <div className="proof-acts">
              {/* The 2000px copy, for posting and texting. */}
              <button type="button" className="proof-btn ghost" onClick={() => download(shown[open].id, `/delivery/${id}/web/${shown[open].id}`)}>Save for web</button>
              <button type="button" className="proof-btn" onClick={() => download(shown[open].id, `/delivery/${id}/dl/${shown[open].id}`)}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
