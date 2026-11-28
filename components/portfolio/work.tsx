"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import type { Flip as FlipT } from "gsap/Flip";
import { loadFlip } from "@/lib/motion/gsap-lazy";
import { PageFoot } from "@/components/site/foot";
import DISC from "@/lib/work/discipline-order.json";
import { Drift } from "@/components/portfolio/drift";
import { useColorScope, type PickAt } from "@/components/portfolio/use-color-scope";
import { useStripScroll } from "@/components/portfolio/use-strip-scroll";
// The canvas view loads only when it opens, not with every /portfolio visit.
const WorkCanvas = dynamic(() => import("@/components/portfolio/canvas").then((m) => m.WorkCanvas), { ssr: false });
import { projectHref } from "@/lib/work/project-href";
import { Cap, STRIP_SIZES, Tile, altOf, named, workItem, type WorkItem, type WorkPayload } from "@/components/portfolio/work-tiles";
import { FrameTile, FrameView, type FrameItem } from "@/components/portfolio/frame-view";
import { useScopeDraw } from "@/components/portfolio/use-scope-draw";
import { useHeaderSearch } from "@/components/portfolio/use-header-search";
import { useCoverPreload } from "@/components/portfolio/use-cover-preload";
import { CROSS, LOUPE, SearchField, Views } from "@/components/portfolio/work-tools";

// project-viewer.tsx loads the viewer from here.
export { FrameView };

/* JG V3 Portfolio (/portfolio): search, discipline chips, and the
   Grid, Strip and Color views. Best first (lib's order: the vectorscope's
   DOPE list, then the site's running order). */

const plural = (n: number) => `${n} ${n === 1 ? "project" : "projects"}`;

/** The covers on screen, for the view change below. */
const seen = () =>
  [...document.querySelectorAll<HTMLElement>("#p-work [data-flip-id]")].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  });

/** Writes or clears `?view=canvas` on the address in place, with no new history entry. */
const viewUrl = (canvas: boolean) => {
  const u = new URL(location.href);
  if (canvas) u.searchParams.set("view", "canvas");
  else u.searchParams.delete("view");
  if (u.href !== location.href) history.replaceState(null, "", u);
};

/** Writes or clears `?d=<slug>` in place: Back from a project, or a reload, lands on the same filter. */
const filterUrl = (slug?: string) => {
  const u = new URL(location.href);
  if (slug) u.searchParams.set("d", slug);
  else u.searchParams.delete("d");
  if (u.href !== location.href) history.replaceState(history.state, "", u);
};

