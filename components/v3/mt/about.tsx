"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ABOUT_FACTS, ABOUT_SENTENCE } from "./data";

/* Spec 3.9: one screen. The sentence is one paragraph; the per-word spans
   (`--w`) and the wordmark's per-letter spans (`--j`) are for the motion pass. */
const WORDMARK = "Julian Gigola";

export function MtAbout({ does }: { does: string[] }) {
  const words = ABOUT_SENTENCE.split(" ");
  return (
    <section className="mt-about" data-mt="about" data-hold="1.7">
      <div className="mt-stage">
        <figure className="mt-ab-ph">
          <Image src="/about/julian-studio.jpg" alt="Julian Gigola at the tether station on set" fill sizes="100vw" />
        </figure>
        <p className="mt-wordmark" aria-hidden>
          {[...WORDMARK].map((ch, j) => <span key={j} style={{ "--j": j } as React.CSSProperties}>{ch === " " ? " " : ch}</span>)}
        </p>
        <div className="mt-frame">
          <div className="mt-ab-col">
            <p className="lbl mute mt-label">About</p>
            <p className="mt-say" style={{ "--n": words.length } as React.CSSProperties}>
              {words.map((w, i) => (
                <React.Fragment key={i}>
                  <span style={{ "--w": i } as React.CSSProperties}>{w}</span>{i < words.length - 1 ? " " : null}
                </React.Fragment>
              ))}
            </p>
            <div className="mt-does">
              <h2 className="lbl mute">What I do</h2>
              <ol>
                {does.map((d, j) => (
                  <li key={d} style={{ "--j": j } as React.CSSProperties}>
                    <span className="lbl mute">{String(j + 1).padStart(2, "0")}</span>
                    <b>{d}</b>
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-ab-foot">
              <hr />
              <dl>
                {ABOUT_FACTS.map(([k, v], j) => (
                  <div key={k} style={{ "--j": j } as React.CSSProperties}>
                    <dt className="lbl mute">{k}</dt>
                    <dd className="lbl">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="lbl mt-facts">{ABOUT_FACTS.map(([, v]) => v).join(" | ")}</p>
            </div>
          </div>
        </div>
        <Link className="btn mt-more-me" href="/about">More about me</Link>
      </div>
    </section>
  );
}
