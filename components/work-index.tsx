"use client";

import * as React from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { IndexRow } from "@/lib/work";

/* ── the contact sheet ────────────────────────────────────────────
 * The index is a typographic list, not a grid of thumbnails.
 *
 * Seventy-odd projects as a grid is a wall — nothing is legible and nothing
 * is comparable. As a list they are all scannable at once, and pointing at a
 * row brings its opening frame up in the fixed panel beside it. That is a
 * photographer's contact sheet: names on the sleeve, the frame you are
 * looking at held up to the light.
 *
 * It is also the fast option. The list is text, so it renders instantly and
 * a crawler reads every project; only one photograph is ever loaded at full
 * size, and it changes as you move.
 *
 * On a touch screen there is no pointer to follow, so each row carries its
 * own frame inline and the panel is not rendered at all.
 *
 * Filtering is routing, not state. Each category is a page of its own, which
 * means a discipline can be linked, shared and indexed — and that the URL
 * always describes what is on screen. The filtering itself then happens on
 * the server, so this component only ever renders the list it is given.
 *
 * Which is also what makes the load animation honest. A chip is a link to a
 * new page, so the rows are new DOM every time and `rise` runs on them from
 * `@starting-style` — on a client-side navigation exactly as on a cold load,
 * with no mounted flag to track. The delay steps down the first few rows so
 * a filter click reads as the list arriving rather than snapping.
 *
 * No prefetch on the rows. Next prefetches every link that scrolls into
 * view, and this list has fifty-five: one visitor scrolling it cost ~55
 * Worker requests before they clicked anything, on a plan capped at a
 * hundred thousand a day — which the site hit (Cloudflare error 1027). A
 * row fetches on click instead, which the cover's morph covers.
 *
 * `children`, when given, takes the place of the list: a discipline that is
 * one gallery (Cover art, Automotive) shows its frames under the same chips
 * instead of sending the visitor off to a project page.
 * ─────────────────────────────────────────────────────────────── */

/**
 * The row that was last clicked, kept across navigations.
 *
 * The morph runs in both directions only if both ends exist. Going in, the
 * panel is showing the cover of the row under the pointer, so it does. Coming
 * back, this component mounts fresh with the highlight on row one — and the
 * cover that should return has no cell to return to. Module state survives
 * a client-side round trip where component state does not, so the panel
 * reopens on the row that was left and the cover lands back in it.
 */
let lastLeft: string | null = null;

/**
 * Which cover carries the name: the panel's, or the row's.
 *
 * Above `lg` the panel is shown and each row's inline cover is `lg:hidden`;
 * below, the reverse. Both are always in the DOM, and a `<ViewTransition>`
 * name on an element that is not displayed is ignored by the browser — but
 * React counts *mounts*, and two components with one name mounted at once is
 * an error in its book. So the name goes on whichever is on screen, decided
 * by the same query the classes use, and the other renders its picture bare.
 * False on the server, which is the mobile answer; a desktop flips it on
 * hydration, long before anything is clicked.
 */
