import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WITH_BTS, titleCase } from "@/lib/work";
import { V3Foot } from "@/components/v3/chrome";
import { BtsCredit, BtsPageGrid } from "@/components/bts";

export const metadata: Metadata = {
  title: "Behind the scenes",
  description:
    "Behind the scenes on my shoots in San Francisco and the Bay Area, shoot by shoot.",
  alternates: { canonical: "/bts" },
};

const pad = (n: number) => String(n).padStart(2, "0");

/* Every shoot that has BTS, in the running order, one row each: the name
   and who shot it on the left, the frames in a grid on the right. Linked
   from the biography. Only projects with a `bts` entry in
   `content/projects.json` are here. */
export default function BtsPage() {
  if (!WITH_BTS.length) notFound();
  /* JG V3 (leftovers card I): the V3 head, a row per shoot, the V3 foot. */
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-bts">
        <div className="pg-head">
          <h1 className="pg-t">Behind the scenes</h1>
          <p className="lbl mute">
            {pad(WITH_BTS.length)} {WITH_BTS.length === 1 ? "shoot" : "shoots"}
          </p>
        </div>
        {WITH_BTS.map((p, i) => (
          <section key={p.slug} id={p.slug} className="bts-row">
            <div className="bts-side">
              <span className="lbl mute">{pad(i + 1)}</span>
              <h2>{titleCase(p.headline ?? p.name)}</h2>
              <BtsCredit bts={p.bts!} />
              <Link className="btn fill" href={`/portfolio/${p.slug}`}>See the shoot</Link>
            </div>
            <div className="bts-main">
              <BtsPageGrid bts={p.bts!} name={p.name} />
              {/* The finished frames the day made, the last one opening the set. */}
              <div className="bts-shoot">
                <p className="lbl mute">The shoot · {pad(p.images.length)} frames</p>
                <div className="bts-frames">
                  {p.images.slice(0, 4).map((f, k) => (
                    <Link key={f.src} href={`/portfolio/${p.slug}`} className="bts-f" aria-label={k === 3 ? `See all ${p.images.length} frames of ${p.name}` : undefined} tabIndex={k === 3 ? 0 : -1}>
                      <Image src={f.src} alt={f.alt || `${p.name} by Julian Gigola`} fill sizes="(max-width: 800px) 50vw, 18vw" style={{ objectFit: "cover", background: f.color }} />
                      {k === 3 && p.images.length > 4 ? <span className="bts-more lbl">+{p.images.length - 4} · See the shoot</span> : null}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ))}
        <V3Foot />
      </section>
    </div>
  );
}
