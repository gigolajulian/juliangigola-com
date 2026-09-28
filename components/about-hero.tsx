"use client";

import * as React from "react";
import { Mesh, Renderer, Triangle } from "ogl";
import { useDialKit, type DialConfig } from "dialkit";
import { buildProgram } from "@/lib/gl-warm";
import { WarpText } from "@/components/warp-text";
import { NAME_WARP } from "@/lib/name-warp";

/* ── the about page's first screen ────────────────────────────────
 * Julian: soft lights swelling and fading in a fine grain of greys on
 * the dark; the pointer pushes the lights aside and a click ripples
 * them. His portrait was here (Julian: remove my image). The name is
 * the site's wordmark on one line, warping as the homepage's hero does (Julian:
 * match the hero).
 *
 * Drawn on the GPU (ogl, as `warp-text.tsx`): at a grain this fine the
 * whole screen is redrawn every frame, which a canvas loop could not keep
 * up with. On the light theme the grain is dark on the page's ground.
 * ─────────────────────────────────────────────────────────────── */

/* Julian: the background on DialKit, "About background" (the dev server
   only; production gets these defaults).
     Grain    one dithered cell every `cell` CSS pixels (`phone` under
              640px wide; Julian: a little less detail than 2.5 and 2),
              and how many greys
     Lights   the streaks behind: how bright, where they start and how
              soft, their size, drift and angle (degrees, up to the right)
     Hover    how far the pointer pushes the lights
     Ripple   a click's ring: speed in px a second, push, and how long
     Logos    one pass of the client marks, in seconds */
const BG = {
  grain: {
    cell: [3.2, 1, 10, 0.1],
    phone: [2.6, 1, 10, 0.1],
    levels: [4, 2, 8, 1],
  },
  lights: {
    _collapsed: true,
    amount: [0.32, 0, 1, 0.01],
    start: [0.64, 0, 1, 0.01],
    softness: [0.28, 0.01, 1, 0.01],
    size: [1, 0.2, 4, 0.05],
    speed: [0.2, 0, 2, 0.01],
    angle: [35, -90, 90, 1],
  },
  hover: {
    _collapsed: true,
    lights: [0.09, 0, 0.5, 0.01],
  },
  ripple: {
    _collapsed: true,
    speed: [700, 100, 2000, 10],
    push: [22, 0, 80, 1],
    seconds: [1.2, 0.2, 4, 0.1],
  },
  logos: {
    _collapsed: true,
    seconds: [40, 5, 120, 1],
  },
} satisfies DialConfig;

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
uniform vec2 uRes;      // CSS pixels
uniform float uDpr;
uniform float uCell;
uniform vec2 uPointer;  // CSS pixels, from the top left
uniform float uOn;
uniform vec3 uRipple;   // a click: x, y in CSS pixels, and its age in seconds
uniform float uLight;   // 1 on the light theme
// The panel's (BG, above): the greys; the lights' amount, start, softness
// and size, their direction and clock; the pointer's push on the lights;
// the ring's speed and push.
uniform float uLevels;
uniform vec4 uLights;
uniform vec2 uLightDir;
uniform float uLightT;
uniform float uLens;
uniform vec2 uWave;
out vec4 fragColor;

const vec3 GROUND = vec3(0.043);
const vec3 INK = vec3(0.91, 0.90, 0.875);
// The light theme's ground and ink (--background, --foreground).
const vec3 PAPER = vec3(0.922, 0.929, 0.936);
const vec3 PRINT = vec3(0.077, 0.072, 0.068);

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

