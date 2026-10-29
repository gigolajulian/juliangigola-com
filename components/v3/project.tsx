import Image from "next/image";
import Link from "next/link";
import { Mark } from "@/components/v3/duo";
import { BackLink } from "@/components/back-link";
import { billing, markFor, titleCase } from "@/lib/work";
import { tailHole } from "@/lib/sheet";
import type { Frame, Project } from "@/lib/work-types";

/* JG V3 project page (leftovers sheet, card B; Julian: vertical, with the
   client's logo where there is one). The head: back link, the set's name in
   title case, the logo on the right; then the opening frame wide, the rest
   in three uneven columns, the credits as rows, and the next project. */

const wide = (f: Frame) => f.width > f.height;

/* A client or brand is credited by its name, never "@wired" (Julian,
   2026-10-27); people keep their @handle. Still links to the Instagram. */
const ORG = /^(client|brand)$/i;
type Credit = Project["credits"][number];
/* The handle: the Instagram field, else one typed into the name
   ("@anisajadee", "Ryan Ohaya (@carti.kun)"), else Julian's own. */
const handleOf = (c: Credit) =>
  c.instagram ?? c.name.match(/@([\w.]+)/)?.[1] ?? (/^julian gigola$/i.test(c.name.trim()) ? "juliangigola" : null);
/* The name leads (Julian, 2026-10-27); the @handle takes its place on hover.
   A name typed as only a handle has no name to lead with. */
const nameOf = (c: Credit) => {
  const n = c.name.replace(/\s*\(@[\w.]+\)/, "").trim();
  return n.startsWith("@") ? null : n;
};
const creditLabel = (c: Credit, h: string | null) =>
  ORG.test(c.role.trim()) ? c.name.replace(/^@/, "") : (nameOf(c) ?? (h ? `@${h}` : c.name));

export function V3Project({ project, next }: { project: Project; next?: { href: string; name: string; cover?: Frame } }) {
  const mark = markFor(project.slug);
  const client = billing(project);
  const sub = [client, project.categories[0] && titleCase(project.categories[0].name), `${project.images.length} frames`].filter(Boolean).join(" · ");
  const name = titleCase(project.headline ?? project.name);
  const alt = (a: string) => a || `${name} by Julian Gigola`;
  /* The hero (Julian): a vertical full bleed on the right, two verticals under
     the title; a set that is mostly horizontal gets one horizontal there instead. */
  const imgs = project.images;
  const across = imgs.filter(wide).length > imgs.length / 2;
  const big = imgs.find((f) => !wide(f)) ?? imgs[0];
  const lead = across ? imgs.filter((f) => f !== big && wide(f)).slice(0, 1) : imgs.filter((f) => f !== big && !wide(f)).slice(0, 2);
  const rest = imgs.filter((f) => f !== big && !lead.includes(f));
  const pic = (f: Frame, sizes: string, priority = false) => (
    <Image src={f.src} alt={alt(f.alt)} width={f.width} height={f.height} sizes={sizes} priority={priority} style={{ background: f.color }} />
  );
  /* The credits fill the cells the sheet's last row leaves empty, when they fit there
     (up to six names, one a line); else they keep their own row under it. */
  const tail = tailHole(rest);
  const hole = tail && project.credits.length && project.credits.length <= 6 ? tail : null;
  const credits = (
    <section className="sv-row">
      <h2 className="lbl mute">Credits</h2>
      <ul>
        {project.credits.map((c) => {
          const h = handleOf(c);
          const label = creditLabel(c, h);
          const av = c.avatar ?? (h === "juliangigola" ? "/people/juliangigola.jpg" : null);
          return (
            <li key={`${c.role}${c.name}`}>
              <span className="mute">{c.role}</span>
              <b>
                {h ? (
                  <a href={`https://instagram.com/${h}`} target="_blank" rel="noopener noreferrer">
                    {/* Their avatar, on hover (always on a phone); the initial where there is none. */}
                    <span className="cr-av" aria-hidden="true">
                      {av ? <Image src={av} alt="" fill sizes="28px" /> : label.replace(/^@/, "")[0]}
                    </span>
                    {label === `@${h}` || ORG.test(c.role.trim()) ? (
                      label
                    ) : (
                      <>
                        <span className="cr-n">{label}</span>
                        <span className="cr-h">@{h}</span>
                      </>
                    )}
                  </a>
                ) : (
                  label
                )}
              </b>
            </li>
          );
        })}
      </ul>
    </section>
  );
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-project">
        <div className={across ? "pj-hero two" : "pj-hero"}>
          <header className="pj-top">
            <BackLink className="lbl mute pj-back" />
            <div className="pj-row">
              <h1 className="pg-t">{name}</h1>
              <p className="lbl mute">{sub}</p>
            </div>
            {project.intent ? <p className="sv-lead">{project.intent}</p> : null}
          </header>
          {big ? (
            <figure className="pj-big" style={{ aspectRatio: `${big.width} / ${big.height}`, "--ar": big.width / big.height } as React.CSSProperties}>
              <Image src={big.src} alt={alt(big.alt)} fill sizes={across ? "(max-width: 900px) 100vw, 60vw" : "(max-width: 900px) 100vw, 40vw"} priority style={{ objectFit: "cover", background: big.color }} />
              {/* The client's logo signs the opening frame, bottom right (Julian). */}
              {mark ? (
                <span className="pj-mark">
                  <Mark slug={mark.slug} name={mark.name} h={28} />
                </span>
              ) : null}
            </figure>
          ) : null}
          {lead.length ? (
            <div className="pj-lead">
              {lead.map((f) => (
                <figure key={f.src} className="pj-r">{pic(f, "(max-width: 900px) 100vw, 30vw", true)}</figure>
              ))}
            </div>
          ) : null}
        </div>
        {/* The rest as a contact sheet (Julian, 2026-10-27): even rows of three, a horizontal takes two cells. */}
        <div className="pj-flow">
          {rest.map((f) => (
            <figure key={f.src} className={wide(f) ? "pj-r w" : "pj-r"}>
              {pic(f, wide(f) ? "(max-width: 700px) 100vw, 66vw" : "(max-width: 700px) 100vw, 33vw")}
            </figure>
          ))}
          {hole ? (
            <div className="pj-cr" style={{ "--row": hole.row, "--col": hole.col, "--span": hole.span } as React.CSSProperties}>
              {credits}
            </div>
          ) : null}
        </div>
        <div className="sv-info">
          {hole ? null : credits}
          {next ? (
            <Link className="pj-next" href={next.href}>
              <span className="lbl mute">Next</span>
              {/* The next set's cover, so it can grow into that page's hero (page-fly.tsx). */}
              {next.cover ? (
                <span className="pj-nx">
                  <Image src={next.cover.src} alt="" fill sizes="120px" style={{ objectFit: "cover", background: next.cover.color }} />
                </span>
              ) : null}
              <b>{titleCase(next.name.replace(/^Next: /, ""))}</b>
              <span aria-hidden>&rarr;</span>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
