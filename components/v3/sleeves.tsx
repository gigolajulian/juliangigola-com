"use client";

import * as React from "react";
import Image from "next/image";
import { CoverArtGallery } from "@/components/cover-art-gallery";
import type { CoverRelease } from "@/lib/cover-art-types";

/* JG V3 Cover Art as sleeves (Julian, 2026-10-27, from the Sleeve Viewer
   mock): the record slides out of a sleeve on hover, a click opens the
   viewer on side A, and the viewer turns the sleeve over. A release with no
   printed back gets a typeset one. Behind `?sleeve=1` (`app/layout.tsx`)
   until Julian says yes; the old rack otherwise. */

const noop = () => () => {};
const flagged = () => document.documentElement.hasAttribute("data-sleeve");

export function CoverArt({ releases }: { releases: CoverRelease[] }) {
  const on = React.useSyncExternalStore(noop, flagged, () => false);
  return on ? <Sleeves releases={releases} /> : <CoverArtGallery releases={releases} />;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function Sleeves({ releases }: { releases: CoverRelease[] }) {
  const [at, setAt] = React.useState<number | null>(null);
  const [b, setB] = React.useState(false);
  const dlg = React.useRef<HTMLDialogElement>(null);
  const x0 = React.useRef<number | null>(null);
  const swiped = React.useRef(false);
  const go = (i: number) => {
    setAt((i + releases.length) % releases.length);
    setB(false);
  };
  React.useEffect(() => {
    const d = dlg.current;
    if (at !== null && d && !d.open) d.showModal();
  }, [at]);
  /* On the document, not the dialog: stepping remounts the sleeve, and the
     focus it had falls out of the dialog with it. */
  React.useEffect(() => {
    if (at === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(at + 1);
      else if (e.key === "ArrowLeft") go(at - 1);
      else if (e.key === "f" || e.key === "F") setB((v) => !v);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  const r = at === null ? null : releases[at];
  const front = r?.frames[0];
  const back = r?.frames[1];

  return (
    <>
      <ul className="slv">
        {releases.map((rel, i) => (
          <li key={rel.slug}>
            <button type="button" className="slv-s" onClick={() => go(i)} aria-label={`Open ${rel.title} by ${rel.artist}`}>
              <span className="slv-d" style={{ "--lb": rel.frames[0].color } as React.CSSProperties} />
              <Image src={rel.frames[0].src} alt="" fill sizes="(max-width: 700px) 50vw, 33vw" priority={i < 3} />
            </button>
            <p className="slv-c lbl">
              <span>{rel.title}</span>
              <span className="mute">{rel.artist}</span>
            </p>
          </li>
        ))}
      </ul>

      <dialog
        ref={dlg}
        className="slv-v"
        aria-label="Cover viewer"
        onClose={() => setAt(null)}
        // Anywhere but a control closes it (Julian): the stage around the sleeve, the bars.
        onClick={(e) => {
          if (!(e.target as Element).closest("button")) dlg.current?.close();
        }}
      >
        {r && front && at !== null ? (
          <>
            <div className="slv-bar lbl">
              <span className="mute">
                {pad(at + 1)} / {pad(releases.length)}
              </span>
              <button type="button" className="slv-btn lbl" onClick={() => dlg.current?.close()}>
                Close
              </button>
            </div>
            <div className="slv-stage">
              <button
                key={r.slug}
                type="button"
                className={b ? "slv-card b" : "slv-card"}
                aria-label={b ? "Turn to side A" : "Turn to side B"}
                onPointerDown={(e) => {
                  x0.current = e.clientX;
                  swiped.current = false;
                }}
                onPointerUp={(e) => {
                  const dx = x0.current === null ? 0 : e.clientX - x0.current;
                  x0.current = null;
                  if (Math.abs(dx) > 50) {
                    swiped.current = true;
                    go(at + (dx < 0 ? 1 : -1));
                  }
                }}
                onClick={() => {
                  if (!swiped.current) setB((v) => !v);
                }}
              >
                <span className="slv-f">
                  <Image src={front.src} alt={front.alt ?? `${r.title}, cover art for ${r.artist}`} fill sizes="(max-width: 700px) 100vw, 80vh" />
                </span>
                <span className="slv-f slv-b">
                  {back ? (
                    <Image src={back.src} alt={back.alt ?? `${r.title}, back cover`} fill sizes="(max-width: 700px) 100vw, 80vh" />
                  ) : (
                    <span className="slv-t">
                      <span className="slv-tt lbl mute">
                        <span>JG-{pad(at + 1, 3)}</span>
                        <span>Side B</span>
                      </span>
                      <b>
                        {r.artist}
                        <br />
                        {r.title}
                      </b>
                      <span className="slv-dl lbl">
                        <span className="mute">Release</span>
                        <span>{r.title}</span>
                        <span className="mute">Artist</span>
                        <span>{r.artist}</span>
                        <span className="mute">Cover photograph</span>
                        <span>@juliangigola</span>
                      </span>
                    </span>
                  )}
                </span>
              </button>
            </div>
            <div className="slv-bar lbl">
              <button type="button" className="slv-btn lbl" onClick={() => go(at - 1)}>
                ← Prev
              </button>
              <div className="slv-mid">
                <span>
                  {r.title} · {r.artist}
                </span>
                <div className="slv-ab" role="group" aria-label="Side">
                  <button type="button" aria-pressed={!b} onClick={() => setB(false)}>
                    A
                  </button>
                  <button type="button" aria-pressed={b} onClick={() => setB(true)}>
                    B
                  </button>
                </div>
              </div>
              <button type="button" className="slv-btn lbl" onClick={() => go(at + 1)}>
                Next →
              </button>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
