import type { Metadata } from "next";
import Link from "next/link";
import { NotFoundScene, BlinkingMark } from "@/components/not-found-scene";
import DriftWall from "@/components/DriftWall";
import { DISCIPLINES, WALL, titleCase } from "@/lib/work";
import { wallItem } from "@/lib/wall-tile";

/* ── 404 ──────────────────────────────────────────────────────────
 * From a design Julian made in Claude Design and asked to have on the site,
 * with the site's own type in place of the design's: Univers Bold Condensed
 * where it set Space Grotesk, Geist Mono where it set Space Mono.
 *
 * The idea is a frame the lens has not found. The numerals open out of
 * focus and the pointer pulls them sharp (`not-found-scene.tsx`); a readout
 * in the foot reports the focus until it locks; the page is tagged like a
 * contact sheet — FRAME NOT FOUND, ERROR 404, the path that was asked for —
 * and offers the disciplines as somewhere to go instead, with live counts.
 *
 * Colour is the site's own: its ground and ink, its muted grey, and its one
 * accent where the design had a tan and a leather. Julian: use the same
 * colours as the website. So it follows the theme like every other page.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Frame not found",
  description:
    "That page is not on the site. The work, the sessions and the about page are.",
  /* A 404 inherits the root canonical, which is the homepage: without this
     a search engine could index a missing page as the front door. */
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};


export default function NotFound() {
  const places = [
    ...DISCIPLINES.filter((d) => d.href.startsWith("/portfolio"))
      .slice(0, 4)
      .map((d) => ({ label: titleCase(d.name), count: String(d.count), href: d.href })),
    { label: "Book a session", count: "→", href: "/#sessions" },
    { label: "Contact", count: "→", href: "/#contact" },
  ];

  return (
    <NotFoundScene>
      <div
        data-fit-page
        className="relative overflow-hidden"
        style={{ minHeight: "100dvh", background: "var(--bg)" }}
      >
        {/* The room: the work itself, drifting on a wall behind the page
            (`DriftWall`), each tile a way into its project. Dimmed toward
            the ground so the words over it still read, and a
            dusting of grain over that. Julian: the 404 gets the drift wall,
            and no grid. */}
        <div className="absolute inset-0">
          <DriftWall
            items={WALL.map(wallItem)}
            columns="fill"
            tileWidth={300}
            tileHeight={400}
            gap={28}
            radius={8}
            tilt={16}
            turn={-14}
            perspective={1200}
            depth={120}
            speed={24}
            direction="up"
            variance={0.45}
            parallax={0.6}
            lift={16}
            fade={0.6}
            dim={0.4}
            build
            overlayColor="var(--bg)"
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(color-mix(in oklab, var(--ink) 50%, transparent) 0.5px, transparent 0.5px)",
            backgroundSize: "3px 3px",
          }}
        />

        {/* JG V3 (leftovers card H): the master's type, buttons and rows over the same wall. */}
        <section className="v3 nf pointer-events-none relative [&_a]:pointer-events-auto">
          <div className="rise nf-slate lbl mute">
            <BlinkingMark className="size-5 shrink-0 text-(--ink)" />
            <span>
              <span aria-hidden className="nf-dot" /> Frame not found
            </span>
            <span>Error 404</span>
            <span data-requested-path>this address</span>
          </div>

          {/* The frame that has not been found: blurred until the pointer pulls it sharp (`not-found-scene.tsx`). */}
          <div data-numerals className="rise nf-num" style={{ ["--reveal-delay" as string]: "80ms" }}>
            404
          </div>

          <div className="rise nf-grid" style={{ ["--reveal-delay" as string]: "160ms" }}>
            <div>
              <h1 className="nf-h">This frame never made the edit.</h1>
              <p className="nf-p">
                The page you were looking for has been moved, renamed, or cut from the selects.{" "}
                <span className="hoverable:hidden">Head back to the work.</span>
                <span className="hidden hoverable:inline">Drag your cursor across the numerals to pull them into focus, or head back to the work.</span>
              </p>
              <div className="ctas">
                <Link href="/portfolio" className="btn fill">See the work</Link>
                <Link href="/" className="btn">Back to home</Link>
              </div>
            </div>
            <div className="nf-list">
              <div className="lbl mute">Try one of these</div>
              <ol>
                {places.map((p, i) => (
                  <li key={p.href}>
                    <Link prefetch={false} href={p.href} className="row">
                      <span className="n lbl">{String(i + 1).padStart(2, "0")}</span>
                      <b className="t">{p.label}</b>
                      <span className="p lbl mute">{p.count}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="rise foot-line lbl mute" style={{ ["--reveal-delay" as string]: "240ms" }}>
            <span>&copy; {new Date().getFullYear()} Julian Gigola</span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="nf-dot" />
              <span data-focus-readout>Focus</span>
            </span>
            <span>San Francisco Bay Area</span>
          </div>
        </section>
      </div>
    </NotFoundScene>
  );
}
