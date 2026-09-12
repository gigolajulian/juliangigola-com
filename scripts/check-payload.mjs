/**
 * What /admin commits.
 *
 * The one check in here that runs the real function rather than a copy of it.
 * `lib/admin-payload.ts` is dependency-free precisely so this can import it
 * under Node's type stripping — the other scripts mirror the code they cover,
 * which is fine for a loop that counts frames and not fine for the function
 * that decides what gets written to the repository.
 *
 * Publishing itself is not covered and cannot be: it needs a GitHub token that
 * is Julian's. That was never the risk — those commits land today and the repo
 * history shows them. The risk is a field quietly missing from the payload,
 * which publishes as "you never made that edit" and only shows up on the live
 * site.
 *
 *   node --experimental-strip-types scripts/check-payload.mjs
 */

import assert from "node:assert/strict";
import { projectsFile, tidySequence } from "../lib/admin-payload.ts";

const edit = {
  hidden: [],
  categories: {},
  frames: {},
  credits: {},
  order: [],
  covers: {},
};

// What is already in the repo is carried through, not clobbered.
{
  const existing = {
    projects: [{ slug: "a" }],
    trash: [{ slug: "b", deletedAt: "2026-01-01T00:00:00Z" }],
  };
  const out = projectsFile(existing, edit);
  assert.deepEqual(out.projects, existing.projects, "projects survive");
  assert.deepEqual(out.trash, existing.trash, "trash survives");
  assert.notEqual(out, existing, "the existing file is not mutated in place");
}

// No file yet.
{
  const out = projectsFile(null, edit);
  assert.deepEqual(out.projects, [], "a first publish still has the key");
  assert.deepEqual(out.trash, [], "…and an empty bin");
}

// Empty means absent, for both new maps.
{
  const out = projectsFile(null, edit);
  assert.ok(!("order" in out), "an empty order is not written at all");
  assert.ok(!("covers" in out), "nor an empty cover map");
}

// And a previously-written one is removed when it is emptied, rather than
// being left behind — the failure mode where dragging everything back to the
// original order leaves the old order in the file.
{
  const out = projectsFile(
    { projects: [], order: ["a", "b"], covers: { portraits: "/work/x/01.jpg" } },
    edit,
  );
  assert.ok(!("order" in out), "emptying the order removes it");
  assert.ok(!("covers" in out), "emptying the covers removes it");
}

// The two new fields, carried.
{
  const out = projectsFile(null, {
    ...edit,
    order: ["valgur", "cyber1a"],
    covers: { "artist-presskit": "/work/l3na/02.jpg" },
  });
  assert.deepEqual(out.order, ["valgur", "cyber1a"], "order is committed");
  assert.deepEqual(
    out.covers,
    { "artist-presskit": "/work/l3na/02.jpg" },
    "picked covers are committed",
  );
}

// `order` is copied, not aliased: the editor holds its own array and a publish
// must not hand the committed object a live reference to it.
{
  const live = ["a", "b"];
  const out = projectsFile(null, { ...edit, order: live });
  live.push("c");
  assert.deepEqual(out.order, ["a", "b"], "the payload snapshots the order");
}

// Hidden is sorted, so a diff shows the edit and not Set iteration order.
{
  const out = projectsFile(null, { ...edit, hidden: new Set(["c", "a", "b"]) });
  assert.deepEqual(out.hidden, ["a", "b", "c"], "hidden is sorted");
}

// Empty passages go, and a sequence of nothing but empties leaves no entry —
// an empty array would mean "this gallery has no frames", which `lib/added.ts`
// rejects outright.
{
  const out = projectsFile(null, {
    ...edit,
    frames: {
      kept: ["/work/a/01.jpg", { kind: "text", heading: null, body: "  " }],
      gone: [{ kind: "text", heading: null, body: "" }],
      written: [{ kind: "text", heading: "H", body: "real" }, "/work/a/01.jpg"],
    },
  });
  assert.deepEqual(out.frames.kept, ["/work/a/01.jpg"], "blank passage goes");
  assert.ok(!("gone" in out.frames), "an all-empty sequence leaves no entry");
  assert.equal(out.frames.written.length, 2, "written passages are kept");
}

// The tidy on its own.
{
  assert.deepEqual(tidySequence([]), [], "nothing to tidy");
  assert.deepEqual(
    tidySequence(["/a.jpg", { kind: "text", body: "\n\t " }]),
    ["/a.jpg"],
    "whitespace is not writing",
  );
}

console.log("admin payload: 16 cases pass");
