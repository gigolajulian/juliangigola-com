"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* JG V3 chrome (master v39): the glass header, the phone menu, the theme
   toggle and the footer line. /admin keeps the old chrome. */

const noop = () => () => {};

/** /admin is out of V3's scope and keeps the old chrome. */
export const isLegacy = (path: string) => /^\/admin(\/|$)/.test(path);

export function OnLegacy({ children }: { children: React.ReactNode }) {
  return isLegacy(usePathname()) ? <>{children}</> : null;
}

export function OnV3({ children }: { children: React.ReactNode }) {
  return isLegacy(usePathname()) ? null : <>{children}</>;
}

/* Motion that is not in the master (the splash, the page zoom, the pointer
   mark, tilt, glass light, fades) stays off unless `?v3motion` is on for
   the tab (`app/layout.tsx` sets `data-v3motion`). The old chrome keeps it. */
export function MotionGate({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const legacy = isLegacy(usePathname());
  const on = React.useSyncExternalStore(noop, () => document.documentElement.hasAttribute("data-v3motion"), () => false);
  return <>{legacy || on ? children : fallback}</>;
}

/* ── theme toggle: half-disc, 14px. Hover tilts it 90°; a click spins a
   further 270° to land straight (+360° from rest) and flips the theme. ── */
const KEY = "theme";
type Theme = "dark" | "light";
const read = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
/* The browser bar takes the page's ground (values from `app/layout.tsx`). */
const paint = (t: Theme) => {
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    m.setAttribute("content", t === "light" ? "#ebedef" : "#0b0a09");
    m.removeAttribute("media");
  }
};
/* Dark is written out too, so the master's system-light rule stands down. */
const set = (t: Theme) => {
  document.documentElement.dataset.theme = t;
  paint(t);
};
let turns = 0;

function ThemeButton() {
  const [theme, setTheme] = React.useState<Theme | null>(null);
  const [spun, setSpun] = React.useState(false);
  React.useEffect(() => {
    queueMicrotask(() => setTheme(read()));
    const watch = new MutationObserver(() => setTheme(read()));
    watch.observe(document.documentElement, { attributeFilter: ["data-theme"] });
    /* Follows the system until the toggle is pressed (a choice lasts the visit). */
    let chosen: string | null = null;
    try {
      chosen = sessionStorage.getItem(KEY);
    } catch {}
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
  const flip = () => {
    const next: Theme = read() === "light" ? "dark" : "light";
    set(next);
    try {
      sessionStorage.setItem(KEY, next);
    } catch {}
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
  { href: "/portfolio", label: "Work" },
  { href: "/book", label: "Sessions" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Inquire" },
];
const current = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** The cover's own nav on the homepage: the links and the toggle over the photo. */
export function CoverNav() {
  return (
    <nav className="nav lbl" aria-label="Main">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href}>{n.label}</Link>
      ))}
      <ThemeButton />
    </nav>
  );
}

export function V3Header() {
  const path = usePathname();
  const home = path === "/";
  const hdr = React.useRef<HTMLElement>(null);
  /* Over the homepage cover it waits until the big name has scrolled under
     it; on every other page it is there from the start. */
  const [past, setPast] = React.useState(false);
  React.useEffect(() => {
    if (!home) return;
    const sync = () => {
      const name = document.querySelector(".a-cover h1");
      setPast(!!name && name.getBoundingClientRect().bottom < (hdr.current?.offsetHeight ?? 0));
    };
    addEventListener("scroll", sync, { passive: true });
    sync();
    return () => removeEventListener("scroll", sync);
  }, [home]);
  const show = !home || past;
  const [menu, setMenu] = React.useState(false);
  /* A route change closes it. */
  const [was, setWas] = React.useState(path);
  if (was !== path) {
    setWas(path);
    setMenu(false);
  }
  React.useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [menu]);
  return (
    <div className="v3 contents">
      <header ref={hdr} className={show || menu ? "site-hdr show" : "site-hdr"} inert={!(show || menu)}>
        <Link className="wm site-wm" href="/">Julian Gigola</Link>
        <nav className="links lbl" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(path, n.href) ? "page" : undefined}>{n.label}</Link>
          ))}
          <button className="menu-btn" type="button" aria-expanded={menu} aria-controls="pmenu" onClick={() => setMenu(!menu)}>{menu ? "Close" : "Menu"}</button>
          <ThemeButton />
        </nav>
      </header>
      <nav className="pmenu" id="pmenu" aria-label="Menu" hidden={!menu}>
        <Link href="/">Home</Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}>{n.label}</Link>
        ))}
        <span className="lbl mute">hello@juliangigola.com</span>
      </nav>
    </div>
  );
}

/** The footer line, as the master puts it: the last row inside each page. */
export function V3Foot() {
  return (
    <div className="foot-line lbl mute">
      <span>© 2026 Julian Gigola</span>
      <a href="mailto:hello@juliangigola.com">hello@juliangigola.com</a>
      <span>San Francisco Bay Area</span>
    </div>
  );
}

/* Screens built from the master carry their own footer line (`V3Foot`);
   the pages restyled by tokens only get it here, after `main`. */
const OWN_FOOT = /^\/($|portfolio(\/video)?$|bts$|about$|contact(\/form)?$|book(\/|$)|portraits$|headshots$|graduation-photos$|model-digitals$|weddings$|music-photography$|brand-photography$)/;

export function V3Footer() {
  if (OWN_FOOT.test(usePathname())) return null;
  return (
    <div className="v3 contents">
      <V3Foot />
    </div>
  );
}
