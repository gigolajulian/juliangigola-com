import Image from "next/image";
import Link from "next/link";
import { V3Foot } from "@/components/v3/chrome";
import { Marks } from "@/components/v3/duo";
import { ABOUT_PHOTO } from "@/lib/v3";

/* JG V3 About (master v39, /about): portrait, the justified bio, facts,
   What I do, the two CTAs, and the client marks as a grid. */

/* Locked copy (DESIGN.md, Bio), with the master's soft hyphens. */
const S = "­";
const BIO = `I photo${S}graph people, mostly for fash${S}ion, music and brands. I shoot edi${S}to${S}ri${S}als and cam${S}paigns, and help la${S}bels and mu${S}si${S}cians shape how they're seen. I also cover the mo${S}ments people want to keep: head${S}shots, por${S}traits, grad${S}u${S}a${S}tions and wed${S}dings across San Fran${S}cis${S}co, San Jose and the Bay Area. Grow${S}ing up As${S}syr${S}i${S}an Amer${S}i${S}can, be${S}tween cul${S}tures, taught me to watch from slight${S}ly out${S}side the frame.`;

const DOES = ["Photography", "Creative direction", "Art direction", "Producing", "Camera operation", "Post-production"];

export function V3About() {
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-about">
        <div className="about">
          <header className="ab-top">
            <h1 className="pg-t ab-say">About me</h1>
          </header>
          <figure className="ab-photo">
            <Image src={ABOUT_PHOTO} alt="Julian Gigola sitting on stone steps under a tree" width={960} height={1280} sizes="(max-width: 800px) 100vw, 40vw" priority />
            <figcaption className="lbl mute">Julian Gigola, San Jose</figcaption>
          </figure>
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
              <Link className="btn fill" href="/contact">Inquire</Link>
              <Link className="btn" href="/portfolio">See the work</Link>
            </div>
          </div>
        </div>
        <section className="ab-logos">
          <h2 className="lbl mute">Worked with</h2>
          <div className="lg">
            <Marks cell />
          </div>
        </section>
        <V3Foot />
      </section>
    </div>
  );
}
