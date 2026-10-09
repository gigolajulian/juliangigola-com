"use client";

import * as React from "react";
import { useSiteTheme } from "@/lib/site-theme";

/* ── Cal.com, inline ──────────────────────────────────────────────
 * The booking calendar from Cal.com in place of Google's, behind `?cal`
 * on the address while it is tried out. Without the flag, or for a session
 * with no Cal.com event yet (`CAL_EVENTS`, `lib/booking.ts`), it renders
 * what it is given: the Google Calendar frame, exactly as before.
 *
 * Cal.com's script loads only once the calendar is on screen, and takes
 * the site's own colours in either theme, so unlike Google's page it is
 * not turned over on the dark one (`.cal-embed`, globals.css).
 * ─────────────────────────────────────────────────────────────── */

const ORIGIN = "https://app.cal.com";
const SCRIPT = `${ORIGIN}/embed/embed.js`;

type CalFn = ((...args: unknown[]) => void) & {
  q?: unknown[];
  ns?: Record<string, CalFn>;
};

declare global {
  interface Window {
    Cal?: CalFn;
  }
}

/* Cal.com's own loader stub: calls queue on `window.Cal` until embed.js
   arrives and runs them. A namespace gets a queue of its own. */
function stub(): CalFn {
  if (window.Cal) return window.Cal;
  const cal: CalFn = Object.assign(
    (...args: unknown[]) => {
      if (args[0] === "init" && typeof args[1] === "string") {
        const ns = args[1];
        const api: CalFn = Object.assign((...a: unknown[]) => void api.q!.push(a), { q: [] as unknown[] });
        cal.ns![ns] = cal.ns![ns] ?? api;
        cal.ns![ns].q!.push(args);
        cal.q!.push(["initNamespace", ns]);
        return;
      }
      cal.q!.push(args);
    },
    { q: [] as unknown[], ns: {} as Record<string, CalFn> },
  );
  window.Cal = cal;
  return cal;
}

/* The script, added once. */
let script: HTMLScriptElement | null = null;
function load() {
  if (script) return;
  script = document.createElement("script");
  script.src = SCRIPT;
  script.async = true;
  document.head.appendChild(script);
}

/* The site's colours, as the page has them now, for Cal.com's own
   variables. The ground is left clear, so the card it sits in shows. */
function look() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const vars = {
    "cal-bg": "transparent",
    "cal-bg-muted": v("--card"),
    "cal-bg-subtle": v("--muted"),
    "cal-bg-emphasis": v("--muted"),
    "cal-border": v("--border"),
    "cal-border-subtle": v("--border"),
    "cal-text": v("--foreground"),
    "cal-text-emphasis": v("--foreground"),
    "cal-text-subtle": v("--muted-foreground"),
    "cal-text-muted": v("--muted-foreground"),
    "cal-brand": v("--foreground"),
    "cal-brand-emphasis": v("--foreground"),
    "cal-brand-text": v("--background"),
  };
  return { theme, cssVarsPerTheme: { light: vars, dark: vars }, layout: "month_view" };
}

let mounts = 0;

/** Cal.com's calendar for one event, in a box sized like the frame it
    replaces. */
function CalInline({ path, title, className }: { path: string; title: string; className?: string }) {
  const box = React.useRef<HTMLDivElement>(null);
  const host = React.useRef<HTMLDivElement>(null);
  const ns = React.useRef<string | null>(null);
  const [state, setState] = React.useState<"waiting" | "ready">("waiting");
  const theme = useSiteTheme();

  React.useEffect(() => {
    const el = box.current;
    const into = host.current;
    if (!el || !into) return;
    /* Not before it is on screen: a session page's Book screen is the
       last of the deck. */
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seen.disconnect();
      const name = `jg${++mounts}`;
      ns.current = name;
      const cal = stub();
      load();
      cal("init", name, { origin: ORIGIN });
      const api = cal.ns![name];
      const ui = look();
      api("inline", { elementOrSelector: into, calLink: path, config: { layout: ui.layout, theme: ui.theme } });
      api("ui", ui);
      api("on", { action: "linkReady", callback: () => setState("ready") });
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [path]);

  /* The site's switch flips the calendar with it. */
  React.useEffect(() => {
    const name = ns.current;
    if (name) window.Cal?.ns?.[name]?.("ui", look());
  }, [theme]);

  return (
    <div ref={box} data-cal={state} aria-label={title} role="region" className={`cal-embed relative ${className ?? ""}`}>
      <div ref={host} className="h-full w-full overflow-y-auto overscroll-contain" />
    </div>
  );
}

/** Cal.com's calendar for `path` with `?cal` on the address, and
    `children` (the Google Calendar frame) otherwise. `className` sizes the
    box as the frame is sized, so it fits the same place. */
export function CalEmbed({
  path,
  title,
  className,
  children,
}: {
  path?: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [flag, setFlag] = React.useState(false);
  /* Read once, on mount: the server has no address bar, and /book
     rewrites its own (`?session=`) as a session is picked. */
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (new URLSearchParams(location.search).has("cal")) setFlag(true);
  }, []);
  if (!flag || !path) return <>{children}</>;
  return <CalInline key={path} path={path} title={title} className={className} />;
}
