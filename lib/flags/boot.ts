/** The head script that sets the boot flags on <html> before the first paint (app/layout.tsx renders it inline).
    Each concern has its own try, because storage throws outright in some privacy modes.
    - `data-v3motion`: the site's motion, on unless `?v3motion=0` turned it off for the tab (`?v3motion` turns it back on).
    - `data-solidhdr`: the solid header, kept for the tab by `?blur=0` (`?blur` clears it).
    - `data-navfx`: the nav ink, on unless `?navfx=0` turned it off for the tab (`?navfx` turns it back on).
    - `data-moves`: motion not turned down in the system.
    - `data-mt-intro`: the homepage opening (components/home/intro), once a visit; `?intro=1` again, `?intro=0` never.
      Late after 6 s with nothing owning it (`data-mt-late`).
    - `data-cover-intro`: the JG cover on a first arrival on an inner page (not /book or the private pages), once a visit.
    - `data-intro` + `data-splash="split"`: `?splash=split` plays the split splash (components/splash/split-splash.ts) on an inner page. */
export const BOOT_HEAD = `(function(){
var root = document.documentElement, q = location.search, path = location.pathname, mo = true;
try {
  var k3 = "jg-v3motion-off";
  if (/[?&]v3motion=0/.test(q)) sessionStorage.setItem(k3, "1");
  else if (/[?&]v3motion/.test(q)) sessionStorage.removeItem(k3);
  mo = !sessionStorage.getItem(k3);
} catch (e) {}
if (mo) root.dataset.v3motion = "";
try {
  var kb = "jg-solidhdr";
  if (/[?&]blur=0/.test(q)) sessionStorage.setItem(kb, "1");
  else if (/[?&]blur/.test(q)) sessionStorage.removeItem(kb);
  if (sessionStorage.getItem(kb)) root.dataset.solidhdr = "";
} catch (e) {}
try {
  var kn = "jg-navfx-off";
  if (/[?&]navfx=0/.test(q)) sessionStorage.setItem(kn, "1");
  else if (/[?&]navfx/.test(q)) sessionStorage.removeItem(kn);
  if (!sessionStorage.getItem(kn)) root.dataset.navfx = "";
} catch (e) { root.dataset.navfx = ""; }
try {
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) root.dataset.moves = "";
} catch (e) {}
try {
  var home = path === "/";
  if (home && mo && !/[?&]intro=0/.test(q) && !matchMedia("(prefers-reduced-motion: reduce)").matches && (/[?&]intro=1/.test(q) || !sessionStorage.getItem("jg-intro"))) {
    root.dataset.mtIntro = "1";
    setTimeout(function () {
      if (root.dataset.mtIntro === "1" && !("mtOwn" in root.dataset)) { delete root.dataset.mtIntro; root.dataset.mtLate = ""; }
    }, 6000);
  }
  if (/[?&]intro=0/.test(q) || !mo || home) return;
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var admin = path.indexOf("/admin") === 0 || path.indexOf("/proof/") === 0 || path.indexOf("/delivery/") === 0 || path.indexOf("/contract/") === 0 || /^(admin|leads)[.]/.test(location.hostname);
  if (path.indexOf("/book") !== 0 && !admin && !calm) {
    var kc = "jg-cover-intro", sc = false;
    try { sc = !!sessionStorage.getItem(kc); sessionStorage.setItem(kc, "1"); } catch (e) { sc = true; }
    if (!sc || /[?&]intro=1/.test(q)) root.dataset.coverIntro = "";
  }
  if (/[?&]splash=split/.test(q)) {
    root.dataset.intro = "1";
    root.dataset.splash = "split";
    root.style.setProperty("--jg-blink-at", Math.round(100 + Math.random() * 160) + "ms");
  }
} catch (e) {}
})()`;
