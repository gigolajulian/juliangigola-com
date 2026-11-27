"use client";

import * as React from "react";
import { PageFoot } from "@/components/site/foot";
import Link from "next/link";
import { THEME_COLOR } from "@/lib/theme-color";
import { usePathname } from "next/navigation";
import { scrollTop } from "./smooth-scroll";
import { useNavInk } from "./nav-ink";
import { noSubscribe } from "@/lib/utils";
import { sessionGet, sessionSet } from "@/lib/storage";

/* JG V3 chrome: the glass header, the phone menu, the theme
   toggle and the footer line. Every route uses it, /admin included. */

/* Motion that is not in the master (the splash, the page zoom, the pointer
   mark, tilt, glass light, fades): on the client only, so the server and the
   first paint render the fallback. */
export function MotionGate({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const on = React.useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  return <>{on ? children : fallback}</>;
}

/* ── theme toggle: half-disc, 14px. Hover tilts it 90°; a click spins a
   further 270° to land straight (+360° from rest) and flips the theme. ── */
const KEY = "theme";
type Theme = "dark" | "light";
const read = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
/* The browser bar takes the page's ground (values from `app/layout.tsx`). */
const paint = (t: Theme) => {
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    m.setAttribute("content", THEME_COLOR[t]);
    m.removeAttribute("media");
  }
};
/* Dark is written out too, so the master's system-light rule stands down. */
const set = (t: Theme) => {
  document.documentElement.dataset.theme = t;
  paint(t);
};
let turns = 0;
/* ?themefx (opt-in, lasts the visit): the new theme grows as a circle from the toggle's divider line. */
const radialOn = () => {
  if (new URLSearchParams(location.search).has("themefx")) sessionSet("themefx", "1");
  return sessionGet("themefx") === "1" && typeof document.startViewTransition === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
};
const radial = (from: HTMLElement, apply: () => void) => {
  const b = from.getBoundingClientRect();
  const x = b.left - 16.5; // the 1px line, .tbtn::before at left:-17px
  const y = b.top + b.height / 2;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const root = document.documentElement;
  root.dataset.themefx = "";
  const t = document.startViewTransition(apply);
  t.ready.then(() =>
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: "cubic-bezier(.65,0,.35,1)", pseudoElement: "::view-transition-new(root)" },
    ),
  );
  t.finished.finally(() => delete root.dataset.themefx);
};

function ThemeButton() {
  const [theme, setTheme] = React.useState<Theme | null>(null);
  const [spun, setSpun] = React.useState(false);
  React.useEffect(() => {
    queueMicrotask(() => setTheme(read()));
    const watch = new MutationObserver(() => setTheme(read()));
    watch.observe(document.documentElement, { attributeFilter: ["data-theme"] });
    /* Follows the system until the toggle is pressed (a choice lasts the visit). */
    const chosen = sessionGet(KEY);
    const mq = matchMedia("(prefers-color-scheme: light)");
    const follow = () => set(mq.matches ? "light" : "dark");
    if (chosen !== "light" && chosen !== "dark") mq.addEventListener("change", follow);
    return () => {
      watch.disconnect();
      mq.removeEventListener("change", follow);
    };
  }, []);
  const here = usePathname();
  React.useEffect(() => paint(read()), [here]);
  const flip = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next: Theme = read() === "light" ? "dark" : "light";
    const phone = matchMedia("(max-width: 700px) and (pointer: coarse)").matches;
    if (!phone && radialOn()) radial(e.currentTarget, () => set(next));
    else set(next);
    sessionSet(KEY, next);
    /* iPhone Safari keeps the old colour in the bars above and below the
       page until it loads again (Julian): reload, and the head script
       paints the chosen theme from the first frame. */
    if (phone) return void location.reload();
    turns += 360;
    document.documentElement.style.setProperty("--tb-r", `${turns}deg`);
    setSpun(true);
  };
  return (
    <button
      type="button"
      className={spun ? "tbtn spun" : "tbtn"}
      onClick={flip}
      onPointerLeave={() => setSpun(false)}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 1.75a8.25 8.25 0 0 1 0 16.5z" fill="currentColor" />
      </svg>
    </button>
  );
}

