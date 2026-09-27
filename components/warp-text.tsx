"use client";

import * as React from "react";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";

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
  className,
  style,
}: Partial<Look> & {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
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

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
        dpr: Math.min(devicePixelRatio || 1, 2),
      });
    } catch (error) {
      console.warn("WarpText: WebGL could not be initialized.", error);
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

    const texture = new Texture(gl, {
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });
    const l = lookRef.current;
    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
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
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    const renderOnce = () => {
      if (!disposed && !contextLost) renderer.render({ scene: mesh });
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
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const image = await buildTextCanvas(container, rect.width, rect.height, dpr, lookRef.current);
      if (disposed || contextLost || mine !== version) return;
      texture.image = image;
      texture.needsUpdate = true;
      renderOnce();
    };

    const resize = () => {
      if (disposed || contextLost) return;
      // The box as laid out, not as drawn: a transform on an ancestor (the
      // header's wordmark is scaled on the homepage) would otherwise be
      // baked into the canvas, and a transform changing back fires no
      // resize, so the canvas stayed too big and the name was cut off.
      const rect = { width: container.clientWidth, height: container.clientHeight };
      if (rect.width <= 0 || rect.height <= 0) return;
      renderer.dpr = Math.min(devicePixelRatio || 1, 2);
      renderer.setSize(rect.width, rect.height);
      program.uniforms.uResolution.value[0] = gl.drawingBufferWidth;
      program.uniforms.uResolution.value[1] = gl.drawingBufferHeight;
      rasterize();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.tx = (e.clientX - rect.left) / rect.width;
      pointer.ty = 1 - (e.clientY - rect.top) / rect.height;
      pointer.activeTarget = 1;
    };
    const onPointerLeave = () => {
      pointer.activeTarget = 0;
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
      program.uniforms.uMotion.value = reduceMotion ? 0 : 1;
      renderOnce();
    };

    const loop = (now: number) => {
      if (disposed || contextLost) return;
      const elapsed = (now - startTime) * 0.001;
      const idleX = 0.5 + Math.sin(elapsed * 0.33) * 0.12;
      const idleY = 0.5 + Math.cos(elapsed * 0.27) * 0.1;
      const on = pointer.activeTarget > 0;
      const damping = on ? 0.12 : 0.035;
      pointer.x += ((on ? pointer.tx : idleX) - pointer.x) * damping;
      pointer.y += ((on ? pointer.ty : idleY) - pointer.y) * damping;
      pointer.active += ((on ? 1 : 0.18) - pointer.active) * 0.06;
      program.uniforms.uPointer.value[0] = pointer.x;
      program.uniforms.uPointer.value[1] = pointer.y;
      program.uniforms.uPointerActive.value = reduceMotion ? pointer.active * 0.35 : pointer.active;
      program.uniforms.uTime.value = reduceMotion ? 0 : elapsed;
      // Read every frame, so a change of props (the `?tune` sliders in
      // `warp-tuner.tsx`) shows without rebuilding the canvas.
      const l = lookRef.current;
      program.uniforms.uWarpStrength.value = l.warpStrength;
      program.uniforms.uWarpScale.value = l.warpScale;
      program.uniforms.uSpeed.value = l.speed;
      program.uniforms.uPointerInfluence.value = l.pointerInfluence;
      program.uniforms.uPointerStrength.value = l.pointerStrength;
      program.uniforms.uRefraction.value = l.refraction;
      program.uniforms.uRipple.value = Number(l.ripple);
      renderOnce();
      raf = requestAnimationFrame(loop);
    };

    const sizes = new ResizeObserver(resize);
    sizes.observe(container);
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

    resize();
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      sizes.disconnect();
      view.disconnect();
      theme.disconnect();
      dark.removeEventListener("change", rasterize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onReducedMotion);
      if (!contextLost) {
        try {
          if (texture.texture) gl.deleteTexture(texture.texture);
          geometry.remove();
          program.remove();
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {}
      }
      canvas.remove();
    };
  }, []);

  return <div ref={ref} aria-hidden className={`warp-text ${className ?? ""}`} style={style} />;
}
