/**
 * Swipes a page in real Safari and prints how its frames went.
 *
 * Playwright's WebKit is Safari's engine but not Safari: no trackpad
 * physics, no Safari compositor settings, and headless it draws this site
 * at a few frames a second. This drives the Safari that is installed,
 * through `safaridriver` (WebDriver), with no packages to install.
 *
 *   node scripts/perf/safari.mjs                        # http://localhost:3100/
 *   node scripts/perf/safari.mjs http://localhost:3100/portfolio --swipes 6
 *   node scripts/perf/safari.mjs --size 1440x900 --back
 *   node scripts/perf/safari.mjs --synthetic           # page events only
 *   node scripts/perf/safari.mjs --splash              # the first-visit splash
 *
 * Each swipe is a trackpad-style run of horizontal wheel deltas that tails
 * off, as a flick on a MacBook does. WebDriver wheel actions are tried
 * first, which Safari treats as real input; where this Safari refuses
 * them the same deltas are fired as `wheel` events in the page, which the
 * strip's own wheel handling (Lenis, `components/strip.tsx`) takes the same
 * way.
 *
 * Printed per run: where each swipe landed in screens, then the frames
 * from the first delta until the strip came to rest: median frame ms, the
 * share slower than 20ms, and the worst.
 *
 * One-time setup on the Mac (safaridriver refuses a session without it):
 *   1. Safari > Settings > Advanced > "Show features for web developers".
 *   2. Develop > "Allow Remote Automation".
 *   3. In a terminal: `sudo safaridriver --enable` (asks for the password).
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const URL = args.find((a) => /^https?:\/\//.test(a)) ?? "http://localhost:3100/";
const SWIPES = Number(flag("swipes", "4"));
const [WIDTH, HEIGHT] = flag("size", "1440x900").split("x").map(Number);
const PORT = Number(flag("port", "4445"));
/** Swipe back the same number of times after going forward. */
const BACK = args.includes("--back");
// The page's own wheel events, skipping WebDriver's.
const SYNTHETIC_ONLY = args.includes("--synthetic");
// The first-visit splash instead of swipes.
const SPLASH = args.includes("--splash");
/** The strip a swipe moves. The homepage and every horizontal page have one. */
const STRIP = flag("selector", ".strip-scroll");

const SETUP = `Safari is not accepting WebDriver sessions. One-time setup:
  1. Safari > Settings > Advanced > "Show features for web developers"
  2. Develop menu > "Allow Remote Automation"
  3. Terminal: sudo safaridriver --enable`;

const base = `http://127.0.0.1:${PORT}`;

/** One WebDriver command. Throws with the driver's own message on error. */
async function wd(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.value?.error) {
    const err = new Error(json.value?.message || `${method} ${path}: HTTP ${res.status}`);
    err.code = json.value?.error;
    throw err;
  }
  return json.value;
}

