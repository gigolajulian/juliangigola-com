import { mkdirSync, writeFileSync } from "node:fs";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import type { Metric } from "./helpers";

/**
 * A compact summary in place of Playwright's list: one table per kind of
 * measurement, then every failure on one line each. The rows also go to
 * `test-results/perf.json` for comparing one run with the next.
 */

type Row = Metric & { browser: string; ok: boolean };

const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));
const num = (v: unknown, digits = 1) => (typeof v === "number" ? v.toFixed(digits) : String(v ?? "-"));

/** Column headings, and how to print each one, per kind. */
const COLUMNS: Record<Metric["kind"], [string, (r: Row) => string][]> = {
  swipe: [
    ["landed", (r) => String(r.landed ?? "-")],
    ["frames", (r) => num(r.frames, 0)],
    ["median ms", (r) => num(r.median)],
    ["slow %", (r) => num(r.slow)],
    ["worst ms", (r) => num(r.worst, 0)],
  ],
  splash: [
    ["lifted ms", (r) => num(r.lifted, 0)],
    ["frames", (r) => num(r.frames, 0)],
    ["median ms", (r) => num(r.median)],
    ["slow %", (r) => num(r.slow)],
    ["worst ms", (r) => num(r.worst, 0)],
  ],
  images: [
    ["images", (r) => num(r.count, 0)],
    ["KB", (r) => num(r.kb, 0)],
    ["budget KB", (r) => num(r.budget, 0)],
  ],
};

export default class PerfReporter implements Reporter {
  private rows: Row[] = [];
  private failures: string[] = [];
  private passed = 0;
  private skipped = 0;

  onTestEnd(test: TestCase, result: TestResult) {
    const browser = test.parent.project()?.name ?? "";
    const ok = result.status === "passed";
    if (result.status === "skipped") this.skipped++;
    else if (ok) this.passed++;
    for (const a of result.attachments) {
      if (a.name !== "perf" || !a.body) continue;
      this.rows.push({ ...(JSON.parse(a.body.toString()) as Metric), browser, ok });
    }
    if (!ok && result.status !== "skipped") {
      const why = result.errors
        .map((e) => (e.message ?? "").replace(/\u001b\[[0-9;]*m/g, "").split("\n").filter(Boolean).slice(0, 12).join(" | "))
        .join(" || ");
      this.failures.push(`${browser} ${test.titlePath().slice(2).join(" > ")}: ${why.slice(0, 1200)}`);
    }
  }

  onEnd(result: FullResult) {
    for (const kind of Object.keys(COLUMNS) as Metric["kind"][]) {
      const rows = this.rows.filter((r) => r.kind === kind);
      if (!rows.length) continue;
      const cols = COLUMNS[kind];
      const head = ["", "browser", "page", "viewport", ...cols.map(([h]) => h)];
      const body = rows.map((r) => [r.ok ? " " : "x", r.browser, r.page, r.viewport, ...cols.map(([, f]) => f(r))]);
      const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
      console.log(`\n${kind}`);
      console.log(head.map((h, i) => pad(h, widths[i])).join("  "));
      for (const b of body) console.log(b.map((c, i) => pad(c, widths[i])).join("  "));
    }
    if (this.failures.length) {
      console.log(`\nfailures (${this.failures.length})`);
      for (const f of this.failures) console.log(`  ${f}`);
    }
    console.log(`\n${this.passed} passed, ${this.failures.length} failed, ${this.skipped} skipped: ${result.status}`);
    mkdirSync("test-results", { recursive: true });
    writeFileSync(`test-results/perf${process.env.PERF_PHASE ? "-" + process.env.PERF_PHASE : ""}.json`, JSON.stringify(this.rows, null, 1));
  }

  printsToStdio() {
    return true;
  }
}
