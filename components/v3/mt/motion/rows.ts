import { shiftScroll } from "@/components/v3/smooth-scroll";
import { clamp, type Driver } from "./engine";

/* Cover art and Motion (spec 3.7, 3.8). On the desktop structure the page
   scroll walks the row sideways; everywhere else the native snap row stays. */

const RISE: KeyframeAnimationOptions = { duration: 600, easing: "cubic-bezier(.16,1,.3,1)" };

function heldRow(name: string, covers: boolean): Driver {
  let frame: (p: number) => void = () => {};
  return {
    name,
    frame: (p) => frame(p),
    setup(el, ctx) {
      const row = el.querySelector<HTMLElement>(".mt-row")!;
      const track = row.firstElementChild as HTMLElement;
      const items = [...track.children] as HTMLElement[];
      const n = items.length;
      if (n < 2) return;
      const ac = new AbortController();
      const on = { signal: ac.signal };
      const o: number[] = Array(n).fill(-1);
      let step = 1, c0 = 0, mid = 0, range = 0, cur = -1, base = 0, lastX = NaN;

      const measure = () => {
        const a = items[0].getBoundingClientRect();
        step = items[1].getBoundingClientRect().left - a.left;
        c0 = row.getBoundingClientRect().left + parseFloat(getComputedStyle(row).paddingLeft) + a.width / 2;
        mid = innerWidth / 2;
        range = el.offsetHeight - innerHeight;
        cur = -1;
        lastX = NaN;
      };

      /* Record rule: out at the stage centre, back in the sleeve `fall` px away. */
      const discs = (x: number, fall: number) => {
        for (let i = 0; i < n; i++) {
          const v = Math.round(clamp(1 - Math.abs(c0 + i * step - x - mid) / fall) * 1000) / 1000;
          if (v !== o[i]) items[i].style.setProperty("--o", String((o[i] = v)));
        }
      };
      // Snap rows: the disc only exists on the current sleeve, which changes at half a step, so it is back in by then.
      const loose = () => {
        if (covers && !ctx.held) discs(row.scrollLeft, step / 2);
      };

      /* Preview: one muted iframe in the current film, 300ms after it becomes
         current, gone when the film or the section leaves. The poster stays on
         top until the player says it plays (same wait as video.tsx Loop). */
      let pv: HTMLIFrameElement | null = null, pvT = 0, readyT = 0, seen = false;
      const drop = () => {
        clearTimeout(pvT);
        clearTimeout(readyT);
        pv?.remove();
        pv = null;
      };
      const preview = () => {
        drop();
        const film = items[cur], src = film?.dataset.preview;
        if (covers || !src || !seen || !ctx.held) return;
        pvT = window.setTimeout(() => {
          const yt = src.includes("youtube");
          const f = (pv = document.createElement("iframe"));
          f.src = src + (yt ? "&enablejsapi=1" : "");
          f.allow = "autoplay";
          f.tabIndex = -1;
          f.setAttribute("aria-hidden", "true");
          f.onload = () => {
            if (yt) f.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
            else readyT = window.setTimeout(() => f.setAttribute("data-ready", ""), 2500);
          };
          film.append(f);
        }, 300);
      };
      addEventListener("message", (e) => {
        if (!pv || e.source !== pv.contentWindow) return;
        let m;
        try { m = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
        const state = m?.event === "onStateChange" ? m.info : m?.event === "infoDelivery" ? m.info?.playerState : undefined;
        if (typeof state !== "number") return;
        clearTimeout(readyT);
        const f = pv;
        if (state === 1) readyT = window.setTimeout(() => f.setAttribute("data-ready", ""), 2500);
        else f.removeAttribute("data-ready");
      }, on);
      const io = new IntersectionObserver(([e]) => {
        seen = e.isIntersecting;
        if (seen && cur >= 0) preview();
        else drop();
      });
      if (!covers) io.observe(el);

      frame = (p) => {
        const i = Math.round(p * (n - 1)), x = p * (n - 1) * step;
        if (i !== cur) {
          // The row's own scroll steps item by item so held-row.tsx names the current one; the transform carries the rest.
          row.scrollLeft = i * step;
          base = row.scrollLeft;
          cur = i;
          preview();
        } else if (x === lastX) return;
        lastX = x;
        track.style.transform = `translate3d(${(base - x).toFixed(2)}px,0,0)`;
        if (covers) discs(x, 420 * ctx.u);
      };

      // The title line rises when held-row.tsx commits the new item.
      const mo = new MutationObserver(() => {
        if (ctx.held) el.querySelector(".mt-ttl .ln > span")?.animate([{ transform: "translateY(110%)" }, { transform: "none" }], RISE);
      });
      mo.observe(el, { attributeFilter: ["data-cur"] });

      /* Sideways drag moves the page scroll, so the two never disagree. */
      const top = () => el.getBoundingClientRect().top + scrollY;
      let down: number | null = null, downY = 0, dragged = false;
      row.addEventListener("pointerdown", (e) => {
        if (!ctx.held || e.button) return;
        down = e.clientX;
        downY = scrollY;
        dragged = false;
      }, on);
      row.addEventListener("pointermove", (e) => {
        if (down === null) return;
        if (!e.buttons) return void (down = null);
        const dx = e.clientX - down;
        if (!dragged && Math.abs(dx) < 6) return;
        if (!dragged) row.setPointerCapture(e.pointerId);
        dragged = true;
        // From the drag's start, not step by step: scrollY rounds and the error would add up.
        const t = top();
        shiftScroll(clamp(downY - (dx * range) / ((n - 1) * step), t, t + range) - scrollY);
      }, on);
      const up = () => void (down = null);
      row.addEventListener("pointerup", up, on);
      row.addEventListener("pointercancel", up, on);
      row.addEventListener("click", (e) => {
        if (!dragged) return;
        dragged = false;
        e.preventDefault();
        e.stopPropagation();
      }, { capture: true, signal: ac.signal });
      row.addEventListener("dragstart", (e) => { if (ctx.held) e.preventDefault(); }, on);

      // Tab to a film: the browser scrolls the hidden row to show it. Put that back and move the page there instead.
      row.addEventListener("focusin", (e) => {
        const t = e.target as Element, i = items.indexOf(t.closest<HTMLElement>(".mt-item")!);
        if (!ctx.held || i < 0 || !t.matches(":focus-visible")) return;
        row.scrollLeft = base;
        shiftScroll(top() + (i / (n - 1)) * range - scrollY);
      }, on);

      row.addEventListener("scroll", loose, { passive: true, signal: ac.signal });

      /* Hover lift (fine pointers): tilt toward the pointer, up to 9deg each way. rows.css does the rest. */
      if (covers) for (const it of items) {
        it.addEventListener("pointermove", (e) => {
          if (!ctx.held || !ctx.fine || e.pointerType === "touch" || dragged) return;
          const r = it.getBoundingClientRect();
          it.classList.add("hv");
          it.style.setProperty("--ry", (clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5) * 18).toFixed(2) + "deg");
          it.style.setProperty("--rx", (clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5) * -18).toFixed(2) + "deg");
        }, on);
        it.addEventListener("pointerleave", () => {
          it.classList.remove("hv");
          it.style.removeProperty("--rx");
          it.style.removeProperty("--ry");
        }, on);
      }

      // After the engine's own resize pass, so ctx is current.
      addEventListener("resize", () => requestAnimationFrame(() => {
        measure();
        if (ctx.held) return;
        track.style.transform = "";
        drop();
        loose();
      }), on);

      measure();
      loose();
      return () => {
        ac.abort();
        mo.disconnect();
        io.disconnect();
        drop();
        frame = () => {};
        track.style.transform = "";
        for (const it of items) {
          it.classList.remove("hv");
          if (covers) it.style.setProperty("--o", "0.5");
        }
      };
    },
  };
}

export const rowsDrivers: Driver[] = [heldRow("covers", true), heldRow("motion", false)];
