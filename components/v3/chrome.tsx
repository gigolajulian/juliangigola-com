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
    /* iPhone Safari keeps the old colour in the bars above and below the
       page until it loads again (Julian): reload, and the head script
       paints the chosen theme from the first frame. */
    if (matchMedia("(max-width: 700px) and (pointer: coarse)").matches) return void location.reload();
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
  { href: "/book", label: "Sessions" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Inquire" },
];
const current = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** The cover's own nav on the homepage: the links and the toggle over the photo. */
export function CoverNav() {
  return (
    <nav className="nav lbl" aria-label="Cover">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href}>{n.label}</Link>
      ))}
      <ThemeButton />
    </nav>
  );
}

/** The text's own box, without line-height or tap padding. */
function ink(el: Node) {
  const r = document.createRange();
  r.selectNodeContents(el);
  return r.getBoundingClientRect();
}

/* Flies a copy of the cover name to the wordmark or back with RAF dynamic tracking so scrolling up never jumps. */
function useDock(dock: boolean, past: boolean, hdr: React.RefObject<HTMLElement | null>, setLanded: (b: boolean) => void) {
  const was = React.useRef(false);
  const fly = React.useRef<HTMLElement | null>(null);
  const rafId = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!dock || past === was.current) return;
    was.current = past;
    const root = document.documentElement;
    const h1 = document.querySelector<HTMLElement>(".a-cover h1");
    const wm = hdr.current?.querySelector<HTMLElement>(".site-wm");

    if (rafId.current) cancelAnimationFrame(rafId.current);
    if (fly.current) {
      fly.current.remove();
      fly.current = null;
    }
    setLanded(false);

    if (past) root.setAttribute("data-dock", "");

    const a = h1 && ink(h1), b = wm && ink(wm), cs = h1 && getComputedStyle(h1);
    // Off screen, or wrapped on a phone: no flight, it just lands.
    if (!h1 || !wm || !a || !b || !cs || a.bottom < 0 || a.height > parseFloat(cs.fontSize) * 1.3) {
      if (past) setLanded(true);
      else root.removeAttribute("data-dock");
      return;
    }

    const ws = getComputedStyle(wm);
    const k = b.width / a.width;

    const f = document.createElement("div");
    f.setAttribute("aria-hidden", "");
    f.innerHTML = "<span>Julian Gigola</span><span>Julian Gigola</span>";
    const [big, small] = f.children as unknown as [HTMLElement, HTMLElement];

    Object.assign(f.style, {
      position: "fixed",
      left: "0",
      top: "0",
      margin: "0",
      zIndex: "31",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      transformOrigin: "0 0",
      willChange: "transform",
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform
    });

    Object.assign(small.style, {
      position: "absolute",
      left: "0",
      top: "0",
      fontFamily: ws.fontFamily,
      fontWeight: ws.fontWeight,
      fontSize: `${parseFloat(ws.fontSize) / k}px`,
      lineHeight: "1",
      letterSpacing: `${parseFloat(ws.letterSpacing) / k}px`,
      textTransform: ws.textTransform
    });

    big.style.color = cs.color;
    small.style.color = ws.color;

    document.body.append(f);
    fly.current = f;

    const o = ink(big);
    const fl0 = a.left - o.left;
    const ft0 = a.top - o.top;

    const sb = ink(small);
    small.style.left = `${a.left - sb.left}px`;
    small.style.top = `${a.top + a.height / 2 - (sb.top + sb.height / 2)}px`;
    const s2 = ink(small);
    const sx = s2.left - fl0;
    const sy = s2.top - ft0;

    const duration = past ? 450 : 380;
    const startTime = performance.now();

    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

    const updateFrame = (now: number) => {
      if (fly.current !== f) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easeP = easeOutCubic(progress);

      const curA = h1 ? ink(h1) : a;
      const curB = wm ? ink(wm) : b;

      const curK = b.width / a.width;
      const targetX = curB.left - curA.left - sx * curK;
      const targetY = curB.top - curA.top - sy * curK;

      const posX = curA.left - o.left + (past ? targetX * easeP : targetX * (1 - easeP));
      const posY = curA.top - o.top + (past ? targetY * easeP : targetY * (1 - easeP));
      const scale = past ? 1 + (curK - 1) * easeP : curK + (1 - curK) * easeP;

      f.style.transform = `translate3d(${posX}px, ${posY}px, 0) scale(${scale})`;

      const capsOpacity = past ? (1 - easeP) : easeP;
      big.style.opacity = `${capsOpacity}`;
      small.style.opacity = `${1 - capsOpacity}`;

      if (progress < 1) {
        rafId.current = requestAnimationFrame(updateFrame);
      } else {
        fly.current = null;
        f.remove();
        if (past) {
          setLanded(true);
        } else {
          root.removeAttribute("data-dock");
        }
      }
    };

    rafId.current = requestAnimationFrame(updateFrame);
  }, [dock, past, hdr, setLanded]);

  React.useEffect(() => () => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    if (fly.current) {
      fly.current.remove();
      fly.current = null;
    }
    document.documentElement.removeAttribute("data-dock");
  }, []);
}

