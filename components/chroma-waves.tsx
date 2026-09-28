"use client";

import * as React from "react";
import { Mesh, Renderer, Triangle } from "ogl";
import { useDialKit, type DialConfig } from "dialkit";
import { buildProgram } from "@/lib/gl-warm";

/* ── the waves behind Contact ─────────────────────────────────────
 * Julian: a wave shader for the contact page, the site's own. A few thin
 * ribbons of light run across the lower half of the screen, bent by noise
 * as they go, and each is split a hair into red, green and blue, the
 * same split the name on the cover carries (`warp-text.tsx`). Drawn in
 * the theme's own ink over its own ground, so it is light on the dark
 * page and dark on the light one, and faint enough that the form reads
 * over it.
 *
 * Soft by nature, so it is drawn at half the pixels and scaled up. It
 * stops while the tab is hidden or the page is off screen, and holds one
 * still frame for anybody who asks for less motion.
 *
 * Every number is on DialKit's "Contact waves" panel (the dev server
 * only; production gets these defaults).
 * ─────────────────────────────────────────────────────────────── */

const WAVES = {
  strength: [0.3, 0, 1, 0.01],
  speed: [0.5, 0, 4, 0.05],
  height: [0.31, 0, 1, 0.01],
  spread: [0.045, 0, 0.2, 0.005],
  bend: [0.5, 0, 1, 0.01],
  swing: [0.115, 0, 0.4, 0.005],
  waveSize: [1.3, 0.2, 3, 0.05],
  thickness: [0.0028, 0.0005, 0.01, 0.0001],
  colorSplit: [0.065, 0, 0.3, 0.005],
  fadeTop: [0.71, 0.2, 1, 0.01],
} satisfies DialConfig;

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uGround;
uniform vec3 uInk;
uniform float uStrength;
uniform float uHeight;
uniform float uSpread;
uniform float uBend;
uniform float uSwing;
uniform float uWaveSize;
uniform float uThickness;
uniform float uSplit;
uniform float uFadeTop;
out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

const int RIBBONS = 5;

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float x = uv.x * uRes.x / uRes.y;
  float t = uTime;
  vec3 light = vec3(0.0);
  for (int i = 0; i < RIBBONS; i++) {
    float fi = float(i);
    // Noise bends each ribbon, and drifts along it slowly.
    float n = fbm(vec2(x * 0.9 + t * 0.045 + fi * 1.7, fi * 3.1 + t * 0.03));
    float base = uHeight + (fi - 2.0) * uSpread + (n - 0.5) * uBend;
    float speed = 0.22 + fi * 0.05;
    float freq = (1.3 + fi * 0.28) * uWaveSize;
    float swell = 0.6 + 0.4 * sin(fi * 2.1 + t * 0.17);
    // The split: each channel's ribbon a little behind the last.
    for (int c = 0; c < 3; c++) {
      float k = float(c) * uSplit;
      float y = base + uSwing * sin(x * freq + t * speed + fi * 1.3 + k);
      float d = abs(uv.y - y);
      light[c] += swell * uThickness / (d + 0.0045);
    }
  }
  // Gone before the top of the screen, where the words start.
  light *= smoothstep(uFadeTop, uFadeTop - 0.65, uv.y);
  vec3 amount = clamp(light * uStrength, 0.0, 0.55);
  fragColor = vec4(mix(uGround, uInk, amount), 1.0);
}
`;

/** Any CSS colour as 0 to 1 RGB, through a one-pixel canvas. */
const rgb = (css: string): [number, number, number] => {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
};

export function ChromaWaves({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const dials = useDialKit("Contact waves", WAVES, { id: "contact-waves" });
  const look = React.useRef(dials);
  const redraw = React.useRef(() => {});
  React.useEffect(() => {
    look.current = dials;
    redraw.current();
  });

  React.useEffect(() => {
    const box = ref.current;
    if (!box) return;
    let renderer: Renderer;
    try {
      renderer = new Renderer({ webgl: 2, alpha: false, antialias: false, dpr: 0.5 });
    } catch {
      return; // No WebGL: the page's own ground, as before.
    }
    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    box.appendChild(canvas);

    const u = {
      uTime: { value: 0 },
      uRes: { value: [1, 1] },
      uGround: { value: [0, 0, 0] },
      uInk: { value: [1, 1, 1] },
      uStrength: { value: 0 },
      uHeight: { value: 0 },
      uSpread: { value: 0 },
      uBend: { value: 0 },
      uSwing: { value: 0 },
      uWaveSize: { value: 1 },
      uThickness: { value: 0 },
      uSplit: { value: 0 },
      uFadeTop: { value: 0 },
    };
    // The program once its shaders are compiled (`lib/gl-warm.ts`).
    let mesh: Mesh | undefined;

    /* The theme's ground and ink, and again on a switch. From the tokens,
       not the body's colours: those fade on a switch, and read in the
       middle of it the light page got the dark one's ink. */
    const paint = () => {
      const cs = getComputedStyle(document.documentElement);
      u.uGround.value = rgb(cs.getPropertyValue("--background").trim());
      u.uInk.value = rgb(cs.getPropertyValue("--foreground").trim());
    };
    const size = () => {
      renderer.setSize(box.clientWidth, box.clientHeight);
      u.uRes.value = [gl.canvas.width, gl.canvas.height];
    };
    paint();
    size();

    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Time is added up, not read off the clock, so a change of speed on
    // the panel carries on from where the waves are instead of jumping.
    let t = 12;
    let last = 0;
    let raf = 0;
    let seen = true;
    const draw = (now: number) => {
      const l = look.current;
      if (!calm && last) t += (Math.min(now - last, 50) / 1000) * l.speed;
      last = now;
      u.uTime.value = t;
      u.uStrength.value = l.strength;
      u.uHeight.value = l.height;
      u.uSpread.value = l.spread;
      u.uBend.value = l.bend;
      u.uSwing.value = l.swing;
      u.uWaveSize.value = l.waveSize;
      u.uThickness.value = l.thickness;
      u.uSplit.value = l.colorSplit;
      u.uFadeTop.value = l.fadeTop;
      if (mesh) renderer.render({ scene: mesh });
      raf = !calm && seen && !document.hidden ? requestAnimationFrame(draw) : 0;
    };
    const wake = () => {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(draw);
    };
    wake();
    redraw.current = wake;
    let gone = false;
    buildProgram(gl, { vertex, fragment, uniforms: u }).then((program) => {
      if (gone) return;
      mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
      wake();
    });

    const view = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      if (seen) wake();
    });
    view.observe(box);
    const onVisible = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVisible);
    const sizes = new ResizeObserver(() => {
      size();
      wake();
    });
    sizes.observe(box);
    const theme = new MutationObserver(() => {
      paint();
      wake();
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    return () => {
      gone = true;
      cancelAnimationFrame(raf);
      redraw.current = () => {};
      view.disconnect();
      sizes.disconnect();
      theme.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, []);

  // The panel itself is mounted by the page's `PageDials`.
  return <div ref={ref} aria-hidden="true" className={className} />;
}
