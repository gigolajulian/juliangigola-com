"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/* ── the chrome ───────────────────────────────────────────────────
 * Four destinations, no dropdowns.
 *
 * The old site had three hover menus over thirteen pages, which meant a
 * visitor had to guess whether cover art filed under "work" or "music" before
 * they could look at anything. The categories still exist — they just live
 * inside /work as filters, where they cost nothing to ignore.
 *
 * The bar never gets a solid background. It sits on a downward gradient
 * instead, so it reads over a cover and over a gallery alike without logic
 * deciding when to switch — one appearance, always correct.
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

  // Only the homepage sets the name in the cover, so only the homepage has
  // anything to defer to.
  const deferWordmark = pathname === "/";
  const [pastMasthead, setPastMasthead] = React.useState(false);

  React.useEffect(() => {
    if (!deferWordmark) return;

    // Reading scroll position in a rAF keeps this off the scroll handler's
    // critical path — the listener only ever schedules, never measures.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setPastMasthead(window.scrollY > window.innerHeight * 0.5);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [deferWordmark]);

  const wordmarkVisible = !deferWordmark || pastMasthead;

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      {/* The gradient is the header's only ground. Pointer-events off so it
          never eats a click meant for the image underneath it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/95 via-background/60 to-transparent"
      />

      <div className="relative mx-auto flex max-w-[100rem] items-center justify-between px-6 py-6 sm:px-10 sm:py-7">
        <Link
          href="/"
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
            "font-display text-lg uppercase leading-none tracking-[0.05em] sm:text-2xl",
            "transition-opacity duration-300 ease-[var(--ease-out-strong)] hover:opacity-70",
            "focus-visible:opacity-100",
            // Deferring only makes sense where the masthead is actually
            // beside it. Below `lg` the cover stacks, so the masthead sits
            // under a half-screen photograph — hiding the wordmark there
            // leaves the header with nothing but a burger and no name on
            // screen at all.
            wordmarkVisible ? "opacity-100" : "opacity-0 max-lg:opacity-100",
          )}
        >
          Julian Gigola
        </Link>

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
                open ? "translate-y-[7.25px] rotate-45" : "translate-y-0 rotate-0",
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
                open ? "-translate-y-[7.25px] -rotate-45" : "translate-y-0 rotate-0",
              )}
            />
          </span>
        </button>
      </div>

      {/* Rendered always, toggled with `hidden`, so the links are in the DOM
          for crawlers and the panel does not animate from nothing. */}
      <div
        id="mobile-nav"
        hidden={!open}
        // The ground fades; the items spring in over it. Toggling `hidden`
        // takes the element through `display: none`, which restarts both
        // animations, so the menu replays every time it opens.
        className="fixed inset-0 -z-10 flex flex-col justify-center bg-background px-6 pb-20 animate-in fade-in duration-200 ease-out motion-reduce:animate-none lg:hidden"
      >
        <nav aria-label="Main">
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
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={cn(
                    // This is a full-screen menu, so the type is sized to the
                    // screen rather than to a nav bar — fluid, so it fills a
                    // phone and an iPad alike without a stack of breakpoints.
                    "font-display block py-2 uppercase leading-[0.95] tracking-[0.01em]",
                    "text-[clamp(2.75rem,13vw,5.5rem)]",
                    // On the bounce curve, and far enough to see it land. A
                    // menu is opened a handful of times a session, which is
                    // exactly where a spring is worth spending: often enough
                    // to be noticed, rare enough that it never wears out.
                    "animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both",
                    "ease-[var(--ease-bounce)]",
                    "motion-reduce:animate-none",
                    // Full strength, always. Dimming everything-but-current
                    // greys out the entire menu on any page that is not one of
                    // these four — the homepage included — which reads as
                    // disabled rather than as emphasis.
                    "transition-opacity hoverable:hover:opacity-70",
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
        current ? "text-foreground" : "text-muted-foreground hover:text-foreground",
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