export function V3Header() {
  const path = usePathname();
  const home = path === "/";
  const hdr = React.useRef<HTMLElement>(null);
  /* Over the homepage cover it waits until the big name has scrolled under
     it; on every other page it is there from the start. */
  const [past, setPast] = React.useState(false);
  /* ?v3motion (mock https://claude.ai/artifact/VDtydGRZFjpd4W1kibeqBm, 4b):
     it starts as the name's top reaches it, the name shrinks into the
     wordmark and the bar unrolls from its top edge. */
  const dock = React.useSyncExternalStore(noop, () => home && document.documentElement.hasAttribute("data-v3motion") && !matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const [landed, setLanded] = React.useState(false);
  React.useEffect(() => {
    const on = dock;
    if (!home) return;
    const sync = () => {
      const r = document.querySelector(".a-cover h1")?.getBoundingClientRect();
      const hdrH = hdr.current?.offsetHeight ?? 0;
      setPast((prevPast) => {
        if (!r) return false;
        if (prevPast) {
          return r.top < hdrH + 50;
        } else {
          return r.top < hdrH;
        }
      });
    };
    addEventListener("scroll", sync, { passive: true });
    sync();
    return () => removeEventListener("scroll", sync);
  }, [home, dock]);
  useDock(dock, past, hdr, setLanded);
  /* Portfolio: the header steps away while you scroll down into the work
     and comes back on the way up (Julian). */
  const tucks = path.startsWith("/portfolio");
  const [tuck, setTuck] = React.useState(false);
  React.useEffect(() => {
    if (!tucks) return;
    let last = scrollY;
    const sync = () => {
      const y = scrollY, d = y - last;
      if (Math.abs(d) < 6) return;
      setTuck(d > 0 && y > 80);
      last = y;
    };
    addEventListener("scroll", sync, { passive: true });
    return () => {
      removeEventListener("scroll", sync);
      setTuck(false);
    };
  }, [tucks, path]);
  const show = (!home || past) && !(tucks && tuck);
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
      <header ref={hdr} className={`site-hdr${show || menu ? " show" : ""}${dock ? " dock" : ""}${landed || menu ? " landed" : ""}`} inert={!(show || menu)}>
        <Link className="wm site-wm" href="/">Julian Gigola</Link>
        <nav className="links lbl burger" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(path, n.href) ? "page" : undefined}>{n.label}</Link>
          ))}
          <button className={menu ? "menu-btn burger-btn open" : "menu-btn burger-btn"} type="button" aria-expanded={menu} aria-controls="pmenu" aria-label={menu ? "Close menu" : "Menu"} onClick={() => setMenu(!menu)}>
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
        <nav className={menu ? "pmenu drawer open" : "pmenu drawer"} id="pmenu" aria-label="Menu" inert={!menu}>
          <Link href="/">Home</Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(path, n.href) ? "page" : undefined}>{n.label}</Link>
          ))}
          <div className="pmenu-foot">
            <ThemeButton />
            <span className="lbl mute">hello@juliangigola.com</span>
          </div>
        </nav>
      </div>
    </div>
  );
}

/** The footer line, as the master puts it: the last row inside each page. */
export function V3Foot() {
  return (
    <div className="foot-line lbl mute">
      <span className="foot-c">© 2026 Julian Gigola</span>
      <span className="foot-p">
        <Link href="/legal">Legal</Link>
        <span>San Francisco Bay Area</span>
      </span>
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