/** Waits for safaridriver to answer on its port. */
async function ready() {
  for (let i = 0; i < 50; i++) {
    try {
      await wd("GET", "/status");
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error(`safaridriver did not start on port ${PORT}`);
}

/* Runs in the page: records every frame's length from now on. */
const RECORD = `
  const f = (window.__perfFrames = []);
  window.__perfOn = false;
  let last = 0;
  const tick = (t) => {
    if (last && window.__perfOn) f.push(t - last);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // The wheel events that reached the page, to tell input that was sent
  // from input that arrived.
  const w = (window.__perfWheel = []);
  addEventListener("wheel", (e) => w.push([e.deltaMode, e.deltaX, e.deltaY]), { capture: true, passive: true });
`;

/* Runs in the page: the strip's width and where it stands. */
const WHERE = `
  const el = document.querySelector(arguments[0]);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: el.scrollLeft, width: el.clientWidth, x: r.left + r.width / 2, y: r.top + r.height / 2 };
`;

/* Runs in the page (async): waits for the strip to stop moving, up to 3s. */
const SETTLE = `
  const [sel, done] = [arguments[0], arguments[arguments.length - 1]];
  const el = document.querySelector(sel);
  let last = el.scrollLeft, still = 0;
  const t0 = performance.now();
  const step = () => {
    const now = el.scrollLeft;
    still = Math.abs(now - last) < 0.5 ? still + 1 : 0;
    last = now;
    if (still >= 20 || performance.now() - t0 > 3000) done(now);
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
`;

/* Runs in the page (async): the swipe's deltas as wheel events. */
const SYNTHETIC = `
  const [deltas, x, y, done] = arguments;
  const target = document.elementFromPoint(x, y) || document.body;
  let i = 0;
  const next = () => {
    if (i >= deltas.length) return done(true);
    target.dispatchEvent(new WheelEvent("wheel", {
      deltaX: deltas[i++], deltaMode: 0, clientX: x, clientY: y, bubbles: true, cancelable: true,
    }));
    setTimeout(next, 16);
  };
  next();
`;

/** A trackpad flick: 24 deltas 16ms apart, tailing off. */
const flick = (sign) => Array.from({ length: 24 }, (_, i) => sign * Math.round(40 * Math.exp(-i / 8)));

const stats = (frames) => {
  if (!frames.length) return { median: 0, slow: 0, worst: 0 };
  const s = [...frames].sort((a, b) => a - b);
  return {
    median: s[Math.floor(s.length / 2)],
    slow: (100 * frames.filter((d) => d > 20).length) / frames.length,
    worst: s[s.length - 1],
  };
};

const driver = spawn("safaridriver", ["-p", String(PORT)], { stdio: "ignore" });
let session = null;
let code = 0;

try {
  await ready();
  try {
    session = (await wd("POST", "/session", { capabilities: { alwaysMatch: { browserName: "safari" } } }))
      .sessionId;
  } catch (err) {
    console.error(err.message);
    console.error(SETUP);
    code = 2;
  }

  if (session) {
    const s = `/session/${session}`;
    const run = (script, a = []) => wd("POST", `${s}/execute/sync`, { script, args: a });
    const runAsync = (script, a = []) => wd("POST", `${s}/execute/async`, { script, args: a });
    await wd("POST", `${s}/timeouts`, { script: 15000 });
    await wd("POST", `${s}/window/rect`, { x: 0, y: 0, width: WIDTH, height: HEIGHT });

    /* The splash (`components/intro.tsx`): a new session has not seen it,
       so it plays on the first load. Frames from the moment WebDriver
       hands the page back, which is after its load event, until the
       splash has lifted (`data-intro` gone). */
    if (SPLASH) {
      await wd("POST", `${s}/url`, { url: URL });
      const r = await runAsync(
        `const done = arguments[arguments.length - 1];
         const f = [];
         let last = 0;
         const t0 = performance.now();
         const tick = (t) => {
           if (last) f.push(t - last);
           last = t;
           const on = document.documentElement.dataset.intro !== undefined;
           if (on && performance.now() - t0 < 12000) requestAnimationFrame(tick);
           else done({ frames: f, lifted: on ? -1 : performance.now(), played: f.length > 0 });
         };
         requestAnimationFrame(tick);`,
      );
      const st = stats(r.frames);
      console.log(`${URL}  ${WIDTH}x${HEIGHT}  splash`);
      console.log(r.lifted < 0 ? "splash did not lift within 12s" : `lifted at ${Math.round(r.lifted)}ms after navigation`);
      console.log(
        `frames ${r.frames.length}  median ${st.median.toFixed(1)}ms  slow>20ms ${st.slow.toFixed(1)}%  worst ${Math.round(st.worst)}ms`,
      );
    } else {
      // The splash runs once a visit: mark it seen, then load the page for real.
      await wd("POST", `${s}/url`, { url: URL });
      await run(`try { sessionStorage.setItem("jg-intro", "1"); } catch (e) {}`);
      await wd("POST", `${s}/url`, { url: URL });
      await sleep(2500);
      await run(RECORD);

      const at = await run(WHERE, [STRIP]);
      if (!at) throw new Error(`No ${STRIP} on ${URL}`);

      /* WebDriver wheel actions first; the page's own events if refused. */
      let mode = SYNTHETIC_ONLY ? "synthetic wheel" : "webdriver wheel";
      const swipe = async (deltas) => {
        if (mode === "webdriver wheel") {
          try {
            /* safaridriver reads each scroll's delta as a running total
               and sends the page the difference from the one before: sent
               40, 35, 31 the page got 40, -5, -4, a push and a pull, and
               nothing moved. So it is sent the running totals. */
            let total = 0;
            const totals = deltas.map((d) => (total += d));
            await wd("POST", `${s}/actions`, {
              actions: [
                {
                  type: "wheel",
                  id: "trackpad",
                  actions: totals.map((d) => ({
                    type: "scroll",
                    x: Math.round(at.x),
                    y: Math.round(at.y),
                    deltaX: d,
                    deltaY: 0,
                    duration: 16,
                    origin: "viewport",
                  })),
                },
              ],
            });
            return;
          } catch {
            mode = "synthetic wheel";
          }
        }
        await runAsync(SYNTHETIC, [deltas, at.x, at.y]);
      };

      const plan = [...Array(SWIPES).fill(1), ...(BACK ? Array(SWIPES).fill(-1) : [])];
      const landed = [];
      await run(`window.__perfOn = true;`);
      for (const sign of plan) {
        const from = (await run(WHERE, [STRIP])).left;
        await swipe(flick(sign));
        const to = await runAsync(SETTLE, [STRIP]);
        landed.push((to - from) / at.width);
        await sleep(400);
      }
      const frames = await run(`window.__perfOn = false; return window.__perfFrames;`);
      const wheel = await run(`return window.__perfWheel;`);
      const st = stats(frames);

      console.log(`${URL}  ${WIDTH}x${HEIGHT}  ${plan.length} swipes (${mode})`);
      console.log(
        `wheel events seen ${wheel.length}` +
          (wheel.length ? `, first deltaX ${wheel.slice(0, 3).map((e) => e[1]).join(" ")} (mode ${wheel[0][0]})` : ""),
      );
      console.log(`landed (screens): ${landed.map((n) => (n >= 0 ? "+" : "") + n.toFixed(2)).join(" ")}`);
      console.log(
        `frames ${frames.length}  median ${st.median.toFixed(1)}ms  slow>20ms ${st.slow.toFixed(1)}%  worst ${Math.round(st.worst)}ms`,
      );
    }
  }
} catch (err) {
  console.error(err.message);
  code = 1;
} finally {
  if (session) await wd("DELETE", `/session/${session}`).catch(() => {});
  driver.kill();
}
process.exit(code);
