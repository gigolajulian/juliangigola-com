import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { projectHref } from "@/lib/project-href";

/** One project on /portfolio. The server page hands every one to the client WorkIndex, so the keys that repeat
    per project are one letter: they ride in the RSC payload once per project. */
export type WorkItem = {
  /** The project's slug. */
  s: string;
  /** The project's name. */
  n: string;
  /** Its disciplines, as their chip labels. */
  d: string[];
  /** Its credits as one line of @handles and names, for the search. */
  c: string;
  cover: string;
};

export const STRIP_SIZES = "(max-width: 767px) 82vw, 50vh";
export const GRID_SIZES = "(max-width: 700px) 50vw, (max-width: 1000px) 33vw, 25vw";

/** A gallery's cover says its own name in the caption: the image stays silent so it is not read twice. */
export const altOf = (p: WorkItem) => (p.d.join(", ").toLowerCase() === p.n.toLowerCase() ? "" : p.n);

/** A cover link's name: the words its caption shows, so voice control and axe label-in-name match. */
export const named = (p: WorkItem) => {
  const d = p.d.join(", ");
  return d.toLowerCase() !== p.n.toLowerCase() ? `${p.n} ${d}` : p.n;
};

/** A cover's caption, on the photo: the name, then its discipline. A gallery is named for its discipline, so the label would say it twice. */
export function Cap({ p, cls }: { p: WorkItem; cls: string }) {
  const d = p.d.join(", ");
  return (
    <span className={cls}>
      {/* --n: a long name sets smaller to stay near two lines; --w: its longest word still fits the cover's width. */}
      <b style={{ "--n": p.n.length, "--w": Math.max(...p.n.split(/\s+/).map((x) => x.length)) } as React.CSSProperties}>{p.n}</b>
      {/* The space keeps "THRESHOLD Editorial" two words for screen readers and label-in-name; between blocks it draws nothing. */}
      {d.toLowerCase() !== p.n.toLowerCase() ? <>{" "}<span className="lbl">{d}</span></> : null}
    </span>
  );
}

export function Tile({ p, swatch, first }: { p: WorkItem; swatch?: string[]; first?: boolean }) {
  return (
    <figure className="wt">
      <Link href={projectHref(p.s)} aria-label={named(p)}>
        <div className="ph" data-flip-id={p.s}>
          <Image
            src={p.cover}
            alt={altOf(p)}
            fill
            sizes={GRID_SIZES}
            decoding="sync"
            /* The first rows load at once: back from the strip, lazy covers
               waited a beat and landed as empty cards. */
            loading={first ? "eager" : "lazy"}
          />
          {swatch ? (
            <span className="sw">
              {swatch.map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
          ) : null}
          <Cap p={p} cls="wt-n" />
        </div>
      </Link>
    </figure>
  );
}
