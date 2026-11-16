/* Hover lift for a `.mt-sleeve` (fine pointers): `.hv` while the pointer is on it and a tilt toward the pointer, up to
   9deg each way. rows.css does the rest. Shared by the home's Cover art row (rows.ts) and the Cover art page. */
const half = (v: number) => Math.max(-0.5, Math.min(0.5, v - 0.5));

export function sleeveTilt(it: HTMLElement, ok: () => boolean, on?: AddEventListenerOptions) {
  it.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" || !ok()) return;
    const r = it.getBoundingClientRect();
    it.classList.add("hv");
    it.style.setProperty("--ry", (half((e.clientX - r.left) / r.width) * 18).toFixed(2) + "deg");
    it.style.setProperty("--rx", (half((e.clientY - r.top) / r.height) * -18).toFixed(2) + "deg");
  }, on);
  it.addEventListener("pointerleave", () => {
    it.classList.remove("hv");
    it.style.removeProperty("--rx");
    it.style.removeProperty("--ry");
  }, on);
}
