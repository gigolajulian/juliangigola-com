"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/* ── the visit trail ──────────────────────────────────────────────
 * Julian (2026-10-14): an inquiry says where its sender came from and
 * what they read first, without asking them. Where they landed (with
 * the referrer and any utm_ tags) and the last pages and screens they
 * opened, kept for this tab only (sessionStorage) and sent with the
 * form (`contact-form.tsx`, `trailContext`). Nothing leaves the browser
 * unless they send an inquiry.
 * ─────────────────────────────────────────────────────────────── */

const KEEP = 12;

const read = <T,>(key: string): T | null => {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

export function VisitTrail() {
  const pathname = usePathname();
  React.useEffect(() => {
    if (!read("jg-landing")) {
      const q = new URLSearchParams(location.search);
      const utm = [...q].filter(([k]) => k.startsWith("utm_")).map(([k, v]) => `${k.slice(4)}=${v}`).join(" ");
      write("jg-landing", { path: location.pathname + location.hash, referrer: document.referrer, utm });
    }
    const note = () => {
      const here = location.pathname + location.hash;
      const trail = read<string[]>("jg-trail") ?? [];
      if (trail[trail.length - 1] !== here) write("jg-trail", [...trail, here].slice(-KEEP));
    };
    note();
    window.addEventListener("hashchange", note);
    return () => window.removeEventListener("hashchange", note);
  }, [pathname]);
  return null;
}

/** What goes with an inquiry: the page it was sent from, where the visit
    began, the trail, and the kind of device. */
export function trailContext(): string {
  const device = matchMedia("(max-width: 39.99rem)").matches ? "phone" : matchMedia("(pointer: coarse)").matches ? "tablet" : "desktop";
  return JSON.stringify({
    page: location.pathname + location.hash,
    ...(read<object>("jg-landing") ?? {}),
    trail: read<string[]>("jg-trail") ?? [],
    device,
  });
}
