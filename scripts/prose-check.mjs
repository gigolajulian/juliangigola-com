#!/usr/bin/env node
/* The rag check (Julian, 2026-10-22): every paragraph of body text on the
 * site, at a phone, a laptop and a wide screen, in Chromium, Firefox and
 * WebKit. Fails when a paragraph
 *   - averages under 25 characters a line on a desktop,
 *   - breaks a pair that reads as one ("San / Jose", "90 / minutes").
 * Warns, without failing, when a paragraph ends on a single word: Firefox
 * has no balanced wrapping, and gluing the last two words in script made
 * worse breaks than the lone word (8% lines on /legal, 2026-10-22).
 *
 *   node scripts/prose-check.mjs [base] [engines]
 *   base: default http://localhost:3000; engines: chromium,firefox,webkit
 * Exits 1 on any failure, after listing them all. */
import { chromium, firefox, webkit } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3000";
const ENGINES = (process.argv[3] || "chromium,firefox,webkit").split(",");
const PAGES = ["/?intro=0", "/book?intro=0", "/portfolio", "/portraits", "/headshots", "/legal"];
const SIZES = [[390, 844], [1440, 900], [2560, 1080]];
const launchers = { chromium, firefox, webkit };

/* Runs in the page: each paragraph's lines, from where its words land. */
function measure(desktop) {
  const out = [];
  for (const p of document.querySelectorAll("p")) {
    if (p.closest(".label, [aria-hidden=true]") || p.matches(".label, .font-display, .whitespace-nowrap")) continue;
    const s = getComputedStyle(p);
    if (s.display === "none" || s.visibility === "hidden" || !p.getClientRects().length) continue;
    const text = p.innerText.trim();
    if (text.length < 60) continue;
    const lines = new Map();
    const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      for (const m of n.data.matchAll(/\S+/g)) {
        const r = document.createRange();
        r.setStart(n, m.index);
        r.setEnd(n, m.index + m[0].length);
        const box = r.getClientRects()[0];
        if (!box || !box.width) continue;
        const key = Math.round(box.top / 4);
        const line = lines.get(key) || { words: [], left: box.left, right: box.right };
        line.words.push(m[0]);
        line.left = Math.min(line.left, box.left);
        line.right = Math.max(line.right, box.right);
        lines.set(key, line);
      }
    }
    const rows = [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
    if (rows.length < 2) continue;
    const last = rows[rows.length - 1];
    const problems = [];
    const warn = last.words.length === 1 ? `last line is one word ("${last.words[0]}")` : "";
    const avg = text.length / rows.length;
    /* A balanced list (the sessions' includes, items held whole) is short on purpose. */
    if (desktop && avg < 25 && !p.matches(".text-balance")) problems.push(`${Math.round(avg)} characters a line`);
    rows.slice(0, -1).forEach((l, i) => {
      const end = l.words[l.words.length - 1];
      const next = rows[i + 1].words[0];
      if (/^(San|Bay|South|Silicon)$/.test(end) || (/^\d+$/.test(end) && /^(minutes?|hours?|looks?|outfits?)\b/.test(next))) problems.push(`"${end} / ${next}" split`);
    });
    if (problems.length || warn) out.push({ text: text.slice(0, 50).replace(/\s+/g, " "), problems, warn });
  }
  return out;
}

let failed = 0;
for (const name of ENGINES) {
  const browser = await launchers[name].launch();
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(() => { try { sessionStorage.setItem("jg-intro", "1"); } catch {} });
    const page = await ctx.newPage();
    for (const path of PAGES) {
      try {
        await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 });
      } catch {
        console.log(`${name} ${w}x${h} ${path}: did not load`);
        failed++;
        continue;
      }
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1200);
      const bad = await page.evaluate(measure, w >= 1024);
      for (const b of bad) {
        if (b.problems.length) failed++;
        const said = [...b.problems, ...(b.warn ? [`(warning) ${b.warn}`] : [])];
        console.log(`${name} ${w}x${h} ${path}: "${b.text}…" ${said.join("; ")}`);
      }
    }
    await ctx.close();
  }
  await browser.close();
}
console.log(failed ? `\n${failed} paragraph problem(s).` : "prose: ok");
process.exit(failed ? 1 : 0);
