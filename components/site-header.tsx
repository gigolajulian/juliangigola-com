"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

/* ── the chrome ───────────────────────────────────────────────────
 * Four destinations, no dropdowns.
 *
 * The old site had three hover menus over thirteen pages, which meant a
 * visitor had to guess whether cover art filed under "work" or "music" before
 * they could look at anything. The categories still exist — they just live
 * inside /work as filters, where they cost nothing to ignore.
 *
 * The bar has no ground of its own until the page moves. At rest it is type
 * on the photograph, which is what a full-bleed cover is for; on the first
 * few pixels of scroll a surface arrives under it — the ground at 72% behind
 * a heavy blur, closed with a hairline — so it belongs to the page rather
 * than floating over it, and the work still shows through.
 *
 * This replaced a permanent downward gradient: a black wash over the top of
 * every page so that pale type would always land on something dark. It
 * worked, and it looked like a fix.
 *
 * The one exception is the wordmark on the homepage. The cover already sets
 * his name as a masthead, so printing it again 40px above reads as a mistake.
 * It waits until the masthead has scrolled away and then takes over.
 * ─────────────────────────────────────────────────────────────── */

const LINKS = [
  { href: "/work", label: "Work" },
  { href: "/sessions", label: "Sessions" },
  { href: "/studio", label: "Studio" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [routeWhenOpened, setRouteWhenOpened] = React.useState(pathname);

  // Client-side navigation does not unmount the header, so the panel would
  // otherwise stay open behind the new page — after a tap, and after a back
  // button too. Adjusting during render rather than in an effect closes it in
  // the same commit as the new route, so the panel never paints over it.
  if (routeWhenOpened !== pathname) {
    setRouteWhenOpened(pathname);
    setOpen(false);
  }

  // A fullscreen panel over a scrollable gallery scrolls the page behind it.
  React.useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /**
   * Whether the page has moved at all.
   *
   * The bar used to sit on a downward gradient — a black wash over the top
   * of every page, permanently, so that white type would land on something
   * dark whatever was underneath. It worked, and it looked like a fix.
   *
   * Nothing over the cover instead: at rest the chrome is only type on the
   * photograph, which is what a full-bleed cover is for. The moment the page
   * moves, a real surface arrives under it — the ground at 72% with a heavy
   * blur behind it and a hairline along the bottom, so the bar belongs to the
   * page rather than floating above it, and the work keeps showing through.
   */
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        // A few pixels, not a threshold: the surface should arrive as soon as
        // anything has moved, not at some invisible line down the page.
        setScrolled(window.scrollY > 8);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  /* The handoff, on the homepage only.

     The masthead in the cover and this wordmark are the same name in the
     same face sharing a left edge, so this one waits until that one has
     gone by rather than printing it twice on the first screen. It used to
     be measured against the scroll; the homepage is a strip now and does
     not scroll at all, so the moment is the same one every strip page
     uses — the opening cell half gone — and CSS does the whole thing off
     the attribute the strip sets. See `.home-wordmark` in `globals.css`. */
  const deferWordmark = pathname === "/";

  const isCurrent = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header
      /* Whether the bar has a ground of its own.
       *
       * False means it is transparent and sitting directly on whatever is
       * behind it — which on the homepage is a photograph. `globals.css` uses
       * this together with the cover tone the hero publishes to re-ink the
       * bar over a pale frame.
       *
       * The menu counts as having a ground even though the bar itself is
       * transparent then: the panel behind it is a full-screen
       * `bg-background`, so the type is over the page colour and wants the
       * page's own ink. */
      data-plain={scrolled || open ? "true" : "false"}
      className={cn(
        "fixed inset-x-0 top-0 z-40",
        // Border and background rather than a gradient, and both animate from
        // nothing. `border-b` is always present and only its colour changes,
        // so the rule fading in never moves the bar by a pixel.
        "border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        "ease-[var(--ease-out-strong)] motion-reduce:transition-none",
        scrolled
          ? "glass-surface border-border bg-background/72"
          : "border-transparent bg-transparent",
        // The panel is its own full-screen surface; a blurred bar on top of
        // it reads as a seam across the menu.
        open && "border-transparent bg-transparent backdrop-blur-none",
      )}
    >
      <div className="relative mx-auto flex max-w-[100rem] items-center justify-between px-6 py-3 max-sm:py-2 sm:px-10 sm:py-4 tablet:py-2 lying:py-1.5">
        <Link
          href="/"
          // On the homepage the name is a way back to the top, not a reload.
          // Julian asked: a click there used to re-request `/`, which
          // restarted the cover and threw away the scroll. Smooth unless the
          // visitor has asked for reduced motion, in which case it jumps.
          // Any other route still navigates home, and a modifier key still
          // opens a new tab.
          onClick={(e) => {
            if (pathname !== "/") return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            /* The homepage is a strip: its top is the left edge of a box
               that never scrolls the document, so the name asks the strip
               to travel there and it glides under its own friction. The
               scroll below is for the phone, where the same cells are
               stacked and the page is the scroll. Whichever of the two is
               not the case does nothing. */
            document
              .querySelector(".strip-scroll")
              ?.dispatchEvent(new Event("jg:home"));
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
            });
          }}
          // Caps, because that is what a bold condensed grotesque is for —
          // and it is how the wordmark has always been set. A little tracking
          // stops the condensed forms from fusing at small sizes.
          //
          // Faded rather than unmounted, so it stays in the accessibility
          // tree and the tab order throughout — the route home must not
          // vanish just because the page is scrolled to the top. Tabbing to
          // it brings it back into view, so it is never an invisible focus
          // target.
          className={cn(
            "font-display text-lg uppercase leading-none tracking-[0] sm:text-2xl lying:text-lg",
            // Scaling from the left edge, because that edge is shared with
            // the masthead — growing from the centre would slide the name
            // sideways out of the alignment the handoff depends on.
            "origin-left will-change-[transform,opacity]",
            "transition-opacity duration-300 ease-[var(--ease-out-strong)] hoverable:hover:opacity-70",
            "focus-visible:opacity-100",
            // Deferring only makes sense where the masthead is actually
            // beside it. Below `lg` the cover stacks, so the masthead sits
            // under a half-screen photograph — hiding the wordmark there
            // leaves the header with nothing but a burger and no name on
            // screen at all.
            //
            // `pointer-events-none` while faded, because opacity alone hides
            // a link from the eye and not from the mouse. Measured on the
            // live homepage at scroll 0: a 214x32 invisible anchor to `/`
            // over the top-left of the cover photograph, so clicking that
            // patch of picture reloaded the homepage and restarted the
            // cover. Keyboard access is untouched — pointer-events does not
            // affect the tab order, and `focus-visible:opacity-100` above
            // still brings it back into view when tabbed to.
            deferWordmark && "home-wordmark",
          )}
        >
          Julian Gigola
        </Link>

        {/* The right-hand group. Grouping these rather than leaving them as
            separate children of a `justify-between` row is what keeps the
            nav pinned right instead of drifting to the middle once a third
            item joins it. */}
        <div className="flex items-center gap-1 lg:gap-8">
          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-9">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <NavLink href={link.href} current={isCurrent(link.href)}>
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Outside the nav, at every width. It is not a destination — it
              changes how the page looks rather than going anywhere — and on
              a phone it has to be reachable without opening the menu first,
              which is why it sits beside the burger rather than inside it.
              `-mr-2` pulls the 44px target's padding back so the artwork
              lines up with the margin, not the hit area. */}
          <ThemeToggle className="-mr-2 lg:mr-0" />

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            // 44px square: this is a thumb target, so it gets a real hit area
            // rather than the icon's own 24x16.
            className="-mr-2 flex h-11 w-11 items-center justify-center press active:scale-[0.94] lg:hidden"
          >
            {/* The label an icon cannot carry. */}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>

            {/* Three bars that morph into a cross rather than being swapped for
              one. The middle bar fades while the outer two rotate onto the
              centre line, so the control stays the same object through the
              change — a straight icon swap reads as two different buttons.

              Every bar is centred and moved with `translateY`, so only
              transform and opacity animate and nothing touches layout. */}
            <span aria-hidden className="relative block h-4 w-6">
              {/* The outer bars are placed with `top`/`bottom` and carry no
                base translate, so the only transform on them is the one that
                animates. Giving one element two `translate-y` utilities makes
                them fight — the later simply overrides the earlier, which
                collapses the three bars into two. */}
              <span
                className={cn(
                  "absolute left-0 top-0 h-[1.5px] w-full bg-current",
                  "transition-transform duration-300 ease-[var(--ease-out-strong)] motion-reduce:transition-none",
                  open
                    ? "translate-y-[7.25px] rotate-45"
                    : "translate-y-0 rotate-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 bg-current",
                  "transition-opacity duration-200 ease-out motion-reduce:transition-none",
                  open ? "opacity-0" : "opacity-100",
                )}
              />
              <span
                className={cn(
                  "absolute bottom-0 left-0 h-[1.5px] w-full bg-current",
                  "transition-transform duration-300 ease-[var(--ease-out-strong)] motion-reduce:transition-none",
                  open
                    ? "-translate-y-[7.25px] -rotate-45"
                    : "translate-y-0 rotate-0",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Rendered always, toggled with `hidden`, so the links are in the DOM
          for crawlers and the panel does not animate from nothing. */}
      <div
        id="mobile-nav"
        hidden={!open}
        // The ground fades in, and leaves the way the items came: a fade and
        // a few pixels down, so closing reads as the menu going back where it
        // rose from rather than being switched off. `display` is in the
        // transition with `allow-discrete`, which is what lets the `hidden`
        // attribute wait for the fade before it takes the panel out of the
        // page; browsers without it cut, which is what it did before.
        className={cn(
          "fixed inset-0 -z-10 flex flex-col justify-center bg-background px-6 pb-20 lg:hidden",
          "transition-[opacity,transform,display] transition-discrete duration-150 ease-[var(--ease-out-strong)]",
          "starting:opacity-0 [&[hidden]]:translate-y-2 [&[hidden]]:opacity-0",
          "motion-reduce:transition-none",
        )}
      >
        <nav aria-label="Menu">
          <ul className="flex flex-col gap-1 pl-4">
            {LINKS.map((link, i) => (
              <li key={link.href} className="relative">
                {/* The current page is marked, rather than the others being
                    dimmed. The accent is the only saturated colour on the
                    site and already means "you are here". */}
                {isCurrent(link.href) ? (
                  <span
                    aria-hidden
                    className="absolute -left-4 top-1/2 h-8 w-1 -translate-y-1/2 bg-accent"
                  />
                ) : null}
                <Link
                  href={link.href}
                  aria-current={isCurrent(link.href) ? "page" : undefined}
                  // Staggered so the list cascades in rather than landing all
                  // at once. Short delays only — 40ms a step reads as one
                  // gesture, 150ms reads as waiting.
                  style={
                    { "--reveal-delay": `${i * 40}ms` } as React.CSSProperties
                  }
                  className={cn(
                    // This is a full-screen menu, so the type is sized to the
                    // screen rather than to a nav bar — fluid, so it fills a
                    // phone and an iPad alike without a stack of breakpoints.
                    "font-display block py-2 uppercase leading-[0.95] tracking-[0]",
                    "text-[clamp(2.75rem,13vw,5.5rem)]",
                    // See `menu-in` in globals.css: the bounce, at menu speed.
                    "menu-in",
                    // Full strength, always. Dimming everything-but-current
                    // greys out the entire menu on any page that is not one of
                    // these four — the homepage included — which reads as
                    // disabled rather than as emphasis.
                    "hoverable:hover:opacity-70",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

/**
 * The underline grows from the left on hover and stays put when the link is
 * the current page. `scaleX` rather than a width or a border, so it animates
 * on the GPU and never nudges the text.
 */
function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "group relative block py-3 text-[0.9375rem] uppercase leading-none tracking-[0.08em] transition-colors duration-200",
        current
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "absolute -bottom-0.5 left-0 h-px w-full origin-left bg-current",
          "transition-transform duration-200 ease-[var(--ease-out-strong)]",
          current ? "scale-x-100" : "scale-x-0",
          // Touch devices fire hover on tap, which would leave an underline
          // stuck under whatever was last touched.
          "hoverable:group-hover:scale-x-100",
        )}
      />
    </Link>
  );
}
