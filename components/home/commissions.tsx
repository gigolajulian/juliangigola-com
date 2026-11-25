import Image from "next/image";
import Link from "next/link";
import { Mark } from "@/components/site/duo";
import { CLIENT_MARKS } from "@/lib/work/clients-data";
import { projectHref } from "@/lib/work/project-href";
import type { HomeFrame } from "@/lib/home/data";

/* Commissions: four frames in a row, the client's mark on each photo and the type of work under it.
   On scroll each frame rises into place and its photo fades in, left to right (motion/flow.css, from the engine's --in). */
export function HomeCommissions({ frames }: { frames: HomeFrame[] }) {
  return (
    <section className="mt-comm" data-mt="comm" aria-labelledby="mt-cm-h">
      <div className="mt-frame mt-cm">
        <div className="mt-cm-head">
          <h2 id="mt-cm-h">Commissions</h2>
          <p className="lbl mute">Brands, artists and magazines</p>
        </div>
        <div className="mt-cm-grid">
          {frames.map((f) => {
            // "Cyber1a 01" names the frame; the client is the name without its number
            const client = f.name.replace(/ \d+$/, "");
            return (
              <figure key={f.src}>
                <Link className="mt-cm-ph" href={projectHref(f.slug)}>
                  <Image src={f.src} alt={client} fill sizes="(min-width:1024px) 25vw, 50vw" />
                  {/* the photo's alt already names the client in this link */}
                  <span className="mt-cm-mk" aria-hidden>
                    {CLIENT_MARKS[f.slug] ? <Mark slug={f.slug} name={client} h={20} even /> : client}
                  </span>
                </Link>
                <figcaption className="lbl mute">{f.meta}</figcaption>
              </figure>
            );
          })}
        </div>
        <Link className="btn mt-cm-all" href="/portfolio">
          See all projects
        </Link>
      </div>
    </section>
  );
}
