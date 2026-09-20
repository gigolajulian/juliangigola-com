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

export const LINKS = [
  { href: "/work", label: "Work" },
  { href: "/sessions", label: "Sessions" },
  { href: "/about", label: "About" },
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

  /* The open state, published to the document.
   *
   * The menu is a drawer the page slides off: the bar, the page and the
   * footer all travel left by the drawer's width, and the drawer is under
   * them at the right edge waiting to be uncovered. Those three sit in
   * three different components and only one of them is this one, so the
   * fact of being open goes on `<html>` and `globals.css` moves everything
   * off it. Nothing here needs to know what moves.
   *
   * `data-drawer` and not `data-menu`, because /work has one of these too
   * and it comes in from the other side. One attribute holds one name, so
   * a page asked to travel both ways at once is a state the stylesheet
   * cannot express — cheaper than two components agreeing to behave. The
   * filters still get told, below, so their own state does not drift.
   *
   * The cleanup only lets go of what it took: closing this drawer because
   * the other one opened must not clear the other one's attribute.
   *
   * The scroll lock rides along: a drawer over a gallery that still scrolls
   * behind it is a page that has not really stopped.
   */
  React.useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.dataset.drawer = "menu";
    window.dispatchEvent(new Event("jg:filter-close"));
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      if (root.dataset.drawer === "menu") delete root.dataset.drawer;
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // The drawer is a sibling of this component rather than a child, so the
  // ground beside it closes the menu by saying so rather than by reaching
  // in. The filters ask for the same thing when they open.
  React.useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("jg:menu-close", close);
    return () => window.removeEventListener("jg:menu-close", close);
  }, []);

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
       * The menu used to count as a ground of its own, because it used to
       * be a full-screen panel behind the bar. It is a drawer now and the
       * bar travels with the page, over the same photograph it was over
       * before, so being open says nothing about what is underneath. */
      data-plain={scrolled ? "true" : "false"}
      className={cn(
        // `site-bar` is what `globals.css` slides sideways. The whole bar
        // goes, not its contents: full width and pushed by the drawer's
        // width, it covers the page exactly and stops at the drawer's edge.
        "site-bar fixed inset-x-0 top-0 z-40",
        // Border and background rather than a gradient, and both animate from
        // nothing. `border-b` is always present and only its colour changes,
        // so the rule fading in never moves the bar by a pixel.
        "border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        "ease-[var(--ease-out-strong)] motion-reduce:transition-none",
        scrolled
          ? "glass-surface border-border bg-background/72"
          : "border-transparent bg-transparent",
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
    </header>
  );
}

/**
 * Where you are is the one at full strength and the other three stand back.
 * No mark under it: Julian picked ink alone out of eight, and it is what the
 * menu drawer has always done with the same four names — the navbar and the
 * drawer now say "you are here" the same way, with one less mark on the
 * screen. The pointer answers in the same language, a name coming up to full
 * ink rather than a rule drawing itself.
 *
 * The underline that used to grow from the left on hover is gone with it.
 * The keyboard is unaffected: the focus ring is the accent outline every
 * focusable thing on the site gets, set once in `globals.css`.
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
        "block py-3 text-[0.9375rem] uppercase leading-none tracking-[0.08em] transition-colors duration-200",
        current
          ? "text-foreground"
          // `hoverable:`, not a bare `hover:`: a touch device fires hover on
          // tap and would leave a name lit that is not the page you are on.
          : "text-muted-foreground hoverable:hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
