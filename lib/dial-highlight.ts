/* Julian: hovering a section of a DialKit panel draws a box round what it
   changes on the page. The innermost section that names something wins;
   one that does not falls back to the section around it. Fainter than it
   was (Julian: lower the opacity), so what it points at still reads
   through it. `targetFor` takes a section's title as the panel prints it,
   lowercased, and gives the selector it moves, or null. The dev server
   only: returns a cleanup. */
export function highlightDials(targetFor: (title: string) => string | null) {
  const layer = document.createElement("div");
  layer.style.cssText = "position:fixed;inset:0;z-index:9998;pointer-events:none";
  document.body.append(layer);
  let on: string | null = null;
  let raf = 0;
  const draw = () => {
    const boxes = on ? [...document.querySelectorAll<HTMLElement>(on)] : [];
    while (layer.children.length > boxes.length) layer.lastChild!.remove();
    boxes.forEach((b, i) => {
      const r = b.getBoundingClientRect();
      const box =
        (layer.children[i] as HTMLElement | undefined) ??
        layer.appendChild(document.createElement("div"));
      box.style.cssText = `position:absolute;left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px;outline:1.5px solid rgb(255 212 0 / 0.45);background:rgb(255 212 0 / 0.04)`;
    });
    // What it points at can move under it, so the boxes follow each frame.
    raf = on ? requestAnimationFrame(draw) : 0;
  };
  const over = (e: PointerEvent) => {
    let next: string | null = null;
    for (
      let f: Element | null | undefined = (e.target as Element).closest?.(".dialkit-folder");
      f && !next;
      f = f.parentElement?.closest(".dialkit-folder")
    ) {
      const title = f
        .querySelector(":scope > .dialkit-folder-header .dialkit-folder-title")
        ?.textContent?.trim()
        .toLowerCase();
      if (title) next = targetFor(title);
    }
    if (next === on) return;
    on = next;
    if (on && !raf) raf = requestAnimationFrame(draw);
    if (!on) draw();
  };
  document.addEventListener("pointerover", over);
  return () => {
    document.removeEventListener("pointerover", over);
    cancelAnimationFrame(raf);
    layer.remove();
  };
}
