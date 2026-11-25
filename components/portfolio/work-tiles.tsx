import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { projectHref } from "@/lib/work/project-href";

/** One project on /portfolio as the server page hands it to the client WorkIndex. The keys that repeat per
    project are one letter: they ride in the RSC payload once per project. WorkIndex maps them to `WorkItem`. */
export type WorkPayload = {
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

/** One project on /portfolio, as the components read it. */
export type WorkItem = {
  slug: string;
  name: string;
  /** Its disciplines, as their chip labels. */
  disciplines: string[];
  /** Its credits as one line of @handles and names, for the search. */
  credits: string;
  cover: string;
};

/** The payload's keys as names, once, at the WorkIndex boundary. */
export const workItem = (p: WorkPayload): WorkItem => ({ slug: p.s, name: p.n, disciplines: p.d, credits: p.c, cover: p.cover });

export const STRIP_SIZES = "(max-width: 767px) 82vw, 50vh";
export const GRID_SIZES = "(max-width: 700px) 50vw, (max-width: 1000px) 33vw, 25vw";

/** A gallery's cover says its own name in the caption: the image stays silent so it is not read twice. */
export const altOf = (p: WorkItem) => (p.disciplines.join(", ").toLowerCase() === p.name.toLowerCase() ? "" : p.name);

/** A cover link's name: the words its caption shows, so voice control and axe label-in-name match. */
export const named = (p: WorkItem) => {
  const d = p.disciplines.join(", ");
  return d.toLowerCase() !== p.name.toLowerCase() ? `${p.name} ${d}` : p.name;
};

/** A cover's caption, on the photo: the name, then its discipline. A gallery is named for its discipline, so the label would say it twice. */
export function Cap({ p, cls }: { p: WorkItem; cls: string }) {
  const d = p.disciplines.join(", ");
  return (
    <span className={cls}>
      {/* --n: a long name sets smaller to stay near two lines; --w: its longest word still fits the cover's width. */}
      <b style={{ "--n": p.name.length, "--w": Math.max(...p.name.split(/\s+/).map((x) => x.length)) } as React.CSSProperties}>{p.name}</b>
      {/* The space keeps "THRESHOLD Editorial" two words for screen readers and label-in-name; between blocks it draws nothing. */}
      {d.toLowerCase() !== p.name.toLowerCase() ? (
        <>
          {" "}
          <span className="lbl">{d}</span>
        </>
      ) : null}
    </span>
  );
}

export function Tile({ p, swatch, first }: { p: WorkItem; swatch?: string[]; first?: boolean }) {
  return (
    <figure className="wt">
      <Link href={projectHref(p.slug)} aria-label={named(p)}>
        <div className="ph" data-flip-id={p.slug}>
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
