"use client";

/* ── /delivery/<id>: the client's finished photos ─────────────────
 * Julian (2026-11-12): the proof gallery becomes the delivery. Its gate is
 * a split, not the proof's grid wall: the cover photo on the left (top two
 * thirds on a phone), a header and the email on the right (below). Any
 * email opens it and every download is logged under it. Then the finals at
 * 800px in the grid and 2000px in the lightbox. Save gets one full-size
 * JPEG; Download all gets one zip. Same proof.css as the proof gallery.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import Link from "next/link";
import { isEmail, type PublicDelivery } from "@/lib/proofs/proof";

const size = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`);
const pad = (i: number) => String(i + 1).padStart(2, "0");

/** The delivery's door: the cover photo beside (or above) a header, a line and the email. */
function SplitGate({ cover, sub, onEnter }: { cover: string; sub: string; onEnter: (email: string) => void }) {
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

export function DeliveryGallery({ id, initial }: { id: string; initial: PublicDelivery }) {
  const { finals } = initial;
  const [email, setEmail] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<number | null>(null);
  const swipe = React.useRef<number | null>(null);
  const thumb = (fid: string) => `/delivery/${id}/f/${fid}?w=800`;
  const total = finals.reduce((n, f) => n + f.bytes, 0);
  const closes = initial.closesAt ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "America/Los_Angeles" }).format(new Date(initial.closesAt)) : null;

  const track = React.useCallback(
    (b: Record<string, unknown>) => fetch(`/api/proof/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "track", ...b }), keepalive: true }).catch(() => {}),
    [id],
  );
  /** Logged first, then the browser takes the file: a plain link, so phones save it their own way. */
  const download = (what: string, href: string) => {
    if (email) track({ email, kind: "download", id: what });
    location.href = href;
  };

  const step = (i: number, d: number) => (i + d + finals.length) % finals.length;
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

  if (!email) {
    return (
      <div className="proof">
        <SplitGate
          cover={`/delivery/${id}/f/${initial.cover ?? finals[0].id}`}
          sub={`Your photos at full resolution.${closes ? ` Save them by ${closes}.` : ""}`}
          onEnter={(address) => {
            setEmail(address);
            track({ email: address, kind: "open" });
          }}
        />
      </div>
    );
  }

  return (
    <div className="proof">
      <header className="proof-top">
        <Link className="proof-word" href="/">Julian Gigola</Link>
        <span />
        <p className="proof-meta"><b>{finals.length}</b> photos</p>
      </header>

      <>
          <div className="proof-intro">
            <p className="proof-lab">Finals · {finals.length} photos · {size(total)}</p>
            <h1>Your photos.</h1>
            <p className="proof-mu" style={{ marginTop: 18 }}>
              Full size JPEGs. Save the ones you want, or all of them at once.{closes ? ` The link closes ${closes}, so keep a copy.` : ""}
            </p>
            <button type="button" className="proof-btn" onClick={() => download("all", `/delivery/${id}/zip`)}>
              Download all · {size(total)}
            </button>
          </div>
          <div className="proof-grid">
            {finals.map((f, i) => (
              <div key={f.id} className="proof-cell">
                {/* eslint-disable-next-line @next/next/no-img-element -- private finals from the Worker, not the image CDN */}
                <img src={thumb(f.id)} alt="" loading={i < 8 ? "eager" : "lazy"} width={f.w || undefined} height={f.h || undefined} draggable={false} />
                <button type="button" className="proof-open" aria-label={`Open photo ${i + 1}`} onClick={() => setOpen(i)} />
                <span className="proof-no">{pad(i)}</span>
              </div>
            ))}
          </div>
      </>

      {open !== null ? (
        <div className="proof-lb" role="dialog" aria-modal="true" aria-label={`Photo ${open + 1}`}>
          <div className="proof-lt">
            <span>{pad(open)} / {finals.length}</span>
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
            <img src={`/delivery/${id}/f/${finals[open].id}`} alt={`Photo ${open + 1}`} />
            <button type="button" className="proof-arr r" aria-label="Next" onClick={() => setOpen(step(open, 1))}>&rarr;</button>
          </div>
          <div className="proof-lf">
            <span>{finals[open].file} · {size(finals[open].bytes)}</span>
            <button type="button" className="proof-btn" onClick={() => download(finals[open].id, `/delivery/${id}/dl/${finals[open].id}`)}>Save</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
