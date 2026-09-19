import type { Metadata } from "next";
import Link from "next/link";
import { NotFoundScene } from "@/components/not-found-scene";
import { DISCIPLINES } from "@/lib/work";

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
 * Colour comes from the design rather than the site's tokens: a warm tan and
 * a leather for the accents, on the site's own ground. They are scoped to
 * this page as custom properties; nothing else on the site uses them.
 * ─────────────────────────────────────────────────────────────── */

/** The site's mark — the eye from `app/icon.svg`, drawn in the page's ink. */
function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="6.8"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M8.4 50C23.07 22.32 76.93 22.32 91.6 50 76.93 77.68 23.07 77.68 8.4 50Z" />
      <circle cx="50" cy="50" r="25" />
      <circle cx="50" cy="50" r="11.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "Frame not found",
  description: "That page is not on the site. The work, the sessions and the about page are.",
  /* A 404 inherits the root canonical, which is the homepage: without this
     a search engine could index a missing page as the front door. */
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};

const MONO = "font-mono text-[11px] uppercase tracking-[0.2em]";

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
        className="relative overflow-hidden bg-background [--leather:#C9B89A] [--tan:#B59970]"
        style={{ minHeight: "100dvh" }}
      >
        {/* The room: two drifting glows, a faint grid, a dusting of grain.
            All decorative, all behind everything, and all still under
            reduced motion. The glows are a quarter less blurred than the
            design drew them, at Julian's ask — enough edge that they read
            as light in a room rather than a wash. */}
        <div
          aria-hidden
          className="pointer-events-none absolute animate-[jg-drift-a_24s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{
            width: "68vw",
            height: "68vw",
            left: "-14vw",
            top: "-16vw",
            filter: "blur(34px)",
            background:
              "radial-gradient(closest-side, rgba(181,153,112,0.38), rgba(181,153,112,0))",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute animate-[jg-drift-b_30s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{
            width: "60vw",
            height: "60vw",
            right: "-16vw",
            bottom: "-22vw",
            filter: "blur(38px)",
            background:
              "radial-gradient(closest-side, rgba(92,142,158,0.28), rgba(92,142,158,0))",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-55"
          style={{
            backgroundImage:
              "linear-gradient(rgba(236,237,232,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(236,237,232,0.045) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(rgba(236,237,232,0.5) 0.5px, transparent 0.5px)",
            backgroundSize: "3px 3px",
          }}
        />

        <section className="relative mx-auto flex min-h-dvh w-full max-w-[100rem] flex-col justify-center gap-6 px-6 pb-16 pt-32 sm:gap-8 sm:px-10 sm:pt-40">
          {/* The slate. */}
          <div className="rise flex flex-wrap items-center gap-3.5">
            <Mark className="size-6 shrink-0 text-foreground" />
            <span
              className={`${MONO} inline-flex items-center gap-2 bg-foreground px-3 py-1.5 font-bold text-background`}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-[var(--tan)] animate-[jg-blink_1.8s_steps(1)_infinite] motion-reduce:animate-none"
              />
              Frame not found
            </span>
            <span
              className={`${MONO} inline-flex items-center border border-[color-mix(in_oklab,var(--leather)_40%,transparent)] px-3 py-1.5 font-bold text-[var(--leather)]`}
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
              fontSize: "clamp(104px, 26vw, 340px)",
              transition: "filter 0.1s linear, opacity 0.1s linear",
              ["--reveal-delay" as string]: "80ms",
            }}
          >
            404
          </div>

          <div
            className="rise grid items-end gap-6 sm:gap-11"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              ["--reveal-delay" as string]: "160ms",
            }}
          >
            <div className="max-w-[48ch]">
              <h1 className="font-display text-2xl uppercase leading-[1.02] tracking-[0] text-foreground sm:text-4xl">
                This frame never made the edit.
              </h1>
              <p className="mt-4 text-sm leading-[1.7] text-muted-foreground [text-wrap:pretty]">
                The page you were looking for has been moved, renamed, or cut
                from the selects. Drag your cursor across the numerals to pull
                them into focus, or head back to the work.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 sm:mt-7">
                <Link
                  href="/work"
                  className={`${MONO} inline-flex items-center gap-3 bg-[var(--tan)] px-6 py-4 font-bold text-[#1A1D21] press active:scale-[0.97] hoverable:hover:bg-[var(--leather)]`}
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

            <div className="flex flex-col gap-3.5">
              <div className={`${MONO} text-muted-foreground`}>
                Try one of these
              </div>
              <ol className="flex flex-col">
                {places.map((p, i) => (
                  <li key={p.href}>
                    <Link
                      prefetch={false}
                      href={p.href}
                      className="group flex items-baseline gap-3.5 border-t border-border px-0.5 py-3 text-foreground transition-colors duration-200 hoverable:hover:text-[var(--leather)]"
                    >
                      <span
                        className={`${MONO} min-w-[22px] tracking-[0.16em] text-[var(--tan)]`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 font-display text-base uppercase leading-none tracking-[0]">
                        {p.label}
                      </span>
                      <span
                        className={`${MONO} tracking-[0.16em] text-muted-foreground`}
                      >
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
                className="size-1.5 rounded-full bg-[var(--tan)] animate-[jg-blink_1.8s_steps(1)_infinite] motion-reduce:animate-none"
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
