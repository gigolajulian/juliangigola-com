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

      <div className="relative mx-auto flex max-w-[100rem] items-center justify-between px-6 py-5 sm:px-10">
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
            "font-display text-base uppercase leading-none tracking-[0.06em] sm:text-lg",
            "transition-opacity duration-300 ease-[var(--ease-out-strong)] hover:opacity-70",
            "focus-visible:opacity-100",
            wordmarkVisible ? "opacity-100" : "opacity-0",
          )}
        >
          Julian Gigola
        </Link>

        <nav aria-label="Main" className="hidden sm:block">
          <ul className="flex items-center gap-8">
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
          className="label -mr-2 px-2 py-2 transition-transform duration-150 active:scale-[0.97] sm:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {/* Rendered always, toggled with `hidden`, so the links are in the DOM
          for crawlers and the panel does not animate from nothing. */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="fixed inset-0 -z-10 flex flex-col justify-center bg-background px-6 pb-20 sm:hidden"
      >
        <nav aria-label="Main">
          <ul className="flex flex-col gap-2">
            {LINKS.map((link, i) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isCurrent(link.href) ? "page" : undefined}
                  // Staggered so the list cascades in rather than landing all
                  // at once. Short delays only — 40ms a step reads as one
                  // gesture, 150ms reads as waiting.
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={cn(
                    "font-display block py-3 text-4xl leading-none transition-opacity",
                    "animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both ease-out",
                    "motion-reduce:animate-none",
                    isCurrent(link.href) ? "opacity-100" : "opacity-55",
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
        "label group relative block py-1 transition-colors duration-200",
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
