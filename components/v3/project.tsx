import Image from "next/image";
import Link from "next/link";
import { Mark } from "@/components/v3/duo";
import { billing, markFor, titleCase } from "@/lib/work";
import type { Frame, Project } from "@/lib/work-types";

/* JG V3 project page (leftovers sheet, card B; Julian: vertical, with the
   client's logo where there is one). The head: back link, the set's name in
   title case, the logo on the right; then the opening frame wide, the rest
   in three uneven columns, the credits as rows, and the next project. */

const wide = (f: Frame) => f.width > f.height;

/** The rest of a set in the magazine rhythm: a horizontal full width, two
    verticals side by side, a lone vertical offset left or right in turn. */
function rhythm(frames: Frame[]) {
  const rows: ({ k: "wide"; f: Frame } | { k: "pair"; a: Frame; b: Frame } | { k: "one"; f: Frame; right: boolean })[] = [];
  let side = false;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (wide(f)) rows.push({ k: "wide", f });
    else if (frames[i + 1] && !wide(frames[i + 1])) rows.push({ k: "pair", a: f, b: frames[++i] });
    else rows.push({ k: "one", f, right: (side = !side) });
  }
  return rows;
}

export function V3Project({ project, next }: { project: Project; next?: { href: string; name: string } }) {
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
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-project">
        <div className={across ? "pj-hero two" : "pj-hero"}>
          <header className="pj-top">
            <Link className="lbl mute pj-back" href="/portfolio">&larr; Portfolio</Link>
            <div className="pj-row">
              <h1 className="pg-t">{name}</h1>
              <p className="lbl mute">{sub}</p>
            </div>
            {project.intent ? <p className="sv-lead">{project.intent}</p> : null}
          </header>
          {big ? (
            <figure className="pj-big" style={{ aspectRatio: `${big.width} / ${big.height}` }}>
              <Image src={big.src} alt={alt(big.alt)} fill sizes="(max-width: 900px) 100vw, 40vw" priority style={{ objectFit: "cover", background: big.color }} />
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
        <div className="pj-flow">
          {rhythm(rest).map((r) =>
            r.k === "wide" ? (
              <figure key={r.f.src} className="pj-r w">{pic(r.f, "100vw")}</figure>
            ) : r.k === "pair" ? (
              <div key={r.a.src} className="pj-pair">
                <figure className="pj-r">{pic(r.a, "(max-width: 700px) 100vw, 50vw")}</figure>
                <figure className="pj-r">{pic(r.b, "(max-width: 700px) 100vw, 50vw")}</figure>
              </div>
            ) : (
              <figure key={r.f.src} className={r.right ? "pj-r one r" : "pj-r one"}>{pic(r.f, "(max-width: 700px) 100vw, 42vw")}</figure>
            ),
          )}
        </div>
        <div className="sv-info">
          <section className="sv-row">
            <h2 className="lbl mute">Credits</h2>
            <ul>
              {project.credits.map((c) => (
                <li key={`${c.role}${c.name}`}>
                  <span className="mute">{c.role}</span>
                  <b>{c.instagram ? <a href={`https://instagram.com/${c.instagram}`}>@{c.instagram}</a> : c.name}</b>
                </li>
              ))}
            </ul>
          </section>
          {next ? (
            <Link className="pj-next" href={next.href}>
              <span className="lbl mute">Next</span>
              <b>{titleCase(next.name.replace(/^Next: /, ""))}</b>
              <span aria-hidden>&rarr;</span>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
