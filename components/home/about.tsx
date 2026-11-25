import Image from "next/image";
import Link from "next/link";
import { Marks } from "@/components/site/duo";
import { ABOUT_FACTS, ABOUT_SENTENCE } from "@/lib/home/data";

/* The statement, straight after the hero: who I work for in one sentence, the facts, my portrait, and the clients
   as one row of marks. Keeps the `#about` anchor the header and the /about redirect land on. */
export function HomeAbout() {
  return (
    <section id="about" className="mt-about" aria-label="About" data-mt="about">
      <div className="mt-frame mt-st">
        <div className="mt-st-in">
          <div className="mt-st-l">
            <h2 className="mt-st-t">{ABOUT_SENTENCE}</h2>
            <div className="mt-st-b">
              <dl className="mt-st-facts">
                {ABOUT_FACTS.map(([k, v]) => (
                  <div key={k}>
                    <dt className="lbl mute">{k}</dt>
                    <dd className="lbl">{v}</dd>
                  </div>
                ))}
              </dl>
              <Link className="btn mt-st-more" href="/about">
                More about me
              </Link>
            </div>
          </div>
          {/* the same page as the button beside it, so the keyboard meets it once */}
          <Link className="mt-st-ph" href="/about" tabIndex={-1}>
            <Image src="/about/julian-studio.jpg" alt="Julian Gigola at the tether station on set" fill sizes="(min-width:1024px) 40vw, 100vw" />
          </Link>
        </div>
        <div className="mt-st-logos lbl">
          <span className="mute">
            Commissioned and
            <br />
            published by
          </span>
          <Marks />
        </div>
      </div>
    </section>
  );
}
