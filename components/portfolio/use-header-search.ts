"use client";

import * as React from "react";

/** The search row and its header twin: what is typed, the row taking focus, the phone view set folding, and the
    header tools pinning in as the row scrolls under the header. */
export function useHeaderSearch(canvas: boolean, at: number | null) {
  // The field keeps what is typed, spaces too; only the match trims (live ate the space in "brand campaigns").
  const [raw, setRaw] = React.useState("");
  const q = raw.trim().toLowerCase();
  // Touch: the field owns the row while it has focus (views step aside, the close x slides in).
  const [rowOn, setRowOn] = React.useState(false);
  // Phone: Grid, Strip and Canvas fold into the one that is on; a tap on it unfolds them.
  const [unfold, setUnfold] = React.useState(false);
  /* Option 2: once the search row scrolls under the
     header, a magnifier and the view buttons ride in the header instead of a
     second sticky bar. data-pft tells v3.css to keep them pinned when the
     header tucks on touch screens. */
  // State, not a ref: the row can remount (desktop did), and the observer must follow it.
  const [tools, setTools] = React.useState<HTMLDivElement | null>(null);
  const [pin, setPin] = React.useState(false);
  const [hs, setHs] = React.useState(false);
  // Esc or the X hands focus back to the magnifier it opened from (audit 2, WCAG 2.4.3).
  const refocus = React.useRef(false);
  const close = () => {
    refocus.current = true;
    // The header x clears, as the row's x does and as the approved mock did.
    setRaw("");
    setHs(false);
    // With the row back on screen the header tools must go too, not wait for the next scroll.
    dispatchEvent(new Event("scroll"));
  };
  React.useEffect(() => {
    if (!tools) return;
    // On the header slot, not <html>: a root custom property changing per frame restyles the whole grid.
    const root = document.getElementById("hdr-tools") ?? document.documentElement;
    let raf = 0;
    /* The header tools join 1:1 with the scroll: --pp runs 0 to 1 while the row slides
       under the 60px header, and v3.css rises and fades them on it. No timer, so a
       stop half way leaves them half way and scrolling back reverses them. */
    const sync = () => {
      raf = 0;
      const r = tools.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (60 - r.top) / (r.height || 1)));
      root.style.setProperty("--pp", p.toFixed(3));
      const on = p > 0;
      // iOS scrolls the page as the keyboard rises: with nothing typed yet, the open header bar stays (QA).
      const f = document.activeElement as HTMLInputElement | null;
      if (!on && f?.closest(".htools") && !f.value) return;
      // Typing in the row and scrolling it away hands the field to the header, so it stays on screen
      // with the keyboard up (MAC, iPhone); the reverse hand-back is below.
      if (p >= 1 && f?.tagName === "INPUT" && tools.contains(f)) setHs(true);
      setPin(on);
      if (on) return;
      // A short result list brings the row back: typing carries on in its field.
      if (f?.closest(".htools")) tools.querySelector("input")?.focus({ preventScroll: true });
      setHs(false);
    };
    const tick = () => void (raf ||= requestAnimationFrame(sync));
    sync();
    addEventListener("scroll", tick, { passive: true });
    addEventListener("resize", tick);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", tick);
      removeEventListener("resize", tick);
      root.style.removeProperty("--pp");
    };
  }, [tools]);
  /* / or Ctrl/Cmd+K jumps to search, never while typing somewhere else; with the row
     scrolled away it opens the header field. */
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"))) return;
      if (e.altKey || e.isComposing || !tools || canvas || at !== null) return;
      if ((e.target as HTMLElement | null)?.closest?.("input,textarea,select,[contenteditable],dialog")) return;
      e.preventDefault();
      if (!pin) tools.querySelector("input")?.focus();
      else if (hs) document.querySelector<HTMLInputElement>(".htools input")?.focus();
      else setHs(true);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [pin, hs, tools, canvas, at]);
  // An unfolded view set folds again on any tap outside it.
  React.useEffect(() => {
    if (!unfold) return;
    const away = (e: PointerEvent) => !(e.target as HTMLElement).closest?.(".vset") && setUnfold(false);
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [unfold]);
  // iOS pans the visual viewport as the keyboard rises, carrying a top:0 fixed bar off screen: follow the pan (QA).
  React.useEffect(() => {
    const vv = window.visualViewport;
    const el = document.querySelector<HTMLElement>(".htools");
    if (!hs || !pin || !vv || !el) return;
    const set = () => {
      // Vars, not inline translate/padding: v3.css applies them only while the header is tucked, so a
      // rotation that untucks it drops them at once (MAC, Duo).
      el.style.setProperty("--vvy", `${vv.offsetTop}px`);
      // Panned by the keyboard, the visual viewport already starts below the browser bar: no safe-area pad on top of it.
      el.style.setProperty("--vvpad", vv.offsetTop > 0 ? "0px" : "");
    };
    set();
    vv.addEventListener("scroll", set);
    vv.addEventListener("resize", set);
    return () => {
      vv.removeEventListener("scroll", set);
      vv.removeEventListener("resize", set);
      el.style.removeProperty("--vvy");
      el.style.removeProperty("--vvpad");
    };
  }, [hs, pin]);
  React.useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-pft", pin);
    return () => root.removeAttribute("data-pft");
  }, [pin]);
  return { raw, setRaw, q, rowOn, setRowOn, unfold, setUnfold, tools, setTools, pin, hs, setHs, refocus, close };
}
