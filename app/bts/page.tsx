import type { Metadata } from "next";
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
          <div>
            <p className="lbl mute">On set</p>
            <h1 className="pg-t">Behind the scenes</h1>
          </div>
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
              <Link className="btn" href={`/portfolio/${p.slug}`}>See the shoot</Link>
            </div>
            <BtsPageGrid bts={p.bts!} name={p.name} />
          </section>
        ))}
        <V3Foot />
      </section>
    </div>
  );
}
