/* ?mtpick=1, a tool for Julian and nobody else: pick the second each film's preview on the home starts at.
   One mono line on the Motion screen: the current film, its start second (drag it sideways, or arrow keys on it),
   and "copy", which puts every film's value on the clipboard to paste back as FILM_DRESS[title].at (data.ts).
   Loaded only with the flag (rows.ts), so none of it is in the home's own code. */
const AT = /#t=(\d+)s|([?&]start=)(\d+)/;

export function filmPick(el: HTMLElement, items: HTMLElement[], reload: (i: number) => void, signal: AbortSignal) {
  const title = (i: number) => (items[i].getAttribute("aria-label") ?? "").split(", ")[0];
  const read = (i: number) => {
    const m = AT.exec(items[i].dataset.preview ?? "");
    return m ? +(m[1] ?? m[3]) : 0;
  };
  const at = items.map((_, i) => read(i));
  const cur = () => +(el.dataset.cur ?? 0);

  const bar = document.createElement("div");
  bar.style.cssText = "position:absolute;z-index:6;left:50%;bottom:16px;translate:-50% 0;display:flex;gap:18px;align-items:center;padding:6px 10px;font:400 11px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:#fff;background:rgb(0 0 0 / .7);user-select:none";
  const name = document.createElement("span");
  const num = document.createElement("button");
  num.type = "button";
  num.style.cssText = "all:unset;cursor:ew-resize;padding:4px 6px;border-bottom:1px solid currentColor;min-width:4ch;text-align:right;touch-action:none";
  num.setAttribute("aria-label", "Start second: drag sideways or use the arrow keys");
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "copy";
  copy.style.cssText = "all:unset;cursor:pointer;padding:4px 6px;opacity:.75";
  bar.append("start", name, num, copy);
  el.querySelector(".mt-stage")?.append(bar);

  const draw = () => {
    name.textContent = title(cur());
    num.textContent = at[cur()] + "s";
  };
  // the player is rebuilt at the new second: both providers take the start from the URL
  const apply = (i: number) => {
    const src = items[i].dataset.preview;
    if (!src) return;
    items[i].dataset.preview = src.replace(AT, (_m, v, yt) => (v !== undefined ? `#t=${at[i]}s` : `${yt}${at[i]}`));
    reload(i);
  };
  let t = 0;
  const set = (v: number) => {
    const i = cur();
    at[i] = Math.max(0, Math.round(v));
    draw();
    clearTimeout(t);
    t = window.setTimeout(() => apply(i), 400); // once the value rests: a player per step would stack up
  };

  let from: { x: number; v: number } | null = null;
  num.addEventListener("pointerdown", (e) => {
    from = { x: e.clientX, v: at[cur()] };
    num.setPointerCapture(e.pointerId);
  }, { signal });
  num.addEventListener("pointermove", (e) => from && set(from.v + (e.clientX - from.x) / 6), { signal }); // 6px a second
  num.addEventListener("pointerup", () => (from = null), { signal });
  num.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    set(at[cur()] + d * (e.shiftKey ? 10 : 1));
  }, { signal });
  copy.addEventListener("click", () => {
    const out = JSON.stringify(Object.fromEntries(items.map((_, i) => [title(i), at[i]])));
    void navigator.clipboard?.writeText(out);
    copy.textContent = "copied";
    setTimeout(() => (copy.textContent = "copy"), 1200);
  }, { signal });

  const mo = new MutationObserver(draw);
  mo.observe(el, { attributeFilter: ["data-cur"] });
  signal.addEventListener("abort", () => (mo.disconnect(), clearTimeout(t), bar.remove()));
  draw();
}