export function WorkIndex({
  work: payload,
  chip = {},
  frames = {},
}: {
  work: WorkPayload[];
  chip?: Record<string, string>;
  frames?: Record<string, FrameItem[]>;
}) {
  /* The payload's one-letter keys as names, once: everything below reads `WorkItem`. */
  const work = React.useMemo(() => payload.map(workItem), [payload]);
  const [filter, setFilter] = React.useState("All");
  const [at, setAt] = React.useState<number | null>(null);
  const closeView = React.useCallback(() => setAt(null), []);
  /* `?d=<slug>`: the retired discipline pages and the site's links land here
     with that chip on. Read after mount, so the page itself stays static. */
  React.useEffect(() => {
    const d = chip[new URLSearchParams(location.search).get("d") ?? ""];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d) setFilter(d);
  }, [chip]);
  const [view, setView] = React.useState<"grid" | "strip" | "color">("grid");
  const [back, setBack] = React.useState<"grid" | "strip">("grid");
  /* The canvas lies over whichever view is on, under the page's own title and
     toolbar, which stay where they are: leaving it lands
     where you were. `?view=canvas` opens on it. The address carries it while
     the canvas is on, so Back from a project it opened lands on the canvas again.
     `leaving` keeps it up for its fade out; `cvTop` is the toolbar's lower edge,
     where the canvas starts. */
  const [canvas, setCanvas] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [cvTop, setCvTop] = React.useState(0);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (new URLSearchParams(location.search).get("view") === "canvas") setCanvas(true);
  }, []);
  const closeCanvas = React.useCallback(() => {
    viewUrl(false);
    setCanvas(false);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLeaving(true);
  }, []);
  // An effect, so unmounting mid-fade clears the timer.
  React.useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(false), 260);
    return () => clearTimeout(t);
  }, [leaving]);
  /* The toolbar only sits in its usual place at the top of the page, so the
     canvas opens there, and starts under the toolbar's last row. */
  React.useEffect(() => {
    if (!canvas) return;
    scrollTo(0, 0);
    const measure = () => {
      const bar = document.querySelector("#p-work .whead")?.getBoundingClientRect();
      const row = document.querySelector("#p-work .chips")?.getBoundingClientRect();
      // `.whead` is a box on desktop and `display:contents` elsewhere, where the chips are the last row.
      setCvTop(Math.round(bar?.height ? bar.bottom : (row?.bottom ?? 0) + 12));
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [canvas, filter]);
  // Open project: the canvas comes down, the address keeps `?view=canvas` for Back.
  const leaveCanvas = React.useCallback(() => setCanvas(false), []);
  /* Grid, strip and color views, and the discipline chips: the covers on
     screen fly from where they were to where they land, new ones fade in
     (GSAP Flip). */
  const flip = React.useRef<ReturnType<typeof FlipT.getState> | null>(null);
  const Flip = React.useRef<typeof FlipT | null>(null);
  React.useEffect(() => {
    void loadFlip().then((F) => {
      Flip.current = F;
    });
  }, []);
  const flipAt = React.useRef(0); // the page's scroll when the covers were read
  const gridWas = React.useRef<{ el: HTMLElement; r: DOMRect } | null>(null); // and the grid they sat in, for the ones that leave
  /* A chip or a view button answers the click first: `next` is what the visitor picked, painted on the control in this
     frame. The grid is rebuilt two frames later; the click used to hold the page still for 0.4 to 0.8s with nothing
     changed. Not a React transition: under the page boundary that starts a view transition, a page slide on a chip. `next` clears in the same commit as the grid. */
  const [next, setNext] = React.useState<{ filter?: string; view?: "grid" | "strip" | "color" } | null>(null);
  const flipped = (pick: NonNullable<typeof next>, set: () => void) => {
    setNext((n) => ({ ...n, ...pick }));
    // Two frames: the first paints the control. One was not enough, React could commit the grid before that frame was shown.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (Flip.current && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const els = seen();
          flip.current = Flip.current.getState(els);
          flipAt.current = scrollY;
          const el = document.querySelector<HTMLElement>("#p-work .wgrid:not(.wghost)");
          gridWas.current = el && { el, r: el.getBoundingClientRect() };
        }
        set();
        setNext(null);
      }),
    );
  };
  const go = (v: typeof view | "canvas") => {
    if (v === "canvas") {
      viewUrl(true);
      setCanvas(true);
    } else if (canvas) {
      closeCanvas();
      setView(v);
    } else flipped({ view: v }, () => setView(v));
  };
  const {
    raw,
    setRaw,
    q,
    rowOn,
    setRowOn,
    unfold,
    setUnfold,
    setTools,
    pin,
    hs,
    setHs,
    refocus: refocusRef,
    close,
  } = useHeaderSearch(canvas, at);
  const [pick, setPick] = React.useState<PickAt | null>(null);
  const page = React.useRef<HTMLElement>(null);
  const strip = React.useRef<HTMLDivElement>(null);
  const lastView = React.useRef(view);
  React.useLayoutEffect(() => {
    const st = flip.current,
      F = Flip.current;
    const swap = lastView.current !== view;
    lastView.current = view;
    if (!st || !F) return;
    flip.current = null;
    const w = strip.current;
    if (w) w.style.overflow = "visible"; // the strip would clip covers flying up into it
    /* A chip in the grid. What leaves is put back where it stood, in a layer of its own, and fades out; React has
       dropped those nodes, so they are free to move. They used to be cut, which left holes.
       - Covers that leave while others stay: each fades out in its place (150).
       - A grid replaced whole (a gallery chip to or from the projects, no cover in common): a plain crossfade, the
         old grid out (250) as the new covers come in (250). */
    const was = swap ? null : gridWas.current;
    gridWas.current = null;
    const here = new Set([...document.querySelectorAll<HTMLElement>("#p-work [data-flip-id]")].map((e) => e.dataset.flipId));
    const gone = st.elementStates.filter((s) => !s.element.isConnected && !here.has(s.id));
    const whole = !!was && !was.el.isConnected;
    /* Covers that stay and land on screen. From a small chip (Chroma) to All they land further down the page: with
       nothing travelling in view, new covers that waited left the grid empty for 120ms (JG - MAC). */
    const travels =
      !whole &&
      st.elementStates.some((s) => {
        if (!s.element.isConnected) return false;
        const r = s.element.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight;
      });
    const sec = page.current;
    let ghost: HTMLDivElement | null = null;
    if (sec && was && (whole || gone.length)) {
      const g = (ghost = document.createElement("div"));
      g.className = whole ? "wghost" : `wghost ${was.el.className}`;
      g.inert = true; // fading out: not for the keyboard or a screen reader
      g.setAttribute("aria-hidden", "true");
      sec.prepend(g);
      const o = g.getBoundingClientRect();
      const dy = flipAt.current - scrollY;
      const put = (e: HTMLElement, r: DOMRect, more: string) => {
        e.style.cssText = `position:absolute;margin:0;left:${r.left - o.left}px;top:${r.top - o.top + dy}px;width:${r.width}px;${more}`;
        g.append(e);
      };
      if (whole) put(was.el, was.r, `height:${was.r.height}px`);
      else
        for (const s of gone) {
          let e = s.element as HTMLElement; // the tile: the top of what React took out
          while (e.parentElement) e = e.parentElement;
          put(e, s.bounds, "");
        }
      g.querySelectorAll("[data-flip-id]").forEach((e) => e.removeAttribute("data-flip-id"));
      void g
        .animate({ opacity: [1, 0] }, { duration: whole ? 250 : 150, easing: "cubic-bezier(.23,1,.32,1)", fill: "forwards" })
        .finished.then(
          () => g.remove(),
          () => g.remove(),
        );
    }
    /* Motion plan item 9 (docs/decisions.md): grid and strip trade places as
       one move, photo 600 on `move`, no stagger, new covers fade in 250, in
       both directions; a chip slides the tiles to their new places, page 400
       on `move`. */
    const tl = F.from(st, {
      targets: seen(),
      duration: swap ? 0.6 : 0.4,
      ease: "power3.inOut",
      scale: true,
      zIndex: 1, // a cover on its way passes over the ones arriving, not under them
      paused: true,
      // The vectorscope (Color view) opens 40ms apart, the seventh on together.
      stagger: swap && view === "color" ? (i: number) => Math.min(i, 5) * 0.04 : 0,
      // New covers wait 120ms while covers still travel in view, so they do not land on one that has not left its place yet.
      onEnter: (els) =>
        els.forEach((e) =>
          e.animate(
            { opacity: [0, 1] },
            { duration: 250, delay: travels ? 120 : 0, fill: "backwards", easing: "cubic-bezier(.23,1,.32,1)" },
          ),
        ),
      onComplete: () => {
        if (w) w.style.overflow = "";
      },
    });
    /* Started two frames after the commit: the frame that builds the new grid is a long one, and a timeline started
       inside it had run a third of its way before anything was drawn. */
    let raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => tl.play())));
    return () => {
      cancelAnimationFrame(raf);
      tl.progress(1);
      ghost?.remove();
    };
  }, [view, filter]);
  const bar = React.useRef<HTMLDivElement>(null);
  const chips = React.useRef<HTMLDivElement>(null);
  const chipsBar = React.useRef<HTMLDivElement>(null);
  const cv = React.useRef<HTMLCanvasElement>(null);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of work) for (const d of p.disciplines) c[d] = (c[d] ?? 0) + 1;
    return c;
  }, [work]);
  const order = React.useMemo(
    /* Julian's order from the Work Order page, then any new discipline by count. */
    () => {
      const rank = (d: string) => DISC.indexOf(d) + 1 || DISC.length + 1;
      return Object.keys(counts).sort((a, b) => rank(a) - rank(b) || counts[b] - counts[a]);
    },
    [counts],
  );
  const list = React.useMemo(
    () =>
      work.filter(
        (p) =>
          (filter === "All" || p.disciplines.includes(filter)) &&
          (!q || `${p.name} ${p.disciplines.join(" ")} ${p.credits}`.toLowerCase().includes(q)),
      ),
    [work, filter, q],
  );
  /* The canvas always shows every frame: a chip or a
     search sorts its projects to the front, the rest follow. */
  const field = React.useMemo(() => [...list, ...work.filter((p) => !list.includes(p))], [list, work]);
  /* A gallery chip with no search shows its frames, not its one cover. */
  const shown = !q ? frames[filter] : undefined;
  /* The strip runs a gallery out too: its chip shows every frame, and under
     All a gallery's project opens into its frames where it sits, its caption
     on the first. Cover Art stays one cell under All. */
  const cells = React.useMemo(
    (): ({ f: FrameItem; p?: WorkItem } | { f?: undefined; p: WorkItem })[] =>
      shown
        ? shown.map((f) => ({ f }))
        : list.flatMap((p): ({ f: FrameItem; p?: WorkItem } | { f?: undefined; p: WorkItem })[] => {
            const g = p.disciplines.find((d) => d !== "Cover Art" && frames[d]);
            const own = g ? frames[g].filter((f) => f.s === p.slug) : [];
            return own.length ? own.map((f, i) => ({ f, p: i ? undefined : p })) : [{ p }];
          }),
    [shown, list, frames],
  );
  const stripFrames = React.useMemo(() => cells.flatMap((c) => (c.f ? [c.f] : [])), [cells]);
  const warm = useCoverPreload(view, list, cells, shown, strip);

  const { scope, scoreSet } = useColorScope(view, pick);
  const res =
    view === "color" && pick
      ? list
          .map((p) => [p, scoreSet(p.slug)] as const)
          .filter(([, sc]) => sc > 0.12)
          .sort((a, b) => b[1] - a[1])
          .map(([p]) => p)
      : list;

  const pickAt = useScopeDraw(view, list, scope, pick, setPick, cv);

  /* Strip: the progress bar follows the rail. */
  const stripBar = React.useCallback(() => {
    const s = strip.current,
      b = bar.current?.firstElementChild as HTMLElement | null;
    if (!s || !b) return;
    const m = s.scrollWidth - s.clientWidth;
    b.style.transform = `scaleX(${m > 0 ? s.scrollLeft / m : 1})`; // a scale, not a width: no layout per scroll frame
  }, []);
  useStripScroll(view, cells, strip, stripBar);

  /* Chips: one row at every width, a fade on the cut chip, and a progress
     line up to tablets. */
  const syncChips = React.useCallback(() => {
    const c = chips.current,
      i = chipsBar.current?.firstElementChild as HTMLElement | null;
    if (!c || !i) return;
    const m = c.scrollWidth - c.clientWidth,
      f = m > 0 ? c.scrollLeft / m : 1,
      vis = m > 0 ? c.clientWidth / c.scrollWidth : 1;
    i.style.width = `${vis * 100}%`;
    i.style.marginLeft = `${f * (1 - vis) * 100}%`;
    c.classList.toggle("at-end", f > 0.98);
  }, []);
  React.useEffect(() => {
    syncChips();
    addEventListener("resize", syncChips);
    /* A mouse wheel has no sideways motion: over the row it scrolls the
       chips until they run out, then the page again. */
    const c = chips.current;
    const wheel = (e: WheelEvent) => {
      if (!c || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const m = c.scrollWidth - c.clientWidth;
      if (e.deltaY > 0 ? c.scrollLeft >= m - 1 : c.scrollLeft <= 0) return;
      e.preventDefault();
      c.scrollLeft += e.deltaY;
    };
    c?.addEventListener("wheel", wheel, { passive: false });
    return () => {
      removeEventListener("resize", syncChips);
      c?.removeEventListener("wheel", wheel);
    };
  }, [syncChips]);

  const viewOn = next?.view ?? view; // what the buttons show: the pick, then the view once it is up
  const filterOn = next?.filter ?? filter;
  const rep = canvas ? "canvas" : viewOn === "color" ? back : viewOn;
  const fold = (act: () => void) => {
    if (!unfold && matchMedia("(max-width: 700px)").matches) return setUnfold(true);
    act();
    setUnfold(false);
  };
  const searchField = (head: boolean) => <SearchField head={head} raw={raw} setRaw={setRaw} setRowOn={setRowOn} close={close} />;
  const views = (
    <Views canvas={canvas} view={viewOn} back={back} setBack={setBack} go={go} unfold={unfold} fold={fold} rep={rep} warm={warm} />
  );

  return (
    <div className="v3 contents">
      <Drift k={`${view}|${filter}|${q}|${list.length}`} />
      <section
        ref={page}
        className={
          (view === "strip" ? "v3page strip-on" : view === "color" ? "v3page color-on" : "v3page") +
          // Canvas on: everything under the toolbar hides once the canvas has faded in over it.
          (canvas ? " cv-on" : "")
        }
        id="p-work"
      >
        <div className="pg-head">
          <h1 className="pg-t">{filter === "All" ? "Portfolio" : filter}</h1>
        </div>
        {/* One sticky glass bar on desktop; display:contents elsewhere. */}
        <div className="whead">
          <div className={rowOn ? "wtools lbl on" : "wtools lbl"} ref={setTools}>
            {searchField(false)}
            {views}
            {/* Touch only (v3.css): closes the search, as Cancel does on iOS. */}
            <button
              type="button"
              className="wclose"
              aria-label="Close search"
              tabIndex={rowOn ? 0 : -1}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                setRaw("");
                (document.activeElement as HTMLElement | null)?.blur();
                setRowOn(false);
              }}
            >
              {CROSS}
            </button>
          </div>
          <div className="chips lbl" ref={chips} role="group" aria-label="Filter by discipline" onScroll={syncChips}>
            {["All", ...order].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={d === filterOn}
                onClick={() => {
                  if (d === filterOn) return;
                  flipped({ filter: d }, () => setFilter(d));
                  filterUrl(Object.keys(chip).find((k) => chip[k] === d));
                }}
              >
                {d}
                {/* The count only on the chip that is on (Julian). */}
                {d === filterOn && (d === "All" || counts[d] > 1) ? <span>{d === "All" ? work.length : counts[d]}</span> : null}
              </button>
            ))}
          </div>
          <div className="chips-bar" ref={chipsBar}>
            <i />
          </div>
        </div>
        <p className="wnote lbl mute" aria-live="polite">
          {q ? `${plural(list.length)} matching “${q}”` : shown ? `${shown.length} frames` : plural(list.length)}
        </p>
        {q && !list.length ? <p className="wnone mute">Nothing matches that search yet.</p> : null}
        {view === "grid" && shown ? (
          <div className={shown.every((f) => f.sq) ? "wgrid wframes square" : "wgrid wframes"}>
            {shown.map((f, n) => (
              <FrameTile key={f.src} f={f} first={n < 12} onOpen={() => setAt(n)} />
            ))}
          </div>
        ) : null}
        {view === "strip" ? (
          <FrameView list={stripFrames} at={at} onGo={setAt} onClose={closeView} />
        ) : shown ? (
          <FrameView list={shown} at={at} onGo={setAt} onClose={closeView} />
        ) : null}
        {view === "grid" && !shown ? (
          <div className="wgrid">
            {list.map((p, n) => (
              <Tile key={p.slug} p={p} first={n < 12} />
            ))}
          </div>
        ) : null}
        {view === "strip" ? (
          <>
            {/* A new chip starts its own strip at the start: the frames it shares with All kept the old scroll. */}
            <div className="wstrip" key={filter} ref={strip} onScroll={stripBar}>
              {cells.map(({ f, p }, n) => {
                /* Name, then discipline, both on the photo, as in the grid. */
                const cap = p ? <Cap p={p} cls="sc-n" /> : null;
                if (!f)
                  return (
                    <figure key={p.slug} className="sc" data-flip-id={p.slug}>
                      <Link href={projectHref(p.slug)} aria-label={named(p)}>
                        <Image src={p.cover} alt={altOf(p)} fill sizes={STRIP_SIZES} decoding="sync" loading={n < 4 ? "eager" : "lazy"} />
                        {cap}
                      </Link>
                    </figure>
                  );
                const i = stripFrames.indexOf(f);
                return (
                  <figure key={f.src} className={f.wide ? "sc wide" : f.sq ? "sc sq" : "sc"} data-flip-id={f.src}>
                    {/* Opens full size, as in the grid. */}
                    <a
                      href={f.src}
                      onClick={(e) => {
                        e.preventDefault();
                        setAt(i);
                      }}
                    >
                      <Image src={f.src} alt={f.alt} fill sizes={STRIP_SIZES} loading={n < 4 ? "eager" : "lazy"} />
                      {/* Hover shows the back. The strip swipes sideways, so no label
                          here: the viewer's bar has the switch. */}
                      {f.back ? <Image className="bk" src={f.back.src} alt="" fill sizes={STRIP_SIZES} loading="lazy" /> : null}
                      {cap}
                    </a>
                  </figure>
                );
              })}
            </div>
            <div className="wbar" ref={bar}>
              <i />
            </div>
          </>
        ) : null}
        {view === "color" ? (
          <div className="wscope">
            <div className="sc-panel">
              <div className="sc-head lbl">
                <span>Color</span>
                <button type="button" className="sc-x mute" hidden={!pick} onClick={() => setPick(null)}>
                  All the work
                </button>
              </div>
              <canvas ref={cv} aria-label="Vectorscope of every cover. Click a color to find it in the work." onClick={pickAt} />
              <p className="lbl mute">{pick ? `${plural(res.length)} in this color` : "All the work, strongest light first"}</p>
              <p className="sc-tip">Click the scope to find a color in the work. Click the point again to let it go.</p>
            </div>
            <div className="sc-res">
              {res.slice(0, 8).map((p) => (
                <Tile key={p.slug} p={p} swatch={scope?.[p.slug]?.w} />
              ))}
              {!res.length ? <p className="mute">Nothing in this color yet.</p> : null}
            </div>
          </div>
        ) : null}
        {pin &&
          document.getElementById("hdr-tools") &&
          createPortal(
            <div className={hs ? "htools lbl open" : "htools lbl"}>
              {hs ? (
                <>
                  {searchField(true)}
                  <button type="button" className="hbtn" aria-label="Close search" onClick={close}>
                    {CROSS}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="hbtn"
                  ref={(el) => {
                    if (el && refocusRef.current) {
                      refocusRef.current = false;
                      el.focus();
                    }
                  }}
                  aria-expanded={false}
                  data-on={q ? "" : undefined}
                  aria-label={q ? `Search the work, showing matches for ${q}` : "Search the work"}
                  title="Search the work"
                  onClick={() => setHs(true)}
                >
                  {LOUPE}
                </button>
              )}
              {views}
            </div>,
            document.getElementById("hdr-tools")!,
          )}
        {canvas || leaving
          ? createPortal(
              <div className="v3">
                <WorkCanvas list={field} onClose={closeCanvas} onLeave={leaveCanvas} out={leaving} top={cvTop} />
              </div>,
              document.body,
            )
          : null}
        <PageFoot />
      </section>
    </div>
  );
}