// A tone, dithered to one of uLevels greys.
float quant(float v, float t) {
  float s = clamp(v, 0.0, 1.0) * (uLevels - 1.0);
  float b = floor(s);
  return (b + step(t, s - b)) / (uLevels - 1.0);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 c = floor(px / uCell);
  vec2 pc = (c + 0.5) * uCell;
  float t = bayer(ivec2(c));

  // Julian: a click sends a ripple out from where it lands, a ring that
  // pushes the lights outward as it passes and fades as it goes.
  vec2 rd = pc - uRipple.xy;
  float rl = length(rd) + 1e-4;
  float front = uRipple.z * uWave.x;
  float ring = step(0.0, uRipple.z) * exp(-uRipple.z * 3.2) *
               exp(-pow((rl - front) / 50.0, 2.0));
  vec2 wave = rd / rl * ring * uWave.y;

  // The lights, matched to Julian's reference: soft streaks running up to
  // the right that swell and dissolve where they are, never travelling.
  // A noise field stretched along the diagonal, changing with time.
  vec2 u = (pc - wave) / uRes.y;
  // The pointer pushes the lights aside where it passes (Julian: the
  // hover moves the lights).
  vec2 toP = u - uPointer / uRes.y;
  float pd = length(toP) + 1e-4;
  u += toP / pd * uOn * uLens * exp(-(pd * pd) / 0.03);
  vec2 dir = uLightDir;                     // up and to the right
  vec2 a = vec2(dot(u, dir), dot(u, vec2(-dir.y, dir.x))) / uLights.w;
  float n = noise(vec3(a.x * 3.6, a.y * 8.5, uLightT));
  float f = smoothstep(uLights.y, uLights.y + uLights.z, n);
  // The ripple's ring lights the grain it passes through.
  float field = quant(clamp(f * uLights.x + ring * 0.45, 0.0, 1.0), t);

  fragColor = vec4(mix(mix(GROUND, PAPER, uLight), mix(INK, PRINT, uLight), field), 1.0);
}
`;

/** `children`: the line, the services and the ask. `foot`: the client marks, along the bottom of the screen. */
export function AboutHero({
  children,
  foot,
}: {
  children?: React.ReactNode;
  foot?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const dials = useDialKit("About background", BG, { id: "about-bg" });
  const look = React.useRef(dials);
  const refresh = React.useRef(() => {});
  React.useEffect(() => {
    look.current = dials;
    refresh.current();
  });

  React.useEffect(() => {
    const box = ref.current;
    const stage = stageRef.current;
    if (!box || !stage) return;
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
      /* No WebGL: the page's own ground. */
      return;
    }
    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.setAttribute("aria-hidden", "true");
    stage.appendChild(canvas);

    const u = {
      uRes: { value: [1, 1] },
      uDpr: { value: renderer.dpr },
      uCell: { value: BG.grain.cell[0] },
      uPointer: { value: [-1e4, -1e4] },
      uOn: { value: 0 },
      uRipple: { value: [0, 0, -1] },
      uLight: { value: 0 },
      uLevels: { value: 4 },
      uLights: { value: [0.32, 0.64, 0.28, 1] },
      uLightDir: { value: [0.819, -0.574] },
      uLightT: { value: 0 },
      uLens: { value: 0.09 },
      uWave: { value: [700, 22] },
    };
    /* The program once its shaders are compiled, in the GPU's own time
       (`lib/gl-warm.ts`); until then the stage is the page's own ground. */
    let mesh: Mesh | undefined;

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
    /* Julian: clicking makes it ripple. One ring at a time; a new click
       starts a new one. */
    const ripple = { x: 0, y: 0, at: -1e9 };
    const click = (e: PointerEvent) => {
      if (still) return;
      ripple.x = e.clientX;
      ripple.y = e.clientY;
      ripple.at = performance.now();
      wake();
    };
    box.addEventListener("pointermove", move, { passive: true });
    box.addEventListener("pointerleave", leave);
    box.addEventListener("pointerdown", click, { passive: true });

    const size = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (!w || !h) return;
      const phone = w < 640;
      const { grain, logos } = look.current;
      const cell = phone ? grain.phone : grain.cell;
      box.style.setProperty("--marquee-s", `${logos.seconds}s`);
      /* One fragment per grain cell, scaled up square by the stylesheet:
         the same picture for a sixth to a twenty-fifth of the work. */
      renderer.dpr = 1 / cell;
      renderer.setSize(w, h);
      u.uDpr.value = renderer.dpr;
      u.uRes.value = [w, h];
      u.uCell.value = cell;
    };

    let raf = 0;
    let visible = true;
    /* Once cleaned up it never starts again: the program can finish
       compiling after the component has gone (React mounts twice in
       development), and a loop woken then would run on for good. */
    let gone = false;
    /* The lights' clock is added up, so a change of their speed on the
       panel carries on from where they are instead of jumping. */
    let lightT = 0;
    let last = 0;
    const frame = (now: number) => {
      raf = 0;
      const l = look.current;
      pointer.on += (pointer.target - pointer.on) * 0.08;
      const r = box.getBoundingClientRect();
      if (!still && last) lightT += (Math.min(now - last, 50) / 1000) * l.lights.speed;
      last = now;
      u.uLightT.value = lightT;
      u.uLevels.value = l.grain.levels;
      u.uLights.value = [l.lights.amount, l.lights.start, l.lights.softness, l.lights.size];
      const a = (l.lights.angle * Math.PI) / 180;
      u.uLightDir.value = [Math.cos(a), -Math.sin(a)];
      u.uLens.value = l.hover.lights;
      u.uWave.value = [l.ripple.speed, l.ripple.push];
      const RIPPLE_S = l.ripple.seconds;
      u.uPointer.value = [pointer.x - r.left, pointer.y - r.top];
      u.uOn.value = pointer.on;
      const age = (now - ripple.at) / 1000;
      u.uRipple.value = [ripple.x - r.left, ripple.y - r.top, age < RIPPLE_S ? age : -1];
      if (mesh) renderer.render({ scene: mesh });

      const moving =
        Math.abs(pointer.target - pointer.on) > 0.01 || age < RIPPLE_S;

      /* The drift keeps it running while it is on screen; held still, it
         runs only while something is still settling. */
      if (visible && !document.hidden && (!still || moving)) wake();
    };
    const wake = () => {
      if (!raf && !gone) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    refresh.current = () => {
      size();
      wake();
    };

    buildProgram(gl, { vertex, fragment, depthTest: false, depthWrite: false, uniforms: u }).then((program) => {
      if (gone) return;
      mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
      wake();
    });

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
    const light = () => {
      u.uLight.value =
        document.documentElement.dataset.theme === "light" ? 1 : 0;
      wake();
    };
    light();
    const theme = new MutationObserver(light);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    document.addEventListener("visibilitychange", shown);
    size();

    return () => {
      gone = true;
      cancelAnimationFrame(raf);
      refresh.current = () => {};
      sizes.disconnect();
      view.disconnect();
      theme.disconnect();
      document.removeEventListener("visibilitychange", shown);
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerleave", leave);
      box.removeEventListener("pointerdown", click);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, []);

  /* Julian: the name and the facts under it end on one edge, the facts
     on one line. The facts line sets the width and the name is sized to
     it, as far as the room above lets it on a short screen. */
  React.useEffect(() => {
    const box = ref.current;
    const name = box?.querySelector<HTMLElement>(".about-hero-name");
    const last = box?.querySelector<HTMLElement>(".about-hero-line > .about-hero-ghost");
    const facts = box?.querySelector<HTMLElement>(".about-hero-facts");
    if (!box || !name || !last || !facts) return;
    const surname = document.createRange();
    surname.selectNodeContents(last);
    /* The name's size at which it is as wide as the facts. */
    const sized = (current: number) => {
      const items = [...facts.children].map((li) => li.getBoundingClientRect());
      const width =
        Math.max(...items.map((r) => r.right)) -
        Math.min(...items.map((r) => r.left));
      return current * (width / surname.getBoundingClientRect().width);
    };
    /* The slack above the name: the row it shares with the client marks
       sits at the foot on an auto margin, so what that margin comes to is
       what the name can grow, plus the foot's padding down to 16px. */
    const base = name.closest<HTMLElement>(".about-hero-base")!;
    const content = base.parentElement!;
    const slack = () =>
      (parseFloat(getComputedStyle(base).marginTop) || 0) +
      Math.max(0, parseFloat(getComputedStyle(content).paddingBottom) - 16) -
      Math.max(0, base.getBoundingClientRect().bottom - content.getBoundingClientRect().bottom + parseFloat(getComputedStyle(content).paddingBottom));
    const fit = () => {
      /* Julian: the intro as long as the title's line. The title wraps at
         its max-width, not on a break, so its longest line is measured. */
      const title = box.querySelector(".about-hero-title");
      if (title) {
        const words = [...title.querySelectorAll(".title-word")];
        const right = Math.max(...words.map((w) => w.getBoundingClientRect().right));
        box.style.setProperty(
          "--title-w",
          `${Math.round(right - title.getBoundingClientRect().left)}px`,
        );
      }
      name.style.fontSize = "";
      const current = parseFloat(getComputedStyle(name).fontSize);
      const grows = name.offsetHeight / current;
      let size = sized(current);
      /* A phone's screen grows to hold the words; a wide one does not. */
      if (box.clientWidth >= 640)
        size = Math.max(40, Math.min(size, current + slack() / grows));
      name.style.fontSize = `${size}px`;
    };
    fit();
    void document.fonts.ready.then(fit);
    const sizes = new ResizeObserver(fit);
    sizes.observe(box);
    return () => sizes.disconnect();
  }, []);

  return (
    <div ref={ref} className="about-hero">
      <div ref={stageRef} className="about-hero-stage" />

      {/* The line and the services at the top left, the name at the foot.
          The role line is gone: the title says it. */}
      {/* Scrolls inside itself where a short window cannot hold it all,
          the strip yielding the wheel to it (as the contact form does). */}
      <div className="about-hero-content" data-scroll>
        <div className="about-hero-bio">{children}</div>
        {/* The name and the facts, the client marks under them. */}
        <div className="about-hero-base">
          <div className="about-hero-copy">
            <div
              className="about-hero-name"
              aria-label="Julian Gigola"
            >
              {/* Julian: one line, as in the homepage's hero. Set in the page,
                  unseen, for its size (the fit below measures it), with the
                  warp drawn over it. */}
              <span className="about-hero-line" aria-hidden>
                <span className="about-hero-ghost">Julian Gigola</span>
                <NameLine text="Julian Gigola" />
              </span>
            </div>
            <ul className="about-hero-facts">
              <li>Based in San Francisco, CA</li>
              <li>Available worldwide</li>
            </ul>
          </div>
          {foot}
        </div>
      </div>
    </div>
  );
}

/** A line of the wordmark through WarpText, as on the homepage. */
function NameLine({ text }: { text: string }) {
  return (
    <WarpText
      text={text}
      fontFamily="var(--font-display)"
      fontWeight={900}
      fontSize="1em"
      letterSpacing="-0.045em"
      warpStrength={NAME_WARP.warpStrength}
      warpScale={NAME_WARP.warpScale}
      speed={NAME_WARP.speed}
      pointerInfluence={NAME_WARP.pointerInfluence}
      pointerStrength={NAME_WARP.pointerStrength}
      refraction={NAME_WARP.refraction}
      ripple={NAME_WARP.ripple}
      className="about-hero-warp"
    />
  );
}
