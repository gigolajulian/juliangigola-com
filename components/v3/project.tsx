import Image from "next/image";
import Link from "next/link";
import { Mark } from "@/components/v3/duo";
import { billing, markFor, titleCase } from "@/lib/work";
import type { Project } from "@/lib/work-types";

/* JG V3 project page (leftovers sheet, card B; Julian: vertical, with the
   client's logo where there is one). The head: back link, the set's name in
   title case, the logo on the right; then the opening frame wide, the rest
   in three uneven columns, the credits as rows, and the next project. */

export function V3Project({ project, next }: { project: Project; next?: { href: string; name: string } }) {
  const mark = markFor(project.slug);
  const client = billing(project);
  const sub = [client, project.categories[0] && titleCase(project.categories[0].name), `${project.images.length} frames`].filter(Boolean).join(" · ");
  const [first, ...rest] = project.images;
  const cols = [0, 1, 2].map((c) => rest.filter((_, i) => i % 3 === c));
  const name = titleCase(project.headline ?? project.name);
  const alt = (a: string) => a || `${name} by Julian Gigola`;
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-project">
        <header className="pj-top">
          <Link className="lbl mute pj-back" href="/portfolio">&larr; Portfolio</Link>
          <div className="pj-row">
            {mark ? (
              <span className="pj-mark">
                <Mark slug={mark.slug} name={mark.name} h={28} />
              </span>
            ) : null}
            <h1 className="pg-t">{name}</h1>
            <p className="lbl mute">{sub}</p>
          </div>
          {project.intent ? <p className="sv-lead">{project.intent}</p> : null}
        </header>
        {first ? (
          <figure className="pj-open">
            <Image src={first.src} alt={alt(first.alt)} width={first.width} height={first.height} sizes="100vw" priority style={{ background: first.color }} />
          </figure>
        ) : null}
        <div className="pj-seq">
          {cols.map((c, k) => (
            <div className="col" key={k}>
              {c.map((f) => (
                <figure key={f.src}>
                  <Image src={f.src} alt={alt(f.alt)} width={f.width} height={f.height} sizes="(max-width: 700px) 100vw, 32vw" style={{ background: f.color }} />
                </figure>
              ))}
            </div>
          ))}
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
