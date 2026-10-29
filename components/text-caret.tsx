"use client";

import * as React from "react";

/* Over a text field the system I-beam gives way to a dot that draws itself
   out into a caret (Julian kept only this from the old cursor mark). The
   system pointer shows everywhere else; nothing tracks the pointer outside
   a field. Mouse only, and off under reduced motion. */

// Button-like inputs keep the system pointer.
const TEXT =
  "input:not([type=button],[type=submit],[type=reset],[type=checkbox],[type=radio],[type=range],[type=color],[type=file]), textarea, [contenteditable]:not([contenteditable=false])";

export function TextCaret() {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current!;
    let field: HTMLElement | null = null;
    const move = (e: PointerEvent) => void (el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`);
    const leave = () => {
      if (!field) return;
      field.removeAttribute("data-caret");
      field.removeEventListener("pointermove", move);
      field = null;
      el.removeAttribute("data-on");
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      // A modal dialog sits in the top layer, above the caret: keep the I-beam there.
      const t = (e.target as Element).closest?.<HTMLElement>(TEXT);
      if (t === field) return;
      leave();
      if (!t || t.closest("dialog:modal")) return;
      field = t;
      move(e);
      t.setAttribute("data-caret", "");
      t.addEventListener("pointermove", move);
      el.setAttribute("data-on", "");
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerleave", leave);
    return () => {
      leave();
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerleave", leave);
    };
  }, []);
  return (
    <div ref={ref} className="text-caret" aria-hidden>
      <i />
    </div>
  );
}
