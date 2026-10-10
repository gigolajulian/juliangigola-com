"use client";

import * as React from "react";
import { useSiteTheme } from "@/lib/site-theme";

/* ── Cal.com, inline ──────────────────────────────────────────────
 * The booking calendar, from Cal.com (`book.cal`, `lib/booking.ts`).
 * Cal.com's script loads only once the calendar is on screen, and takes
 * the site's own colours in either theme (`.cal-embed`, globals.css).
 *
 * If Cal.com does not arrive (blocked, down, or an event it does not
 * know), a link to book on Cal.com and the address take its place, inside
 * 4 seconds of the calendar coming on screen.
 * ─────────────────────────────────────────────────────────────── */

const ORIGIN = "https://app.cal.com";
const SCRIPT = `${ORIGIN}/embed/embed.js`;
const EMAIL = "hello@juliangigola.com";
/** How long Cal.com has to show its page before the way round it shows. */
const PATIENCE = 3500;

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

/* The script, added once. If it failed before, it is tried again. Calls
   `failed` if it cannot be fetched; returns how to stop listening. */
let script: HTMLScriptElement | null = null;
let scriptFailed = false;
function load(failed: () => void): () => void {
  if (script && scriptFailed) {
    script.remove();
    script = null;
  }
  if (!script) {
    scriptFailed = false;
    script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.addEventListener("error", () => {
      scriptFailed = true;
    });
    document.head.appendChild(script);
  }
  const s = script;
  s.addEventListener("error", failed);
  return () => s.removeEventListener("error", failed);
}

/* The site's colours, as the page has them now, for Cal.com's own
   variables. The ground is left clear, so the card it sits in shows. */
function look() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const vars = {
    "cal-bg": "transparent",
    "cal-bg-muted": "transparent",
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
  return { theme, cssVarsPerTheme: { light: vars, dark: vars }, layout: "month_view", hideBranding: true };
}

let mounts = 0;

/** Cal.com's calendar for one event, in a box sized like the frame it
    replaces, with a link and the address if it does not arrive. */
function CalInline({ path, title, className }: { path: string; title: string; className?: string }) {
  const box = React.useRef<HTMLDivElement>(null);
  const host = React.useRef<HTMLDivElement>(null);
  const ns = React.useRef<string | null>(null);
  const [state, setState] = React.useState<"waiting" | "ready" | "failed">("waiting");
  const theme = useSiteTheme();

  React.useEffect(() => {
    const el = box.current;
    const into = host.current;
    if (!el || !into) return;
    let timer: number | undefined;
    let stop = () => {};
    /* Not before it is on screen: a session page's Book screen is the
       last of the deck. */
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seen.disconnect();
      const name = `jg${++mounts}`;
      ns.current = name;
      timer = window.setTimeout(() => setState((s) => (s === "ready" ? s : "failed")), PATIENCE);
      const cal = stub();
      stop = load(() => setState((s) => (s === "ready" ? s : "failed")));
      cal("init", name, { origin: ORIGIN });
      const api = cal.ns![name];
      const ui = look();
      api("inline", { elementOrSelector: into, calLink: path, config: { layout: ui.layout, theme: ui.theme } });
      api("ui", ui);
      api("on", {
        action: "linkReady",
        callback: () => {
          window.clearTimeout(timer);
          setState("ready");
        },
      });
      api("on", {
        action: "linkFailed",
        callback: () => {
          window.clearTimeout(timer);
          setState("failed");
        },
      });
    });
    seen.observe(el);
    return () => {
      seen.disconnect();
      window.clearTimeout(timer);
      stop();
    };
  }, [path]);

  /* The site's switch flips the calendar with it. */
  React.useEffect(() => {
    const name = ns.current;
    if (name) window.Cal?.ns?.[name]?.("ui", look());
  }, [theme]);

  return (
    <div ref={box} data-cal={state} aria-label={title} role="region" className={`cal-embed relative ${className ?? ""}`}>
      <div ref={host} className={`h-full w-full overflow-y-auto overscroll-contain ${state === "failed" ? "invisible" : ""}`} />
      {state === "failed" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
          <p className="max-w-[24rem] text-balance text-center text-sm normal-case leading-relaxed text-muted-foreground">
            The calendar did not load here. Pick a time on Cal.com, or write to me.
          </p>
          <a
            href={`https://cal.com/${path}`}
            target="_blank"
            rel="noreferrer"
            className="label inline-block action px-6 py-4 press active:scale-[0.97]"
          >
            Book on Cal.com
          </a>
          <a
            href={`mailto:${EMAIL}`}
            className="inline-block border-b border-border text-sm uppercase leading-none tracking-[0.04em] transition-colors duration-200 hoverable:hover:border-current"
          >
            {EMAIL}
          </a>
        </div>
      ) : null}
    </div>
  );
}

/** Cal.com's calendar for `path`. `className` sizes the box. */
export function CalEmbed({ path, title, className }: { path: string; title: string; className?: string }) {
  return <CalInline key={path} path={path} title={title} className={className} />;
}
