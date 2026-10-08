"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, STRIP_SECTION } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { WarpTuner } from "@/components/warp-tuner";
import { NAME_WARP } from "@/lib/name-warp";
import { installNavFly } from "@/components/nav-fly";

/* The address's hash, kept current: the strip writes the homepage's
   section into it as it glides (`STRIP_SECTION`), a link or the back button
   changes it too. Empty on the server. */
const subscribeHash = (on: () => void) => {
  window.addEventListener(STRIP_SECTION, on);
  window.addEventListener("hashchange", on);
  window.addEventListener("popstate", on);
  return () => {
    window.removeEventListener(STRIP_SECTION, on);
    window.removeEventListener("hashchange", on);
    window.removeEventListener("popstate", on);
  };
};
const useHash = () =>
  React.useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");

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
  // Julian's order (2026-10-01: Portfolio last; 2026-10-03: Commissions
  // first, the two audiences side by side). All but Portfolio are
  // homepage screens. Names in one register, plural nouns like
  // Commissions (2026-10-04): Biography, Inquiries.
  { href: "/#work", label: "Commissions" },
  { href: "/#about", label: "Biography" },
  { href: "/#sessions", label: "Sessions" },
  { href: "/#contact", label: "Inquiries" },
  { href: "/portfolio", label: "Portfolio" },
] as const;

