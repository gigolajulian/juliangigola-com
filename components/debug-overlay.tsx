"use client";

import * as React from "react";

/* ── the debug overlay ────────────────────────────────────────────
 * Only with `?debug`, through `debug-gate.tsx`. Three things, for testing
 * on a phone or an iPad where there are no dev tools:
 * - fps, counted over each half second.
 * - a dot under every finger on the glass.
 * - a frame log: every long frame with its time and the scroll position
 *   of the active strip, plus each finger down and up, so a hitch can be
 *   lined up with the gesture that caused it. "Copy" puts it on the
 *   clipboard as plain text.
 * Nothing is sent anywhere. Styles are inline so the overlay brings
 * nothing into `globals.css`.
 * ─────────────────────────────────────────────────────────────── */

/** A frame longer than this, ms, is logged: two frames at 60Hz. */
const LONG = 34;
/** How many lines the log keeps, oldest dropped first. */
const KEEP = 400;
/** How many lines the panel shows. */
const SHOWN = 8;
/** Finger dots kept ready; a sixth finger is not drawn. */
const DOTS = 5;

type Line = { at: number; text: string };

/** The strip being moved: the last `.strip-scroll` that scrolled, or the
    one across the middle of the window before any has. */
function activeStrip(last: HTMLElement | null) {
  if (last?.isConnected) return last;
  const mid = window.innerHeight / 2;
  for (const el of document.querySelectorAll<HTMLElement>(".strip-scroll")) {
    const r = el.getBoundingClientRect();
    if (r.top <= mid && r.bottom >= mid) return el;
  }
  return null;
}

export function DebugOverlay() {
  const fpsRef = React.useRef<HTMLSpanElement>(null);
  const dotsRef = React.useRef<HTMLDivElement>(null);
  const log = React.useRef<Line[]>([]);
  const [shown, setShown] = React.useState<Line[]>([]);
  const [copied, setCopied] = React.useState("");

  React.useEffect(() => {
    let strip: HTMLElement | null = null;
    let dirty = false;
    const add = (text: string) => {
      log.current.push({ at: performance.now(), text });
      if (log.current.length > KEEP) log.current.shift();
      dirty = true;
    };
    const where = () => {
      const s = activeStrip(strip);
      return s ? `x=${Math.round(s.scrollLeft)}` : "x=-";
    };

    // Frames: fps over each half second, and a line for every long one.
    let raf = 0;
    let prev = 0;
    let count = 0;
    let since = 0;
    const tick = (now: number) => {
      if (prev && now - prev > LONG) add(`long ${Math.round(now - prev)}ms ${where()}`);
      prev = now;
      count++;
      if (!since) since = now;
      if (now - since >= 500) {
        if (fpsRef.current)
          fpsRef.current.textContent = `${Math.round((count * 1000) / (now - since))} fps`;
        count = 0;
        since = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // The strip that last scrolled is the active one.
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLElement && t.classList.contains("strip-scroll")) strip = t;
    };

    // Fingers: a dot at each, and a line on each down and up.
    const onTouch = (e: TouchEvent) => {
      const box = dotsRef.current;
      if (box) {
        Array.from(box.children).forEach((c, i) => {
          const dot = c as HTMLElement;
          const t = e.touches[i];
          if (!t) {
            dot.style.display = "none";
            return;
          }
          dot.style.display = "block";
          dot.style.transform = `translate(${t.clientX - 22}px, ${t.clientY - 22}px)`;
        });
      }
      if (e.type === "touchstart") {
        const t = e.changedTouches[0];
        add(`down ${Math.round(t.clientX)},${Math.round(t.clientY)} n=${e.touches.length} ${where()}`);
      } else if (e.type === "touchend" || e.type === "touchcancel") {
        const t = e.changedTouches[0];
        add(`${e.type === "touchend" ? "up" : "cancel"} ${Math.round(t.clientX)},${Math.round(t.clientY)} n=${e.touches.length} ${where()}`);
      }
    };
    const opts = { capture: true, passive: true } as const;
    document.addEventListener("scroll", onScroll, opts);
    for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"])
      window.addEventListener(type, onTouch as EventListener, opts);

    // The panel's lines catch up twice a second, not every frame.
    const show = window.setInterval(() => {
      if (!dirty) return;
      dirty = false;
      setShown(log.current.slice(-SHOWN));
    }, 500);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(show);
      document.removeEventListener("scroll", onScroll, opts);
      for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"])
        window.removeEventListener(type, onTouch as EventListener, opts);
    };
  }, []);

  const copy = async () => {
    const text = [
      `${location.href}`,
      `${navigator.userAgent}`,
      `${window.innerWidth}x${window.innerHeight} dpr=${window.devicePixelRatio}`,
      ...log.current.map((l) => `${l.at.toFixed(1)} ${l.text}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("copied");
    } catch {
      // No clipboard API (an insecure origin on the LAN): select and copy.
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      setCopied(ok ? "copied" : "copy failed");
    }
    window.setTimeout(() => setCopied(""), 1500);
  };

  return (
    <div data-debug-overlay style={{ position: "fixed", inset: 0, zIndex: 2147483647, pointerEvents: "none" }}>
      <div ref={dotsRef} aria-hidden>
        {Array.from({ length: DOTS }, (_, i) => (
          <div
            key={i}
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(255, 60, 60, 0.35)",
              border: "2px solid rgba(255, 60, 60, 0.9)",
              display: "none",
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: "fixed",
          left: 8,
          bottom: "calc(8px + env(safe-area-inset-bottom))",
          maxWidth: "calc(100vw - 16px)",
          padding: "6px 8px",
          background: "rgba(0, 0, 0, 0.78)",
          color: "#fff",
          font: "11px/1.35 ui-monospace, monospace",
          borderRadius: 6,
          pointerEvents: "auto",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span ref={fpsRef}>- fps</span>
          <button
            type="button"
            onClick={copy}
            style={{ font: "inherit", color: "inherit", background: "rgba(255,255,255,0.15)", border: 0, borderRadius: 4, padding: "2px 6px" }}
          >
            Copy log
          </button>
          <button
            type="button"
            onClick={() => {
              log.current = [];
              setShown([]);
            }}
            style={{ font: "inherit", color: "inherit", background: "rgba(255,255,255,0.15)", border: 0, borderRadius: 4, padding: "2px 6px" }}
          >
            Clear
          </button>
          <span>{copied}</span>
        </div>
        {shown.map((l, i) => (
          <div key={`${l.at}-${i}`} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {(l.at / 1000).toFixed(2)}s {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
