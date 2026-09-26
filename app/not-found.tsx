import type { Metadata } from "next";
import Link from "next/link";
import { NotFoundScene, BlinkingMark } from "@/components/not-found-scene";
import DriftWall from "@/components/DriftWall";
import { DISCIPLINES, WALL } from "@/lib/work";

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
  description: "That page is not on the site. The work, the sessions and the about page are.",
  /* A 404 inherits the root canonical, which is the homepage: without this
     a search engine could index a missing page as the front door. */
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};

const MONO = "font-mono text-[11px] uppercase tracking-[0.2em]";
const LIST_MONO =
  "font-mono text-[clamp(11px,1.35dvh,13px)] uppercase tracking-[0.16em]";

export default function NotFound() {
  const places = [
    ...DISCIPLINES.filter((d) => d.href.startsWith("/work"))
      .slice(0, 4)
      .map((d) => ({ label: d.name, count: String(d.count), href: d.href })),
    { label: "Book a session", count: "→", href: "/sessions" },
    { label: "Contact", count: "→", href: "/contact" },
  ];

  return (
    <NotFoundScene>
      <div
        data-fit-page
        className="relative overflow-hidden bg-background"
        style={{ minHeight: "100dvh" }}
      >
        {/* The room: the work itself, drifting on a wall behind the page
            (`DriftWall`), each tile a way into its project. Dimmed toward
            the ground so the words over it still read, and a
            dusting of grain over that. Julian: the 404 gets the drift wall,
            and no grid. */}
        <div className="absolute inset-0">
          <DriftWall
            items={WALL}
            columns="fill"
            tileWidth={300}
            tileHeight={400}
            gap={28}
            radius={4}
            tilt={16}
            turn={-14}
            perspective={1200}
            depth={120}
            speed={30}
            direction="up"
            variance={0.45}
            parallax={0.6}
            lift={64}
            fade={0.6}
            dim={0.4}
            overlayColor="var(--background)"
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(color-mix(in oklab, var(--foreground) 50%, transparent) 0.5px, transparent 0.5px)",
            backgroundSize: "3px 3px",
          }}
        />

        <section className="pointer-events-none relative mx-auto flex [&_a]:pointer-events-auto h-dvh w-full max-w-[100rem] flex-col justify-center gap-4 px-6 pb-6 pt-20 sm:gap-6 sm:px-10 sm:pt-24">
          {/* The slate. */}
          <div className="rise flex flex-wrap items-center gap-3.5">
            <BlinkingMark className="size-6 shrink-0 text-foreground" />
            <span
              className={`${MONO} inline-flex items-center gap-2 bg-foreground px-3 py-1.5 font-bold text-background`}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-accent animate-[jg-blink_1.8s_steps(1)_infinite] motion-reduce:animate-none"
              />
              Frame not found
            </span>
            <span
              className={`${MONO} inline-flex items-center border border-[color-mix(in_oklab,var(--accent)_40%,transparent)] px-3 py-1.5 font-bold text-accent`}
            >
              Error 404
            </span>
            <span
              data-requested-path
              className={`${MONO} text-muted-foreground`}
            >
              this address
            </span>
          </div>

          {/* The frame that has not been found. Blur is applied by the scene
              once it knows a pointer can clear it; without one it stays
              sharp. */}
          <div
            data-numerals
            className="rise select-none font-display font-bold leading-[0.82] tracking-[-0.05em] text-foreground"
            style={{
              // By the window's height as well as its width: the page never
              // scrolls, so the numerals give way on a short window.
              fontSize: "clamp(64px, min(26vw, 26dvh), 340px)",
              transition: "filter 0.1s linear, opacity 0.1s linear",
              ["--reveal-delay" as string]: "80ms",
            }}
          >
            404
          </div>

          {/* The list is the wider column: Julian wanted the ways out to
              take up more of the page. */}
          <div
            className="rise grid items-end gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] sm:gap-11"
            style={{ ["--reveal-delay" as string]: "160ms" }}
          >
            <div className="@container max-w-[40rem]">
              <h1 className="font-display text-2xl uppercase leading-[1.02] tracking-[0] text-foreground sm:text-[clamp(2.25rem,5.2dvh,3.5rem)]">
                This frame never made the edit.
              </h1>
              {/* For a mouse, so not on a phone, where the page has no room.
                  Two lines, justified edge to edge, Julian's call: the
                  sentence runs about 80 times its size, so a size of the
                  column's width over 42 sets it on two lines with a little
                  room, and the last line is justified as well. */}
              <p className="mt-4 text-justify text-[clamp(11.5px,2.39cqi,17px)] leading-[1.7] text-muted-foreground [text-align-last:justify] max-sm:hidden">
                The page you were looking for has been moved, renamed, or cut
                from the selects. Drag your cursor across the numerals to pull
                them into focus, or head back to the work.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 sm:mt-7">
                <Link
                  href="/work"
                  className={`${MONO} action inline-flex items-center gap-3 px-6 py-4 font-bold press active:scale-[0.97]`}
                >
                  <span className="opacity-60">01</span>
                  See the work
                </Link>
                <Link
                  href="/"
                  className={`${MONO} action-quiet inline-flex items-center gap-3 px-6 py-4 font-bold press active:scale-[0.97]`}
                >
                  <span className="opacity-60">02</span>
                  Back to home
                </Link>
              </div>
            </div>

            {/* Not on a phone: the page never scrolls, and the wall's tiles
                behind are ways into the work already. */}
            <div className="flex flex-col gap-3.5 max-sm:hidden">
              <div className={`${MONO} text-muted-foreground`}>
                Try one of these
              </div>
              <ol className="flex flex-col">
                {places.map((p, i) => (
                  <li key={p.href}>
                    <Link
                      prefetch={false}
                      href={p.href}
                      className="group flex items-baseline gap-5 border-t border-border px-0.5 py-[clamp(0.4rem,1.3dvh,1rem)] text-foreground transition-colors duration-200 hoverable:hover:text-accent"
                    >
                      {/* Sized by the window's height as well, like the
                          numerals: six rows this size and the page never
                          scrolls. */}
                      <span className={`${LIST_MONO} min-w-[2.5ch] text-accent`}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 font-display text-[clamp(1.125rem,2.8dvh,2rem)] uppercase leading-none tracking-[0]">
                        {p.label}
                      </span>
                      <span className={`${LIST_MONO} text-muted-foreground`}>
                        {p.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* The foot of the slate: the focus readout, live. */}
          <div
            className={`${MONO} rise flex flex-wrap justify-between gap-4 border-t border-border pt-3.5 text-muted-foreground`}
            style={{ ["--reveal-delay" as string]: "240ms" }}
          >
            <span>&copy; {new Date().getFullYear()} Julian Gigola</span>
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-accent animate-[jg-blink_1.8s_steps(1)_infinite] motion-reduce:animate-none"
              />
              <span data-focus-readout>Focus</span>
            </span>
            <span>San Francisco Bay Area</span>
          </div>
        </section>
      </div>
    </NotFoundScene>
  );
}