export const NAV = [
  { href: "/portfolio", label: "Portfolio" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/book", label: "Book a session" },
];
const current = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Client proof galleries carry their own bar (`components/proofs/gallery.tsx`). */
export function SiteHeader() {
  const path = usePathname();
  return path.startsWith("/proof/") || path.startsWith("/delivery/") || path.startsWith("/contract/") ? null : <HeaderBar />;
}

function HeaderBar() {
  const path = usePathname();
  const hdr = React.useRef<HTMLElement>(null);
  /* Portfolio: the header steps away while you scroll down into the work and
     comes back when you scroll up; the view buttons stay pinned in the corner (Julian,
     2026-10-27). The root attributes drive the search bar's ride in v3.css. */
  const tucks = path.startsWith("/portfolio");
  const [tuck, setTuck] = React.useState(false);
  React.useEffect(() => {
    if (!tucks) return;
    const root = document.documentElement;
    root.setAttribute("data-pf", "");
    let last = scrollY;
    // Desktop keeps the header: it and the toolbar are one glass bar.
    const desk = matchMedia("(min-width: 701px) and (hover: hover) and (pointer: fine)");
    const sync = () => {
      const y = scrollY,
        d = y - last;
      if (Math.abs(d) < 6) return;
      last = y;
      // Typing in the header field: stay tucked, or a rotation's scroll untucks it and the field leaves the keyboard's view (iPhone Duo).
      if (document.activeElement?.matches(".htools input")) return;
      setTuck(d > 0 && y > 80 && !desk.matches);
    };
    addEventListener("scroll", sync, { passive: true });
    return () => {
      removeEventListener("scroll", sync);
      root.removeAttribute("data-pf");
      setTuck(false);
    };
  }, [tucks, path]);
  React.useLayoutEffect(() => {
    /* Motion plan item 12 (docs/decisions.md): the header tools (work.tsx
       portals them into #hdr-tools) jump to the corner when the header tucks,
       and travel there by transform (250 on `out`). Layout effect: measured
       before a paint. */
    const bar = !matchMedia("(prefers-reduced-motion: reduce)").matches ? document.querySelector<HTMLElement>(".v3 .htools") : null;
    const was = bar?.getBoundingClientRect();
    document.documentElement.toggleAttribute("data-tuck", tuck);
    if (!bar || !was) return;
    const now = bar.getBoundingClientRect();
    const dx = was.right - now.right,
      dy = was.top - now.top;
    if (dx || dy)
      bar.animate({ transform: [`translate(${dx}px,${dy}px)`, "none"] }, { duration: 250, easing: "cubic-bezier(.23,1,.32,1)" });
  }, [tuck]);
  // The v4 home has no cover to wait for, the bar is there from the start.
  const show = !tuck;
  // The header: ground off at the top, white or black words (navfx.css).
  useNavInk(hdr, path);
  const [menu, setMenu] = React.useState(false);
  /* A route change closes it. */
  const [was, setWas] = React.useState(path);
  if (was !== path) {
    setWas(path);
    setMenu(false);
  }
  /* Focus goes into the drawer on open and back to the button that opened it
     on close; the page and footer behind it are inert, the header (its close
     button) stays live. Read in a layout effect, before inert drops focus. */
  const opener = React.useRef<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    if (!menu) return;
    opener.current = document.activeElement as HTMLElement | null;
    const behind = [...document.querySelectorAll<HTMLElement>('#main, #main ~ .v3, a[href="#main"]')];
    behind.forEach((el) => (el.inert = true));
    document.querySelector<HTMLElement>("#pmenu a")?.focus({ preventScroll: true });
    return () => behind.forEach((el) => (el.inert = false));
  }, [menu]);
  React.useEffect(() => {
    if (menu || !opener.current) return;
    const back = opener.current;
    opener.current = null;
    /* A frame later: the header's links go inert again on the cover as it
       closes, and the browser drops focus from the close button after this
       effect would have run (QA, 320 on the home cover). */
    const id = requestAnimationFrame(() => {
      const a = document.activeElement;
      if (!a || a === document.body || a.closest("#pmenu, [inert]")) back.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [menu]);
  React.useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [menu]);
  return (
    <div className="v3 contents">
      {/* Inert per part, not the whole bar: the portfolio's tools stay live in it while it tucks. */}
      <header ref={hdr} className={`site-hdr${show || menu ? " show" : ""}${menu ? " landed" : ""}${menu ? " menu-on" : ""}`}>
        {/* On the homepage it glides back up to the hero (a jump under Reduce Motion); elsewhere page-fly.tsx opens Home at its top. */}
        <Link
          className="wm site-wm"
          href="/"
          inert={!(show || menu)}
          onClick={(e) => {
            if (path !== "/" || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            setMenu(false);
            scrollTop(!matchMedia("(prefers-reduced-motion: reduce)").matches);
          }}
        >
          Julian Gigola
        </Link>
        <div id="hdr-tools" className="hslot" />
        <nav className="links lbl burger" aria-label="Main" inert={!(show || menu)}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(path, n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
          <button
            className={menu ? "menu-btn burger-btn open" : "menu-btn burger-btn"}
            type="button"
            aria-expanded={menu}
            aria-controls="pmenu"
            aria-label={menu ? "Close menu" : "Menu"}
            onClick={() => setMenu(!menu)}
          >
            <i aria-hidden />
            <i aria-hidden />
          </button>
          <ThemeButton />
        </nav>
      </header>
      {/* Julian: on iPhone screens a hamburger, the menu sliding in from the
          right, light and dark at its bottom left; the homepage's sticky
          header too (its cover nav stays). Held in a screen-sized box that
          clips: iOS Safari pans sideways to a fixed panel waiting past the
          right edge (Julian's iPhone). */}
      <div className="pwrap">
        <div className={menu ? "pdim open" : "pdim"} aria-hidden onClick={() => setMenu(false)} />
        <nav
          className={menu ? "pmenu drawer open" : "pmenu drawer"}
          id="pmenu"
          aria-label="Menu"
          inert={!menu}
          onClick={(e) => (e.target as HTMLElement).closest("a") && setMenu(false)}
        >
          <Link href="/">Home</Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(path, n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
          <div className="pmenu-foot">
            <ThemeButton />
            <a className="lbl mute" href="mailto:hello@juliangigola.com">
              hello@juliangigola.com
            </a>
          </div>
        </nav>
      </div>
    </div>
  );
}

/** The footer line, as the master puts it: the last row inside each page. */
export function FootLine() {
  return (
    <footer className="foot-line lbl mute">
      <span className="foot-c">© 2026 Julian Gigola</span>
      <span className="foot-p">
        <Link href="/legal">Legal</Link>
        <span>San Francisco Bay Area</span>
      </span>
    </footer>
  );
}

/* Screens built from the master carry their own footer line (`FootLine`);
   the pages restyled by tokens only get it here, after `main`. */
const OWN_FOOT =
  /^\/($|portfolio(\/video)?$|bts$|about$|contact(\/form)?$|book(\/|$)|portraits$|headshots$|graduation-photos(\/|$)|model-digitals$|weddings$|music-photography$|fashion-photography$|brand-photography$|admin(\/|$)|proof\/)/;

/* The line stays on the private pages and the forms (booking, contract, delivery, proof, contact). */
const LINE_ONLY = /^\/(booking|contract|delivery|proof|contact|book|admin)(\/|$)/;

export function SiteFooter() {
  const path = usePathname();
  // A campus guide carries its own footer inside the page, so this second line goes.
  if (OWN_FOOT.test(path) || path.startsWith("/graduation-photos/")) return null;
  return (
    <div className="v3 contents">
      {/* remade per page: this footer outlives the page, and its hand-over looks up the page's last block once */}
      {LINE_ONLY.test(path) ? <FootLine /> : path === "/legal" ? <PageFoot bare /> : <PageFoot key={path} />}
    </div>
  );
}