const WIDE = "(min-width: 1024px)";
const subscribeWide = (onChange: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/** The picture, named to travel when `on`, and plain otherwise. */
function Travels({
  on,
  slug,
  children,
}: {
  on: boolean;
  slug: string;
  children: React.ReactNode;
}) {
  if (!on) return <>{children}</>;
  return (
    <ViewTransition name={`cover-${slug}`} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}

export function WorkIndex({
  projects,
}: {
  /** Trimmed on the server to what a row shows — see `indexRow`. */
  projects: IndexRow[];
}) {
  const wide = React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );

  /* Whether the pointer is on the list at all. The panel leans in while
     it is: the slow zoom the video tiles have, which Julian liked and
     asked for a touch of here. Held on the list rather than on a row so
     moving between rows does not reset it. */
  const [hovering, setHovering] = React.useState(false);

  /* Where the block starts, so its height can be the rest of the screen.
     Read once the layout is settled and again on resize; written as a
     custom property so the height stays a CSS calculation. At scroll 0
     the block's top is exactly under the chips. */
  const block = React.useRef<HTMLDivElement>(null);
  const listColumn = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = block.current;
    if (!el) return;
    const measure = () =>
      el.style.setProperty(
        "--block-top",
        `${el.getBoundingClientRect().top + window.scrollY}px`,
      );
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* Coming back from a project, the list scrolls itself to the row that
     was left, since the page can no longer do that for it. */
  React.useLayoutEffect(() => {
    if (!lastLeft || !listColumn.current) return;
    const row = listColumn.current.querySelector<HTMLElement>(
      `a[href="/work/${lastLeft}"]`,
    );
    row?.scrollIntoView({ block: "center" });
  }, []);

  const [active, setActive] = React.useState(() => {
    const at = lastLeft ? projects.findIndex((p) => p.slug === lastLeft) : -1;
    return at === -1 ? 0 : at;
  });

  // The highlight can point past the end of a shorter list — the list changes
  // with the route, and this is a fresh mount each time, but clamping on read
  // costs nothing and removes the assumption.
  const preview = projects[Math.min(active, projects.length - 1)];

  return (
    <>
      {/* The head and the chips are the layout's now (`work-shell.tsx`),
          and so is the out-then-in between filters; this is the list. */}
      <div
        ref={block}
        className={cn(
          "mt-6 gap-16 lg:flex lg:items-start",
          /* From `lg` the block is the rest of the screen: the cover fills
             its height and the list scrolls inside its own column, so the
             page does not scroll at all while the visitor is reading the
             list. Julian: contain the scroll in this section and keep the
             photo full height. Once the list reaches its end the wheel
             carries on down the page, as he asked next. `--block-top` is
             measured below. */
          "lg:h-[calc(100dvh-var(--block-top)-1.5rem)]",
        )}
      >
        {/* The panel, on the left — Julian moved it there. Sticky rather
              than fixed, so it scrolls out with the section instead of
              hanging over the footer. */}
        <div className="hidden lg:block lg:h-full lg:w-1/2">
          {/* Two wrappers that outlive the keyed picture inside them, so the
              zoom transitions rather than restarts on every row change.
              Same numbers as `video-grid.tsx`: 4% over 500ms. The mat frame
              that used to settle onto the picture is gone, at Julian's ask.

              Never taller than the screen it pins on. A portrait cover at
              half the column ran to 825px on a 900px window, so the scroll
              read as three moves: the head leaving, the panel pinning with
              its foot cut off, the panel letting go at the end. Julian
              called it jarring. The width is capped so the cover's own
              aspect fits under the bar with room to spare, and the pinned
              state is a picture sitting still, whole. */}
          <div
            className="relative overflow-hidden"
            data-hover={hovering ? "" : undefined}
            style={
              preview
                ? {
                    /* As wide as the block's height allows for this
                       cover's shape, and no wider than the column: full
                       height on most screens, never cropped. */
                    maxWidth: `min(100%, calc((100dvh - var(--block-top) - 1.5rem) * ${preview.cover.width} / ${preview.cover.height}))`,
                  }
                : undefined
            }
          >
            <div className="transition-transform duration-500 ease-[var(--ease-out-strong)] in-data-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:in-data-hover:scale-100">
              {preview ? (
                <div
                  key={preview.slug}
                  className="relative overflow-hidden"
                  style={{
                    backgroundColor: preview.cover.color,
                    aspectRatio: `${preview.cover.width} / ${preview.cover.height}`,
                  }}
                >
                  <Travels on={wide} slug={preview.slug}>
                    <Image
                      placeholder={preview.cover.blur ? "blur" : "empty"}
                      blurDataURL={preview.cover.blur}
                      src={preview.cover.src}
                      alt=""
                      width={preview.cover.width}
                      height={preview.cover.height}
                      sizes="50vw"
                      priority
                      // `key` on the wrapper remounts this on every change, so the
                      // fade runs from the start each time rather than retargeting
                      // a transition that is already at its end.
                      className="h-full w-full object-cover animate-in fade-in duration-300 ease-[var(--ease-out-strong)] motion-reduce:animate-none"
                    />
                  </Travels>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          ref={listColumn}
          className="list-scroll lg:h-full lg:w-1/2 lg:min-w-0 lg:overflow-y-auto"
        >
          <ol
            onPointerEnter={() => setHovering(true)}
            onPointerLeave={() => setHovering(false)}
          >
            {projects.map((project, i) => {
              return (
                <li
                  key={project.slug}
                  // Stepped for the first eight rows and flat after: that is
                  // about what fits above the fold, and a stagger that runs
                  // to seventy rows is a queue, not a gesture.
                  className="rise"
                  style={
                    {
                      "--reveal-delay": `${Math.min(i, 8) * 40}ms`,
                    } as React.CSSProperties
                  }
                >
                  <Link
                    prefetch={false}
                    href={`/work/${project.slug}`}
                    // Focus updates the panel too, so a keyboard visitor sees
                    // exactly what a pointer visitor sees. Without this the
                    // panel would sit on whatever was hovered last.
                    onPointerEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onClick={() => {
                      lastLeft = project.slug;
                    }}
                    className={cn(
                      "group relative block border-b border-border py-5 transition-colors duration-200",
                      "hoverable:hover:border-foreground/30",
                    )}
                  >
                    {/* The row's ground under a pointer: a soft rounded box
                        a little wider than the row, in the page's own ink
                        at 6%, so it reads as light on the dark theme and as
                        a shade on the light one. Behind the words, and the
                        hairline stays straight. Julian's ask. */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -inset-x-4 inset-y-2 -z-10 rounded-[14px] bg-foreground/[0.06] opacity-0 transition-opacity duration-200 ease-[var(--ease-out-strong)] hoverable:group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                    {/* Touch screens have no pointer to follow, so the frame
                        comes to the row. Lazy and display:none above `lg`, so a
                        desktop visit does not pay for seventy of these. */}
                    <div
                      className="relative mb-4 overflow-hidden lg:hidden"
                      style={{
                        backgroundColor: project.cover.color,
                        aspectRatio: `${project.cover.width} / ${project.cover.height}`,
                      }}
                    >
                      {/* Named below `lg`, where this is the cover on screen; above it the
                          panel's copy is the one that travels. See `Travels`. */}
                      <Travels on={!wide} slug={project.slug}>
                        <Image
                          placeholder={project.cover.blur ? "blur" : "empty"}
                          blurDataURL={project.cover.blur}
                          data-fade=""
                          src={project.cover.src}
                          alt={project.cover.alt || project.name}
                          width={project.cover.width}
                          height={project.cover.height}
                          sizes="100vw"
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </Travels>
                    </div>

                    <div className="flex items-baseline justify-between gap-6">
                      <h2 className="font-display text-xl leading-tight sm:text-2xl">
                        {project.name}
                      </h2>
                      <span className="label shrink-0 text-muted-foreground">
                        {project.credit}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}

            {projects.length === 0 ? (
              <li className="py-10 text-sm text-muted-foreground">
                Nothing filed under that yet.
              </li>
            ) : null}
          </ol>
        </div>
      </div>
    </>
  );
}
