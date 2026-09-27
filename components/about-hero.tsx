"use client";

import * as React from "react";
import { Inter_Tight } from "next/font/google";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";

/* Every weight of the display face, for this page only: the first name
   swells letter by letter, so it needs the axis, not the one Black cut the
   rest of the site loads. */
const axis = Inter_Tight({
  subsets: ["latin"],
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

/* ── the about page's first screen ────────────────────────────────
 * Julian: his portrait in a fine grain of greys on the dark, with soft
 * lights swelling and fading behind in the same grain; the pointer pushes the grain
 * aside round it and pushes the lights aside. The first name thin, each letter
 * swelling toward the pointer; the surname in Black and the accent.
 *
 * Drawn on the GPU (ogl, as `warp-text.tsx`): at a grain this fine the
 * whole screen is redrawn every frame, which a canvas loop could not keep
 * up with. Dark in both themes, like a photograph.
 * ─────────────────────────────────────────────────────────────── */

/** The grain: one dithered cell every this many CSS pixels. */
/* Julian: a little less detail than 2.5 and 2. */
const CELL_WIDE = 3.2;
const CELL_PHONE = 2.6;
/** Where Julian stands across the photograph, and where that is held on
    screen: further in on a phone so the crop never cuts him. */
const FOCUS = 0.78;
const HOLD_WIDE = 0.74;
const HOLD_PHONE = 0.62;

const vertex = `#version 300 es
in vec2 position;
in vec2 uv;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uPhoto;
uniform vec2 uRes;      // CSS pixels
uniform float uDpr;
uniform float uCell;
uniform float uTime;
uniform vec2 uPointer;  // CSS pixels, from the top left
uniform float uOn;
uniform vec4 uRect;     // the photograph: x, y, width, height in CSS pixels
uniform sampler2D uMask; // where he is in the photograph, soft edged
uniform vec2 uFade;     // the photograph fades out between these heights
out vec4 fragColor;

const vec3 GROUND = vec3(0.043);
const vec3 INK = vec3(0.91, 0.90, 0.875);
const float LEVELS = 4.0;

// 8x8 ordered dither threshold, 0..1.
float bayer(ivec2 p) {
  int x = p.x & 7;
  int y = p.y & 7;
  int xy = x ^ y;
  int v = ((xy & 1) << 5) | ((x & 1) << 4) | ((xy & 2) << 2) |
          ((x & 2) << 1) | ((xy & 4) >> 1) | ((x & 4) >> 2);
  return (float(v) + 0.5) / 64.0;
}

// Smooth value noise in 3D, for the lights.
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
        mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
        mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

// A tone, dithered to one of LEVELS greys.
float quant(float v, float t) {
  float s = clamp(v, 0.0, 1.0) * (LEVELS - 1.0);
  float b = floor(s);
  return (b + step(t, s - b)) / (LEVELS - 1.0);
}

// How much of the photograph shows at a height: all of it, bar the foot
// of a phone's portrait, which fades out above the name.
float fade(vec2 p) {
  return 1.0 - smoothstep(uFade.x, uFade.y, p.y);
}

bool outside(vec2 uv) {
  return any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)));
}

// The photograph's brightness at a point, the grey backdrop taken to black.
float lum(vec2 p) {
  vec2 uv = (p - uRect.xy) / uRect.zw;
  if (outside(uv)) return 0.0;
  float l = dot(texture(uPhoto, uv).rgb, vec3(0.2126, 0.7152, 0.0722));
  return pow(clamp((l - 0.14) / 0.62, 0.0, 1.0), 0.9) * fade(p);
}

// Him: 1 where he stands, 0 on the backdrop.
float body(vec2 p) {
  vec2 uv = (p - uRect.xy) / uRect.zw;
  if (outside(uv)) return 0.0;
  return texture(uMask, uv).r * fade(p);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 c = floor(px / uCell);
  vec2 pc = (c + 0.5) * uCell;
  float t = bayer(ivec2(c));

  // The pointer pushes the grain out, like a lens, and shakes it.
  float R = uRes.x / 13.0 * 0.75;  // Julian: a quarter smaller
  vec2 d = pc - uPointer;
  float dist = length(d) + 1e-4;
  float k = uOn * exp(-(dist * dist) / (R * R));
  float jit = k * 4.0 * uCell * sin(c.x * 12.9 + c.y * 78.2 + uTime * 9.0);
  vec2 sp = pc - d / dist * k * R * 0.5 + vec2(jit, -jit);

  // Sharpened, so the features hold at this size.
  float l = lum(sp);
  float avg = (lum(sp + vec2(uCell, 0.0)) + lum(sp - vec2(uCell, 0.0)) +
               lum(sp + vec2(0.0, uCell)) + lum(sp - vec2(0.0, uCell))) * 0.25;
  l = clamp(l + 0.5 * (l - avg), 0.0, 1.0) * (1.0 - k * 0.35);
  // Only him: the backdrop's grey, a touch lighter round him, left a
  // halo of dots (Julian: remove the dots around me).
  l *= smoothstep(0.35, 0.75, body(sp));
  float photo = quant(l, t);

  // The lights behind, matched to Julian's reference: soft streaks running
  // up to the right that swell and dissolve where they are, never
  // travelling. A noise field stretched along the diagonal, changing with
  // time.
  vec2 u = pc / uRes.y;
  // The pointer pushes the lights aside where it passes (Julian: the
  // hover moves the lights).
  vec2 toP = u - uPointer / uRes.y;
  float pd = length(toP) + 1e-4;
  u += toP / pd * uOn * 0.09 * exp(-(pd * pd) / 0.03);
  vec2 dir = vec2(0.819, -0.574);           // up and to the right, 35 degrees
  vec2 a = vec2(dot(u, dir), dot(u, vec2(-dir.y, dir.x)));
  float n = noise(vec3(a.x * 3.6, a.y * 8.5, uTime * 0.2));
  float f = smoothstep(0.64, 0.92, n);
  // Behind him, never over him: his dark shirt and glasses stay dark.
  f *= 1.0 - smoothstep(0.15, 0.55, body(pc));
  float field = quant(clamp(f, 0.0, 1.0) * 0.32, t);

  fragColor = vec4(mix(GROUND, INK, max(photo, field)), 1.0);
}
`;

/** `children`: the line and the services, set beside the portrait. */
export function AboutHero({ children }: { children?: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const firstRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const box = ref.current;
    const stage = stageRef.current;
    const first = firstRef.current;
    if (!box || !stage || !first) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: false,
        antialias: false,
        dpr: Math.min(devicePixelRatio || 1, 2),
      });
    } catch {
      /* No WebGL: the photograph as it is, in grey (`[data-flat]`). */
      box.dataset.flat = "";
      return;
    }
    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.setAttribute("aria-hidden", "true");
    stage.appendChild(canvas);

    const photo = new Texture(gl, {
      generateMipmaps: false,
      flipY: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });
    const mask = new Texture(gl, {
      generateMipmaps: false,
      flipY: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });
    const program = new Program(gl, {
      vertex,
      fragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uPhoto: { value: photo },
        uRes: { value: [1, 1] },
        uDpr: { value: renderer.dpr },
        uCell: { value: CELL_WIDE },
        uTime: { value: 0 },
        uPointer: { value: [-1e4, -1e4] },
        uOn: { value: 0 },
        uRect: { value: [0, 0, 0, 0] },
        uMask: { value: mask },
        uFade: { value: [1e5, 1e5 + 1] },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    const u = program.uniforms;

    const pointer = { x: -1e4, y: -1e4, on: 0, target: 0 };
    const move = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.target = 1;
      wake();
    };
    const leave = () => {
      pointer.target = 0;
      wake();
    };
    box.addEventListener("pointermove", move, { passive: true });
    box.addEventListener("pointerleave", leave);

    const img = new Image();
    img.src = "/about/julian.jpg";
    /* Where his left edge falls across the photograph, from the mask. */
    let subjectLeft = FOCUS - 0.15;
    const size = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (!w || !h) return;
      const phone = w < 640;
      const cell = phone ? CELL_PHONE : CELL_WIDE;
      /* One fragment per grain cell, scaled up square by the stylesheet:
         the same picture for a sixth to a twenty-fifth of the work. */
      renderer.dpr = 1 / cell;
      renderer.setSize(w, h);
      u.uDpr.value = renderer.dpr;
      u.uRes.value = [w, h];
      u.uCell.value = cell;
      if (img.naturalWidth) {
        /* A phone gives the portrait the top of the screen to itself,
           fading out at its foot, and the words start under it; a wide
           screen has him the full height, beside the words. */
        const ph = phone ? Math.round(Math.min(h, innerHeight * 0.6)) : h;
        const s = Math.max(w / img.naturalWidth, ph / img.naturalHeight);
        const dw = img.naturalWidth * s;
        const dh = img.naturalHeight * s;
        const x = Math.min(
          0,
          Math.max(w - dw, w * (phone ? HOLD_PHONE : HOLD_WIDE) - dw * FOCUS),
        );
        u.uRect.value = [x, (ph - dh) / 2, dw, dh];
        u.uFade.value = phone ? [ph * 0.7, ph] : [1e5, 1e5 + 1];
        box.style.setProperty("--portrait-h", `${ph}px`);
        /* The words stop 40px short of where he starts, at any width. */
        const content = box.querySelector<HTMLElement>(".about-hero-content");
        const inset = content
          ? parseFloat(getComputedStyle(content).paddingLeft)
          : 0;
        box.style.setProperty(
          "--hero-room",
          `${Math.max(0, Math.round(x + dw * subjectLeft - inset - 40))}px`,
        );
      }
    };

    const letters = [...first.children].map((el) => ({
      el: el as HTMLElement,
      w: 200,
    }));

    let raf = 0;
    let visible = true;
    /* Once cleaned up it never starts again: the photo can finish loading
       after the component has gone (React mounts twice in development),
       and a loop woken then would run on for good. */
    let gone = false;
    const t0 = performance.now();
    const frame = (now: number) => {
      raf = 0;
      pointer.on += (pointer.target - pointer.on) * 0.08;
      const r = box.getBoundingClientRect();
      u.uTime.value = still ? 0 : (now - t0) / 1000;
      u.uPointer.value = [pointer.x - r.left, pointer.y - r.top];
      u.uOn.value = pointer.on;
      renderer.render({ scene: mesh });

      /* The first name: each letter swells toward the pointer, Thin to
         Black, and eases back when it has gone. */
      const em = parseFloat(getComputedStyle(first).fontSize);
      let moving = Math.abs(pointer.target - pointer.on) > 0.01;
      for (const l of letters) {
        const b = l.el.getBoundingClientRect();
        const dx = pointer.x - (b.left + b.width / 2);
        const dy = pointer.y - (b.top + b.height / 2);
        const near =
          Math.exp(-(dx * dx + dy * dy * 0.6) / (0.3 * em * em)) * pointer.on;
        const target = 200 + 700 * near;
        l.w += (target - l.w) * 0.16;
        if (Math.abs(target - l.w) > 0.5) moving = true;
        l.el.style.fontWeight = l.w.toFixed(0);
      }

      /* The drift keeps it running while it is on screen; held still, it
         runs only while something is still settling. */
      if (visible && !document.hidden && (!still || moving)) wake();
    };
    const wake = () => {
      if (!raf && !gone) raf = requestAnimationFrame(frame);
    };

    const sizes = new ResizeObserver(() => {
      size();
      wake();
    });
    sizes.observe(box);
    /* Nothing runs while the strip has it off screen. */
    const view = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
    });
    view.observe(box);
    const shown = () => !document.hidden && wake();
    document.addEventListener("visibilitychange", shown);
    img.onload = () => {
      photo.image = img;
      /* Where he is: the photograph against its plain grey backdrop, read
         low. Anything far enough from the backdrop's grey is him (his
         black shirt is darker than it, the jacket lighter); spread a
         little and softened, so the lights keep clear of his edges. */
      const MW = 192;
      const MH = Math.round((MW * img.naturalHeight) / img.naturalWidth);
      const mc = document.createElement("canvas");
      mc.width = MW;
      mc.height = MH;
      const mx = mc.getContext("2d");
      if (mx) {
        mx.drawImage(img, 0, 0, MW, MH);
        const px = mx.getImageData(0, 0, MW, MH);
        const d = px.data;
        const L = (i: number) =>
          (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) /
          255;
        /* The backdrop's grey, off the empty left fifth of the frame. */
        let bg = 0;
        let n = 0;
        for (let y = 0; y < MH; y++)
          for (let x = 0; x < MW / 5; x++, n++) bg += L(y * MW + x);
        bg /= n;
        let m = new Float32Array(MW * MH);
        for (let i = 0; i < MW * MH; i++)
          m[i] = Math.abs(L(i) - bg) > 0.045 ? 1 : 0;
        /* His left edge: the first column with him in it. */
        subjectLeft = 1;
        for (let x = 0; x < MW && subjectLeft === 1; x++) {
          let c = 0;
          for (let y = 0; y < MH; y++) c += m[y * MW + x];
          if (c >= 4) subjectLeft = x / MW;
        }
        for (let pass = 0; pass < 3; pass++) {
          const next = new Float32Array(MW * MH);
          for (let y = 0; y < MH; y++)
            for (let x = 0; x < MW; x++) {
              let sum = 0;
              let hit = 0;
              for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                  const yy = Math.min(MH - 1, Math.max(0, y + dy));
                  const xx = Math.min(MW - 1, Math.max(0, x + dx));
                  const v = m[yy * MW + xx];
                  sum += v;
                  hit = Math.max(hit, v);
                }
              /* The first pass spreads him a cell, the others soften. */
              next[y * MW + x] = pass === 0 ? hit : sum / 9;
            }
          m = next;
        }
        for (let i = 0; i < MW * MH; i++) {
          const v = Math.round(m[i] * 255);
          d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
          d[i * 4 + 3] = 255;
        }
        mx.putImageData(px, 0, 0);
        mask.image = mc;
      }
      size();
      wake();
    };

    return () => {
      gone = true;
      img.onload = null;
      cancelAnimationFrame(raf);
      sizes.disconnect();
      view.disconnect();
      document.removeEventListener("visibilitychange", shown);
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerleave", leave);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, []);

  return (
    <div ref={ref} className="about-hero">
      <div ref={stageRef} className="about-hero-stage" />

      {/* The line and the services at the top left, the name at the foot:
          beside him on a wide screen, under him on a phone. The role line
          is gone: the title says it. */}
      <div className="about-hero-content">
        <div className="about-hero-bio">{children}</div>
        <div className="about-hero-copy">
          <p
            className={`about-hero-name ${axis.className}`}
            aria-label="Julian Gigola"
          >
            <span ref={firstRef} className="about-hero-first" aria-hidden>
              {[..."Julian"].map((c, i) => (
                <span key={i}>{c}</span>
              ))}
            </span>
            <span className="about-hero-last" aria-hidden>
              Gigola
            </span>
          </p>
          <ul className="about-hero-facts">
            <li>Based in San Francisco, CA</li>
            <li>Available worldwide</li>
            <li>Published in WIRED</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
