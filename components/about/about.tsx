import Link from "next/link";
import { PageFoot } from "@/components/site/chrome";
import { DOES } from "@/lib/home/data";
import { Marks } from "@/components/site/duo";
import { AboutGallery } from "@/components/about/about-gallery";
import { LogoBand } from "@/components/about/logo-band";

/* JG V3 About (/about): portrait gallery, the justified bio, facts,
   What I do, the two CTAs, and the client marks as a grid. */

/* Locked copy (DESIGN.md, Bio). No soft hyphens: words stay whole, and the place names carry
   no-break spaces so they never split. */
const BIO =
  "I photograph people, mostly for fashion, music and brands. I shoot editorials and campaigns, and help labels and musicians shape how they’re seen. I also cover the moments people want to keep: headshots, portraits, graduations and weddings across San Francisco, San Jose and the Bay Area. Growing up Assyrian American, between cultures, taught me to watch from slightly outside the frame.";

export function About() {
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-about">
        <div className="about">
          <header className="ab-top">
            <h1 className="pg-t ab-say">About me</h1>
          </header>
          <AboutGallery />
          <div className="ab-text">
            <p className="ab-bio">{BIO}</p>
            <dl className="facts">
              <div><dt className="lbl mute">Based in</dt><dd>SF Bay Area</dd></div>
              <div><dt className="lbl mute">Shooting</dt><dd>12 years</dd></div>
              <div><dt className="lbl mute">Travel</dt><dd>Worldwide</dd></div>
            </dl>
            <div className="ab-block">
              <h2 className="lbl mute">What I do</h2>
              <ol className="svc">
                {DOES.map((d, i) => (
                  <li key={d}><span className="lbl mute">{String(i + 1).padStart(2, "0")}</span>{d}</li>
                ))}
              </ol>
            </div>
            <div className="ctas">
              <Link className="btn fill" href="/contact/form">Inquire</Link>
              <Link className="btn" href="/portfolio">See the work</Link>
              <Link className="btn v4-m2p" href="/bts">Behind the scenes</Link>
            </div>
          </div>
        </div>
        <section className="ab-logos">
          <h2 className="lbl mute">Commissioned and published by</h2>
          <LogoBand>
            <Marks cell />
          </LogoBand>
        </section>
        <PageFoot />
      </section>
    </div>
  );
}
