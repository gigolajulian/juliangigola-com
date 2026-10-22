"use client";

import { useEffect } from "react";

/* No paragraph ends on one word, in any browser (Julian, 2026-10-22: "so
 * it's never wrong"). `text-wrap: pretty` (font-v2.css) does most of it,
 * but Chromium skips long paragraphs and Firefox has none. So each prose
 * paragraph's last two words are joined by a no-break space, once it is on
 * the page and again whenever React writes new text. Same skips as the CSS. */
const PROSE = 'p:not(.label, .font-display, .whitespace-nowrap)';

function join(p: Element) {
  const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (/\S/.test(n.nodeValue ?? "")) last = n as Text;
  if (!last) return;
  const v = last.nodeValue ?? "";
  const end = v.trimEnd();
  const gap = end.search(/\s\S+$/);
  // One word in this node, or already joined: leave it.
  if (gap <= 0 || end[gap] === " " || !end.slice(0, gap).trim()) return;
  last.nodeValue = end.slice(0, gap) + " " + end.slice(gap + 1) + v.slice(end.length);
}

export function RagGuard() {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      frame = 0;
      document.querySelectorAll(PROSE).forEach(join);
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    run();
    const watch = new MutationObserver(soon);
    watch.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      watch.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