export function SiteHeader() {
  React.useEffect(installNavFly, []);
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const burger = React.useRef<HTMLButtonElement>(null);
  const [routeWhenOpened, setRouteWhenOpened] = React.useState(pathname);

  // Client-side navigation does not unmount the header, so the panel would
  // otherwise stay open behind the new page — after a tap, and after a back
  // button too. Adjusting during render rather than in an effect closes it in
  // the same commit as the new route, so the panel never paints over it.
  if (routeWhenOpened !== pathname) {
    setRouteWhenOpened(pathname);
    setOpen(false);
  }

  /* The homepage's floor, glass like the bar (Julian: the footer glass
   * too). The strip runs to the foot of the screen and the rail and the
   * footer float over it, so the photographs carry on under them the way
   * they do under the bar; each screen keeps the height it had, so the
   * hero stands where it was set. How much floats is measured, since the
   * rail and the footer change height with the screen, and handed to
   * `globals.css` as `--under` (`:root[data-under]`). */
  /* Before paint, in the commit that brings the homepage: a frame later,
     the page came back from the portfolio laid out once without the floor
     and again with it, in the middle of the door shutting (Julian: back
     to the hero lags). */
  React.useLayoutEffect(() => {
    if (pathname !== "/") return;
    const root = document.documentElement;
    let sizes: ResizeObserver | null = null;
    let frame = 0;
    const start = () => {
      const foot = document.querySelector<HTMLElement>("body > footer");
      const rail = document.querySelector<HTMLElement>(".strip-rail");
      if (!foot || !rail) return false;
      root.dataset.under = "";
      /* Only on a change: a property on the root restyles the whole page,
         and the observer reports every load's font swap as a resize. */
      const put = (k: string, v: string) => {
        if (root.style.getPropertyValue(k) !== v) root.style.setProperty(k, v);
      };
      /* Both read before either is written: a write to the root's style
         and then a read restyled the whole page a second time, 140ms on a
         throttled phone (optimize pass, 2026-10-05). */
      const measure = () => {
        const f = foot.offsetHeight;
        const r = rail.offsetHeight;
        put("--foot", `${f}px`);
        put("--under", `${f + r}px`);
      };
      sizes = new ResizeObserver(measure);
      sizes.observe(foot);
      sizes.observe(rail);
      return true;
    };
    // The strip not in yet (a cold load): the next frame, as before.
    if (!start()) frame = requestAnimationFrame(start);
    return () => {
      cancelAnimationFrame(frame);
      sizes?.disconnect();
      delete root.dataset.under;
      /* The sizes stay: read only under `data-under`, and taken off and
         put back they restyled the whole page on the way out to the
         portfolio and again on the way back. */
    };
  }, [pathname]);

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
    /* The 3D preview (`?menu3d=1`): each thing the drawer pushes aside
       turns about the middle of the window, wherever its own box is. */
    for (const el of document.querySelectorAll<HTMLElement>(".site-bar, body > main, body > footer"))
      el.style.setProperty("--oy", `${Math.round(innerHeight / 2 - el.getBoundingClientRect().top)}px`);
    root.dataset.drawer = "menu";
    window.dispatchEvent(new Event("jg:filter-close"));
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    /* The page pushed aside is out of reach while the menu is out: Tab
       went past the four links into it, off the screen at -320px, and a
       screen reader read it as if it were there. */
    const behind = [
      ...document.querySelectorAll<HTMLElement>(
        // The bar goes aside too; only its burger stays, to shut it.
        "#main, body > footer, header :is(a, button):not([aria-controls='mobile-nav'])",
      ),
    ];
    behind.forEach((el) => (el.inert = true));
    const button = burger.current;
    return () => {
      if (root.dataset.drawer === "menu") delete root.dataset.drawer;
      document.body.style.overflow = overflow;
      behind.forEach((el) => (el.inert = false));
      // Focus that was in the menu goes back to the button that opened it,
      // not to wherever the page had it before the menu went away.
      const at = document.activeElement;
      if (!at || at === document.body || at.closest("#mobile-nav"))
        button?.focus({ preventScroll: true });
    };
  }, [open]);

  /* Coming back to the window put the accent ring on whatever was last
     pressed. Chrome counts the Alt+Tab (or the Cmd+Tab) that brings the
     window back as keyboard use, so a button focused by a click comes back
     :focus-visible, ring and all. Julian saw it on every return. So when
     the window loses focus and the last thing that happened was a pointer,
     the focus is let go. A keyboard user is left alone, and a text field is
     too, so a half-typed search keeps its caret. The browser keeps its
     place in the tab order either way, so Tab still carries on from there. */
  React.useEffect(() => {
    let pointer = false;
    const onPointer = () => {
      pointer = true;
    };
    /* The switch away is itself a key: Alt or Cmd goes down on this
       page before the window goes. A modifier on its own, or a key held
       with Alt or Cmd, is the way out and not a visitor using the
       keyboard here. */
    const onKey = (e: KeyboardEvent) => {
      if (
        e.altKey ||
        e.metaKey ||
        ["Alt", "Meta", "Control", "Shift"].includes(e.key)
      )
        return;
      pointer = false;
    };
    const onLeave = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!pointer || !el || el === document.body) return;
      if (el.matches("input, textarea, select, [contenteditable]")) return;
      el.blur();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

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

  /* Julian: on About and Contact, now screens of the homepage, the bar
     says so. A link with a hash is current on its page at its section. */
  const hash = useHash();
  const isCurrent = (href: string) => {
    const [path, section] = href.split("#");
    if (section !== undefined) return pathname === path && hash === `#${section}`;
    return pathname === href || pathname.startsWith(href + "/");
  };

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
      // Glass over the homepage's photographs (`.site-bar[data-home]`), and
      // the same depth on the portfolio (Julian, 2026-10-05: match it).
      data-home={pathname === "/" || pathname.startsWith("/portfolio") ? "" : undefined}
      className={cn(
        // `site-bar` is what `globals.css` slides sideways. The whole bar
        // goes, not its contents: full width and pushed by the drawer's
        // width, it covers the page exactly and stops at the drawer's edge.
        "site-bar fixed inset-x-0 top-0 z-40",
        // Border and background rather than a gradient, and both animate from
        // nothing. `border-b` is always present and only its colour changes,
        // so the rule fading in never moves the bar by a pixel. The glass is
        // not in this list: it lives on `.site-bar::after` in `globals.css`,
        // blurred all the time and faded by opacity, because interpolating a
        // blur re-filters the whole bar every frame and fading a layer that
        // is already blurred does not.
        "border-b transition-[background-color,border-color] duration-300",
        "ease-[var(--ease-out-strong)] motion-reduce:transition-none",
        scrolled
          ? "border-border bg-background/72"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="page-column relative mx-auto flex max-w-[100rem] items-center justify-between px-6 py-3 max-sm:py-2 sm:px-10 sm:py-4 tablet:py-1.5 lying:py-1.5">
        <Link
          href="/"
          data-ring="Home"
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
          // Julian: the name as the cover sets it, Inter Tight Black in
          // upper and lower case at -0.045em, so the wordmark and the
          // masthead are one mark.
          //
          // Faded rather than unmounted, so it stays in the accessibility
          // tree and the tab order throughout — the route home must not
          // vanish just because the page is scrolled to the top. Tabbing to
          // it brings it back into view, so it is never an invisible focus
          // target.
          className={cn(
            "font-display text-lg leading-none sm:text-2xl lying:text-lg",
            // Scaling from the left edge, because that edge is shared with
            // the masthead — growing from the centre would slide the name
            // sideways out of the alignment the handoff depends on.
            "origin-left will-change-[transform,opacity]",
            // Julian: a very slight fade on hover. It was to 70%, which
            // greyed the colour split of the warp under the pointer.
            "transition-opacity duration-300 ease-[var(--ease-out-strong)] hoverable:hover:opacity-90",
            // Julian (2026-10-04): it grows under the pointer (`.logo-grow`).
            "logo-grow",
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
          {/* Julian: the same glass as the name on the cover. The canvas is
              a picture of the words; the words are here for everyone who
              reads them as text. Pulled left by the room the effect keeps
              round the words, so the name still starts on the margin. */}
          <span className="sr-only">Julian Gigola</span>
          {/* Sliders with `?tune` on the dev server (`warp-tuner.tsx`). */}
          <WarpTuner
            title="Navbar logo"
            corner="right"
            text="Julian Gigola"
            fontFamily="var(--font-wordmark)"
            fontWeight={900}
            fontSize="1em"
            letterSpacing="-0.045em"
            // Julian: the cover's hover on the logo too, the same values.
            {...NAME_WARP}
            style={{ width: "5.9em", height: "1.1em", marginLeft: "-0.18em" }}
          />
        </Link>

        {/* The right-hand group. Grouping these rather than leaving them as
            separate children of a `justify-between` row is what keeps the
            nav pinned right instead of drifting to the middle once a third
            item joins it. */}
        <div className="flex items-center gap-1 lg:gap-8">
          <nav aria-label="Main" className="hidden lg:block">
            <NavLinks links={LINKS} isCurrent={isCurrent} />
          </nav>

          {/* Outside the nav: it is not a destination, it changes how the
              page looks rather than going anywhere. Here on a desktop only;
              under the burger it is in the menu (`site-menu.tsx`), at
              Julian's ask (2026-10-01), so the bar holds the name and the
              burger and nothing else. */}
          <ThemeToggle className="hidden lg:flex" />

          <button
            ref={burger}
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

/* The select and the hover: the name lit is a touch larger
   (Julian, 2026-10-05). The ink line that ran under it, between the names
   and once out to the wordmark (2026-10-03 to 10-05), is gone: the type
   alone says where you are. With no page lit (the legal page) only the
   name under the pointer lights. */
function NavLinks({
  links,
  isCurrent,
}: {
  links: readonly { href: string; label: string }[];
  isCurrent: (href: string) => boolean;
}) {
  const [over, setOver] = React.useState<number | null>(null);
  const lit = links.findIndex((l) => isCurrent(l.href));
  const at = over ?? (lit >= 0 ? lit : null);
  return (
    <ul
      /* Julian (2026-10-04): every slot the same length, the longest
         name's and a margin. */
      className="relative grid auto-cols-fr grid-flow-col items-center"
      onPointerLeave={() => setOver(null)}
    >
      {links.map((link, i) => (
        <li
          key={link.href}
          className="relative px-2 text-center xl:px-3"
          onPointerEnter={(e) => e.pointerType === "mouse" && setOver(i)}
        >
          <NavLink href={link.href} current={isCurrent(link.href)} lit={at === i}>
            {link.label}
          </NavLink>
        </li>
      ))}
    </ul>
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
  lit = current,
  children,
}: {
  href: string;
  current: boolean;
  /** Lit: the page, or the name under the pointer. */
  lit?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "block py-3 font-mono text-[0.9375rem] uppercase leading-none tracking-[0.08em] transition-[color,scale] duration-300 ease-[var(--ease-out-strong)]",
        // The page you are on stands back while the pointer lights another
        // name, and comes up again when it leaves.
        // Lit, the name is a touch larger (Julian, 2026-10-05).
        // Bold costs no width in a mono face, so nothing beside it moves.
        lit
          ? "text-foreground scale-[1.06]"
          : current
            ? "text-foreground/70"
            : "text-muted-foreground",
      )}
    >
      {children}
    </Link>
  );
}
