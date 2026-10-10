"use client";

import * as React from "react";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { buildProgram } from "@/lib/gl-warm";

/* ── the name, through glass ──────────────────────────────────────
 * React Bits' WarpText (reactbits.dev), which Julian asked for on the name
 * on the homepage: the words drawn into a texture and shown through a
 * slowly moving sheet of glass, with a lens that follows the pointer and a
 * faint split of red and blue at the edges.
 *
 * Changed from the original: typed; the colour is read from the page, not
 * passed in, and redrawn when the theme changes, so it is the ink of
 * whichever ground it is on; it waits for its own face to load before
 * drawing, since nothing else on the page asks for that face; and the
 * canvas is hidden from assistive technology, because the heading that
 * holds it carries the name as text.
 * ─────────────────────────────────────────────────────────────── */

const vertex = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;

uniform sampler2D uTextTexture;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uTime;
uniform float uWarpStrength;
uniform float uWarpScale;
uniform float uSpeed;
uniform float uPointerInfluence;
uniform float uPointerStrength;
uniform float uRefraction;
uniform float uRipple;
uniform float uMotion;

in vec2 vUv;
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

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

vec4 sampleText(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return vec4(0.0);
  }
  return texture(uTextTexture, uv);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float time = uTime * uSpeed;
  float scale = max(uWarpScale, 0.001);

  vec2 drift = vec2(time * 0.055, -time * 0.045);
  float n1 = fbm(uv * scale * 3.1 + drift);
  float n2 = fbm((uv + 19.17) * scale * 3.4 - drift.yx);
  vec2 ambient = (vec2(n1, n2) - 0.5) * uWarpStrength * 0.045 * uMotion;

  vec2 pointerDelta = uv - uPointer;
  vec2 aspectDelta = vec2(pointerDelta.x * aspect, pointerDelta.y);
  float dist = length(aspectDelta);
  float radius = max(uPointerInfluence, 0.001);
  float t = clamp(dist / radius, 0.0, 1.0);
  float lens = smoothstep(radius, 0.0, dist) * uPointerActive;
  float bulge = t * (1.0 - t) * (1.0 - t) * 6.75 * uPointerActive;
  vec2 dir = dist > 0.0001 ? vec2(aspectDelta.x / aspect, aspectDelta.y) / dist : vec2(0.0);

  float rippleWave = sin(dist * 28.0 - time * 4.2) * 0.5 + 0.5;
  float rippleRing = (rippleWave - 0.5) * uRipple;
  vec2 pointerWarp = -dir * bulge * uPointerStrength * 0.045;
  pointerWarp += dir * rippleRing * bulge * uPointerStrength * 0.016;

  vec2 displaced = uv + ambient + pointerWarp;
  vec2 splitDir = ambient + pointerWarp;
  float splitLen = length(splitDir);
  splitDir = splitLen > 0.00001 ? splitDir / splitLen : vec2(0.7071, 0.7071);
  vec2 split = splitDir * uRefraction * 0.16 * (0.35 + lens * 1.65);

  vec4 base = sampleText(displaced);
  float r = sampleText(displaced + split).r;
  float g = base.g;
  float b = sampleText(displaced - split).b;
  float a = max(max(sampleText(displaced + split).a, base.a), sampleText(displaced - split).a);

  vec3 color = vec3(r, g, b) + lens * base.a * 0.055;
  fragColor = vec4(color, a);
}
`;

type Look = {
  text: string;
  fontSize: string;
  fontWeight: number;
  fontFamily: string;
  letterSpacing: string;
  warpStrength: number;
  warpScale: number;
  speed: number;
  pointerInfluence: number;
  pointerStrength: number;
  refraction: number;
  /** On or off, or how strong: 1 is on. */
  ripple: boolean | number;
};

const measureLine = (ctx: CanvasRenderingContext2D, line: string, spacing: number) => {
  const chars = Array.from(line);
  const width = chars.reduce((w, ch) => w + ctx.measureText(ch).width, 0);
  return width + Math.max(0, chars.length - 1) * spacing;
};

const drawLine = (
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  spacing: number,
) => {
  const chars = Array.from(line);
  let cursor = x - measureLine(ctx, line, spacing) / 2;
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + (i === chars.length - 1 ? 0 : spacing);
  });
};

/** The words, drawn once into a canvas the size of the box, in the face,
    size and ink the page gives them, shrunk to fit if they would not. */
const buildTextCanvas = async (
  container: HTMLElement,
  width: number,
  height: number,
  dpr: number,
  look: Look,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const probe = document.createElement("span");
  probe.textContent = look.text;
  Object.assign(probe.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    whiteSpace: "pre",
    inset: "0 auto auto 0",
    fontFamily: look.fontFamily,
    fontSize: look.fontSize,
    fontWeight: String(look.fontWeight),
    letterSpacing: look.letterSpacing,
  });
  container.appendChild(probe);
  const computed = getComputedStyle(probe);
  let size = parseFloat(computed.fontSize) || 96;
  const family = computed.fontFamily || "sans-serif";
  const weight = computed.fontWeight || String(look.fontWeight);
  let spacing =
    computed.letterSpacing === "normal" ? 0 : parseFloat(computed.letterSpacing) || 0;
  const ink = getComputedStyle(container).color;
  probe.remove();

  // Nothing else on the page sets this face, so ask for it before drawing.
  try {
    await document.fonts.load(`${weight} ${size}px ${family}`, look.text);
  } catch {}

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ink;
  ctx.font = `${weight} ${size}px ${family}`;

  const widest = Math.max(measureLine(ctx, look.text, spacing), 1);
  // Filling more of the box than the original (0.86 and 0.78): the box is
  // cut to the words here, so the frames round them can come in close.
  const fit = Math.min(1, (width * 0.94) / widest, (height * 0.9) / (size * 0.9));
  if (fit < 1) {
    size *= fit;
    spacing *= fit;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  drawLine(ctx, look.text, width / 2, height / 2, spacing);
  return canvas;
};

/* The hero's name kept between visits: leaving the homepage parks its
   renderer, compiled program and texture here rather than losing the
   context, and coming back takes them up again. Building them anew cost
   the way back from the portfolio about 140ms inside the page swap (a
   new WebGL context, then a 93ms first `setSize` on its drawing buffer). */
type Kept = {
  renderer: Renderer;
  program: Program;
  geometry: Triangle;
  texture: Texture;
  uniforms: Record<string, { value: unknown }>;
};
/* One for each WarpText (by its class): the header's logo is one too, and
   a renderer taken up at another's size would pay for the resize again. */
const parked = new Map<string, Kept>();

export function WarpText({
  text,
  fontSize = "clamp(3rem, 10vw, 9rem)",
  fontWeight = 800,
  fontFamily = "inherit",
  letterSpacing = "-0.06em",
  warpStrength = 0.08,
  warpScale = 1.7,
  speed = 0.55,
  pointerInfluence = 0.42,
  pointerStrength = 0.38,
  refraction = 0.018,
  ripple = true,
  sweep = false,
  className,
  style,
}: Partial<Look> & {
  text: string;
  /** Once, as the page loads, the lens passes along the words. */
  sweep?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const sweepRef = React.useRef(sweep);
  const look: Look = {
    text,
    fontSize,
    fontWeight,
    fontFamily,
    letterSpacing,
    warpStrength,
    warpScale,
    speed,
    pointerInfluence,
    pointerStrength,
    refraction,
    ripple,
  };
  const lookRef = React.useRef(look);
  React.useEffect(() => {
    lookRef.current = look;
  });

  React.useEffect(() => {
    const container = ref.current;
    if (!container) return;

    /* Pixels per CSS pixel: the screen's, and a CSS `zoom` on the way up
       (the hero's Middle size on DialKit). A zoomed box keeps its size in
       CSS pixels, so without it the canvas was drawn at the unzoomed size
       and stretched, soft at anything over 1. */
    const density = () =>
      Math.min(devicePixelRatio || 1, 2) *
      ((container as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1);

    const key = className ?? "";
    let kept = parked.get(key);
    parked.delete(key);
    if (kept?.renderer.gl.isContextLost()) kept = undefined;
    let renderer: Renderer;
    try {
      renderer = kept?.renderer ?? new Renderer({
        webgl: 2,
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
        dpr: density(),
      });
    } catch (error) {
      console.warn("WarpText: WebGL could not be initialized.", error);
      // Nothing to wait for: the opening lifts without it (`intro.tsx`).
      container.dataset.drawn = "";
      return;
    }
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = reduced.matches;
    let disposed = false;
    let contextLost = false;
    let visible = true;
    let pageVisible = !document.hidden;
    let raf = 0;
    let version = 0;
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: 0, activeTarget: 0 };
    const startTime = performance.now();

    /* ── the pass ──
       Julian's recording: the pointer drawn along the name, left to right,
       the letters warping and splitting into colour where it goes. On
       load that pass plays by itself, starting while the name is still
       rising into its line (a quarter of the way through `.lift`, which
       waits under the opening, `intro.tsx`; Julian: start it earlier), and
       a visitor's own pointer on the name takes over from it at once. */
    const PASS_MS = 1300;
    let pass = 0;
    /* After the pass, the lens fades out where it finished, off the end
       of the name, and only then goes back to its idle drift: gliding back
       across it read as a second swipe, right to left (Julian: one swipe,
       left to right). */
    let fading = false;
    let waiting = sweepRef.current && !reduceMotion;
    /* Looked up at the first frame that wants it, not here: `getAnimations`
       brings the styles of the whole new page up to date, 17ms inside the
       swap back from the portfolio. */
    let rise: Animation | undefined;
    let passFrom = 0;
    let looked = false;
    const maybePass = (now: number) => {
      if (!waiting) return;
      if (!looked) {
        looked = true;
        rise = container.closest(".lift")?.getAnimations()[0];
        const riseTiming = rise?.effect?.getComputedTiming();
        passFrom = Number(riseTiming?.delay ?? 0) + Number(riseTiming?.duration ?? 0) * 0.25;
      }
      const at = rise ? Number(rise.currentTime ?? 0) : Infinity;
      if (rise && rise.playState !== "finished" && at < passFrom) return;
      waiting = false;
      if (pointer.activeTarget > 0) return;
      pointer.x = pointer.tx = -0.08;
      pointer.y = pointer.ty = 0.5;
      // From nothing at the left edge, not the idle shimmer jumping there.
      pointer.active = 0;
      pass = now;
    };

    const texture = kept?.texture ?? new Texture(gl, {
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });
    const l = lookRef.current;
    const geometry = kept?.geometry ?? new Triangle(gl);
    const fresh = {
      uTextTexture: { value: texture },
      uResolution: { value: new Float32Array([1, 1]) },
      uPointer: { value: new Float32Array([0.5, 0.5]) },
      uPointerActive: { value: 0 },
      uTime: { value: 0 },
      uWarpStrength: { value: l.warpStrength },
      uWarpScale: { value: l.warpScale },
      uSpeed: { value: l.speed },
      uPointerInfluence: { value: l.pointerInfluence },
      uPointerStrength: { value: l.pointerStrength },
      uRefraction: { value: l.refraction },
      uRipple: { value: Number(l.ripple) },
      uMotion: { value: reduceMotion ? 0 : 1 },
    };
    // A kept program is bound to its own uniforms: the same object, set anew.
    const uniforms = kept ? (Object.assign(kept.uniforms, fresh) as typeof fresh) : fresh;
    /* The program once its shaders are compiled, which the GPU does in
       its own time (`lib/gl-warm.ts`); nothing draws until then, and the
       name is still rising under the opening by the time it is. */
    // A kept one at once, so a remount straight away can park it again.
    let program: Program | undefined = kept?.program;
    let mesh: Mesh | undefined;

    const renderOnce = () => {
      if (!disposed && !contextLost && mesh) renderer.render({ scene: mesh });
    };

    const rasterize = async () => {
      const mine = ++version;
      await document.fonts.ready.catch(() => {});
      if (disposed || contextLost || mine !== version) return;
      // The box as laid out, not as drawn: a transform on an ancestor (the
      // header's wordmark is scaled on the homepage) would otherwise be
      // baked into the canvas, and a transform changing back fires no
      // resize, so the canvas stayed too big and the name was cut off.
      const rect = { width: container.clientWidth, height: container.clientHeight };
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = density();
      const image = await buildTextCanvas(container, rect.width, rect.height, dpr, lookRef.current);
      if (disposed || contextLost || mine !== version) return;
      texture.image = image;
      texture.needsUpdate = true;
      renderOnce();
      // The words are on the canvas: the opening waits for this before it
      // lifts, so the name is never missing behind it (`intro.tsx`).
      if (mesh) container.dataset.drawn = "";
    };

    const resize = () => {
      if (disposed || contextLost || !mesh) return;
      // The box as laid out, not as drawn: a transform on an ancestor (the
      // header's wordmark is scaled on the homepage) would otherwise be
      // baked into the canvas, and a transform changing back fires no
      // resize, so the canvas stayed too big and the name was cut off.
      const rect = { width: container.clientWidth, height: container.clientHeight };
      if (rect.width <= 0 || rect.height <= 0) return;
      // Only when it changed: setting a WebGL canvas's size, even to the
      // same, reallocates its drawing buffer (93ms on the way back home).
      const dpr = density();
      if (renderer.dpr !== dpr || renderer.width !== rect.width || renderer.height !== rect.height) {
        renderer.dpr = dpr;
        renderer.setSize(rect.width, rect.height);
      }
      uniforms.uResolution.value[0] = gl.drawingBufferWidth;
      uniforms.uResolution.value[1] = gl.drawingBufferHeight;
      rasterize();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.tx = (e.clientX - rect.left) / rect.width;
      pointer.ty = 1 - (e.clientY - rect.top) / rect.height;
      pointer.activeTarget = 1;
      wake();
    };
    const onPointerLeave = () => {
      pointer.activeTarget = 0;
      wake();
    };
    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => {
      pageVisible = !document.hidden;
      if (pageVisible && visible && !raf) raf = requestAnimationFrame(loop);
      if (!pageVisible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const onReducedMotion = (e: MediaQueryListEvent) => {
      reduceMotion = e.matches;
      uniforms.uMotion.value = reduceMotion ? 0 : 1;
      renderOnce();
      wake();
    };

    /* Under another screen of the homepage's deck (`lib/deck.ts`), the
       name is out of sight but still in the viewport, so the observer
       below keeps it running. It stops there, and starts again as the
       screen over it moves off. */
    const unburied = new MutationObserver(() => {
      unburied.disconnect();
      if (visible && pageVisible && !raf && !disposed) raf = requestAnimationFrame(loop);
    });

    const loop = (now: number) => {
      if (disposed || contextLost) return;
      if (!mesh) {
        raf = 0;
        return;
      }
      const buried = container.closest("[data-buried]");
      if (buried) {
        raf = 0;
        unburied.observe(buried, { attributes: true, attributeFilter: ["data-buried"] });
        return;
      }
      const elapsed = (now - startTime) * 0.001;
      // Under reduced motion the idle light holds still in the middle.
      const idleX = reduceMotion ? 0.5 : 0.5 + Math.sin(elapsed * 0.33) * 0.12;
      const idleY = reduceMotion ? 0.5 : 0.5 + Math.cos(elapsed * 0.27) * 0.1;
      maybePass(now);
      if (pass) {
        const t = (now - pass) / PASS_MS;
        if (t >= 1 || pointer.activeTarget > 0) {
          pass = 0;
          fading = pointer.activeTarget === 0;
        } else {
          // Unhurried at either end, like a hand starting and stopping.
          const e = 0.5 - Math.cos(Math.PI * t) / 2;
          pointer.tx = -0.08 + 1.16 * e;
          pointer.ty = 0.5;
        }
      }
      if (fading && (pointer.activeTarget > 0 || pointer.active < 0.02)) {
        fading = false;
        // Faded out: back to the drift unseen, to come up there again.
        if (pointer.activeTarget === 0) {
          pointer.x = idleX;
          pointer.y = idleY;
        }
      }
      const on = pointer.activeTarget > 0 || pass > 0;
      const damping = on ? 0.12 : 0.035;
      pointer.x += ((on || fading ? pointer.tx : idleX) - pointer.x) * damping;
      pointer.y += ((on || fading ? pointer.ty : idleY) - pointer.y) * damping;
      pointer.active += ((on ? 1 : fading ? 0 : 0.18) - pointer.active) * 0.06;
      uniforms.uPointer.value[0] = pointer.x;
      uniforms.uPointer.value[1] = pointer.y;
      uniforms.uPointerActive.value = reduceMotion ? pointer.active * 0.35 : pointer.active;
      uniforms.uTime.value = reduceMotion ? 0 : elapsed;
      // Read every frame, so a change of props (the `?tune` sliders in
      // `warp-tuner.tsx`) shows without rebuilding the canvas.
      const l = lookRef.current;
      uniforms.uWarpStrength.value = l.warpStrength;
      uniforms.uWarpScale.value = l.warpScale;
      uniforms.uSpeed.value = l.speed;
      uniforms.uPointerInfluence.value = l.pointerInfluence;
      uniforms.uPointerStrength.value = l.pointerStrength;
      uniforms.uRefraction.value = l.refraction;
      uniforms.uRipple.value = Number(l.ripple);
      renderOnce();
      /* Under reduced motion nothing moves once the light has settled, so
         the loop stops there; a pointer over the name starts it again. */
      if (
        reduceMotion &&
        !waiting &&
        !pass &&
        !fading &&
        pointer.activeTarget === 0 &&
        Math.abs(pointer.active - 0.18) < 0.002 &&
        Math.abs(pointer.x - idleX) < 0.001 &&
        Math.abs(pointer.y - idleY) < 0.001
      ) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!raf && visible && pageVisible && mesh && !disposed && !contextLost) raf = requestAnimationFrame(loop);
    };

    const sizes = new ResizeObserver(resize);
    /* In device pixels where the browser can, which changes with a zoom
       as well as a resize; the plain box where it cannot (Safari). */
    try {
      sizes.observe(container, { box: "device-pixel-content-box" });
    } catch {
      sizes.observe(container);
    }
    const view = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && pageVisible && !raf) raf = requestAnimationFrame(loop);
      if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    view.observe(container);
    // A new theme is a new ink: draw the words again in it.
    const theme = new MutationObserver(rasterize);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const dark = matchMedia("(prefers-color-scheme: dark)");
    dark.addEventListener("change", rasterize);

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", onReducedMotion);

    (kept ? Promise.resolve(kept.program) : buildProgram(gl, {
      vertex,
      fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms,
    })).then((built) => {
      program = built;
      if (disposed || contextLost) return;
      mesh = new Mesh(gl, { geometry, program });
      // A kept renderer waits for the size observer's first call, which
      // comes once the new page is laid out, rather than laying it out now.
      if (!kept) resize();
      if (visible && pageVisible && !raf) raf = requestAnimationFrame(loop);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      sizes.disconnect();
      view.disconnect();
      unburied.disconnect();
      theme.disconnect();
      dark.removeEventListener("change", rasterize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onReducedMotion);
      if (!contextLost && program && !parked.has(key)) {
        parked.set(key, { renderer, program, geometry, texture, uniforms });
      } else if (!contextLost) {
        try {
          if (texture.texture) gl.deleteTexture(texture.texture);
          geometry.remove();
          program?.remove();
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {}
      }
      canvas.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once; the class names the instance
  }, []);

  return <div ref={ref} aria-hidden className={`warp-text ${className ?? ""}`} style={style} />;
}
