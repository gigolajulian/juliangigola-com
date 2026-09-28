"use client";

import * as React from "react";
import { DialRoot, useDialKit, type DialConfig } from "dialkit";
import { useDialKitStyles } from "@/lib/dialkit-styles";
import { highlightDials } from "@/lib/dial-highlight";
import { DialCopyAll } from "@/components/dial-copy-all";

/* ── a page's parts on DialKit ────────────────────────────────────
 * Julian: DialKit on About, Contact and Sessions, for the text, the
 * buttons and the rest: their size, where they sit, the words, the type,
 * the spacing, the alignment. Each part the page names (a label and the
 * selector that finds it) gets a folder:
 *
 *   size       the part and its type together, as a CSS `zoom`, so the
 *              page makes room for it rather than letting it overlap
 *   x, y       a nudge in px, as `translate`, which moves nothing else
 *   text       new words, tried in place (plain text parts only); empty
 *              puts the page's own back
 *   Type       letter spacing added in em, line height as a multiple,
 *              opacity
 *   Spacing    px added above and below, to the gap between its children,
 *              and a max width (0 is as it is)
 *   Align      the text's alignment, and a flex box's justify
 *
 * Everything starts where the page already is, read off the page the
 * first time, so nothing moves until a control does. The dev server only:
 * in production DialRoot renders nothing and this writes nothing, so a
 * pasted value is made the default in the stylesheet or the markup, as
 * the hero's are.
 * ─────────────────────────────────────────────────────────────── */

type PartSpec = string | { sel: string; text?: boolean };

const AS_IS = "as is";

const partConfig = (text: boolean) =>
  ({
    _collapsed: true,
    size: [1, 0.3, 3, 0.01],
    x: [0, -600, 600, 1],
    y: [0, -600, 600, 1],
    ...(text ? { text: { type: "text", default: "", placeholder: "as it is" } } : {}),
    type: {
      _collapsed: true,
      letterSpacing: [0, -0.2, 0.5, 0.005],
      lineHeight: [1, 0.5, 2.5, 0.01],
      opacity: [1, 0, 1, 0.01],
    },
    spacing: {
      _collapsed: true,
      above: [0, -200, 200, 1],
      below: [0, -200, 200, 1],
      gap: [0, -100, 200, 1],
      width: [0, 0, 1600, 10],
    },
    align: {
      _collapsed: true,
      text: {
        type: "select",
        options: [AS_IS, "left", "center", "right", "justify"],
        default: AS_IS,
      },
      justify: {
        type: "select",
        options: [AS_IS, "start", "center", "end", "space-between"],
        default: AS_IS,
      },
    },
  }) satisfies DialConfig;

type Part = {
  size: number;
  x: number;
  y: number;
  text?: string;
  type: { letterSpacing: number; lineHeight: number; opacity: number };
  spacing: { above: number; below: number; gap: number; width: number };
  align: { text: string; justify: string };
};

/** What a part was before any control touched it. */
type Was = {
  html: string;
  ls: number;
  lh: number;
  mt: number;
  mb: number;
  rowGap: number;
  colGap: number;
};

const sel = (s: PartSpec) => (typeof s === "string" ? s : s.sel);

/** Where the words are: down through a lone child (a crumb's link, a
    title's heading), so the element around them stays. */
const wordsOf = (el: HTMLElement) => {
  let t = el;
  // Only a child that holds all of it: a `<br>` among the words is not.
  while (t.childNodes.length === 1 && t.firstElementChild) t = t.firstElementChild as HTMLElement;
  return t;
};

export function PageDials({
  title,
  id,
  parts,
}: {
  /** The panel's name, as DialKit shows it. */
  title: string;
  id: string;
  /** Label (camelCase, which DialKit splits into words) to CSS selector,
      or to `{ sel, text: true }` for a part whose words can be changed. */
  parts: Record<string, PartSpec>;
}) {
  const config = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(parts).map(([k, s]) => [
          k,
          partConfig(typeof s !== "string" && !!s.text),
        ]),
      ) as DialConfig,
    [parts],
  );
  const values = useDialKit(title, config, { id }) as unknown as Record<string, Part>;
  const was = React.useRef(new WeakMap<HTMLElement, Was>());
  useDialKitStyles();

  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    for (const [label, spec] of Object.entries(parts)) {
      const v = values[label];
      if (!v) continue;
      for (const el of document.querySelectorAll<HTMLElement>(sel(spec))) {
        let w = was.current.get(el);
        if (!w) {
          const cs = getComputedStyle(el);
          const lh = parseFloat(cs.lineHeight);
          w = {
            html: wordsOf(el).innerHTML,
            ls: parseFloat(cs.letterSpacing) || 0,
            lh: Number.isFinite(lh) ? lh : parseFloat(cs.fontSize) * 1.2,
            mt: parseFloat(cs.marginTop) || 0,
            mb: parseFloat(cs.marginBottom) || 0,
            rowGap: parseFloat(cs.rowGap) || 0,
            colGap: parseFloat(cs.columnGap) || 0,
          };
          was.current.set(el, w);
        }
        const s = el.style;
        s.zoom = v.size === 1 ? "" : String(v.size);
        s.translate = v.x || v.y ? `${v.x}px ${v.y}px` : "";
        if (v.text !== undefined) {
          const words = wordsOf(el);
          if (v.text) words.textContent = v.text;
          else if (words.innerHTML !== w.html) words.innerHTML = w.html;
        }
        s.letterSpacing = v.type.letterSpacing ? `calc(${w.ls}px + ${v.type.letterSpacing}em)` : "";
        s.lineHeight = v.type.lineHeight === 1 ? "" : `${w.lh * v.type.lineHeight}px`;
        s.opacity = v.type.opacity === 1 ? "" : String(v.type.opacity);
        s.marginTop = v.spacing.above ? `${w.mt + v.spacing.above}px` : "";
        s.marginBottom = v.spacing.below ? `${w.mb + v.spacing.below}px` : "";
        s.gap = v.spacing.gap
          ? `${w.rowGap + v.spacing.gap}px ${w.colGap + v.spacing.gap}px`
          : "";
        s.maxWidth = v.spacing.width ? `${v.spacing.width}px` : "";
        s.textAlign = v.align.text === AS_IS ? "" : v.align.text;
        s.justifyContent = v.align.justify === AS_IS ? "" : v.align.justify;
      }
    }
  });

  /* Hovering a part's section on the panel boxes it on the page. DialKit
     titles a section by its key split into words ("sendButton" is "Send
     Button"); a section inside a part (Type, Spacing, Align) falls back
     to the part. */
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const byTitle = new Map(
      Object.entries(parts).map(([k, s]) => [
        k.replace(/([A-Z])/g, " $1").toLowerCase(),
        sel(s),
      ]),
    );
    return highlightDials((t) => byTitle.get(t) ?? null);
  }, [parts]);

  return (
    <>
      <DialRoot position="top-right" />
      <DialCopyAll />
    </>
  );
}
