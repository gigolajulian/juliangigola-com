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
import {
  projectsFile,
  tidySequence,
  same,
  adoptable,
  withOverride,
} from "../lib/admin-payload.ts";

const edit = {
  hidden: [],
  unlisted: [],
  categories: {},
  frames: {},
  credits: {},
  copy: {},
  order: [],
  covers: {},
  avatars: {},
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
  assert.ok(!("avatars" in out), "nor an empty set of faces");
}

// A face is written, and by handle: one person, one picture, however many
// shoots they are credited on.
{
  const out = projectsFile(null, {
    ...edit,
    avatars: { anisajadee: "/people/anisajadee.jpg" },
  });
  assert.deepEqual(
    out.avatars,
    { anisajadee: "/people/anisajadee.jpg" },
    "a collaborator's face is committed",
  );
}

// And adopted back off the repository, like every other map.
{
  const back = adoptable(
    { projects: [], avatars: { anisajadee: "/people/anisajadee.jpg" } },
    edit,
  );
  assert.deepEqual(
    back.avatars,
    { anisajadee: "/people/anisajadee.jpg" },
    "faces come back off the file",
  );
  assert.deepEqual(
    adoptable({ projects: [] }, { ...edit, avatars: { x: "/people/x.jpg" } })
      .avatars,
    {},
    "a file with no faces means none, not the ones the build had",
  );
}

// And a previously-written one is removed when it is emptied, rather than
// being left behind — the failure mode where dragging everything back to the
// original order leaves the old order in the file.
{
  const out = projectsFile(
    {
      projects: [],
      order: ["a", "b"],
      covers: { portraits: "/work/x/01.jpg" },
    },
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

// Is anything unpublished? The comparison behind the Publish button.
{
  // The bug this replaced `JSON.stringify` over: `lib/content.ts` builds the
  // object field by field, `content/site.json` carries `heroDisciplines` last,
  // and the editor called that a change for ever.
  const built = {
    coverSlug: "a",
    heroDisciplines: ["editorial"],
    featured: [],
  };
  const fromRepo = {
    coverSlug: "a",
    featured: [],
    heroDisciplines: ["editorial"],
  };
  assert.notEqual(
    JSON.stringify(built),
    JSON.stringify(fromRepo),
    "the two really do serialise differently — otherwise this proves nothing",
  );
  assert.ok(same(built, fromRepo), "key order is not an edit");

  // Records keyed by slug: refiling a project and refiling it back is not one
  // either, whichever order the keys ended up in.
  assert.ok(
    same({ a: "x", b: "y" }, { b: "y", a: "x" }),
    "slug order is not an edit",
  );

  // But a real change still is, at every depth.
  assert.ok(
    !same(built, { ...built, coverSlug: "b" }),
    "a changed field is an edit",
  );
  assert.ok(!same({ a: "x" }, { a: "x", b: "y" }), "an added key is an edit");
  assert.ok(!same({ a: "x", b: "y" }, { a: "x" }), "a removed key is an edit");
  assert.ok(
    !same({ s: [{ n: 1 }] }, { s: [{ n: 2 }] }),
    "a change inside an array of objects is an edit",
  );

  // Array order counts — a running order is a sequence, and dragging is the edit.
  assert.ok(!same(["a", "b"], ["b", "a"]), "reordering a list is an edit");

  // An omitted optional field and one explicitly undefined mean the same thing;
  // `lib/content.ts` produces the second from the first.
  assert.ok(
    same({ q: "x" }, { q: "x", role: undefined }),
    "absent is undefined",
  );
}

// Reading the repository's own list back in, which is what the editor
// compares against — not the build that served the page.
{
  const build = {
    hidden: ["old"],
    unlisted: [],
    categories: { a: "editorial" },
    frames: { a: ["/work/a/01.jpg"] },
    credits: { a: [{ role: "Model", name: "X" }] },
    copy: { a: { title: "A", intent: null } },
    order: ["a", "b"],
    covers: { editorial: "/work/a/01.jpg" },
    avatars: {},
  };

  // The round trip: what `projectsFile` writes is what `adoptable` reads.
  const file = projectsFile(null, build);
  assert.ok(
    same(adoptable(file, build), build),
    "a manifest survives the round trip",
  );

  // The one that matters — `projectsFile` deletes an empty field rather than
  // writing it, so an absent field means empty and must not fall back to the
  // build, or covers from three publishes ago come back from the dead.
  const emptied = projectsFile(null, {
    ...build,
    order: [],
    covers: {},
    avatars: {},
  });
  assert.ok(!("order" in emptied), "an empty order is not written");
  const read = adoptable(emptied, build);
  assert.deepEqual(read.order, [], "an absent order reads as empty");
  assert.deepEqual(read.covers, {}, "an absent cover pick reads as empty");
  assert.deepEqual(
    read.hidden,
    build.hidden,
    "the fields that were written survive",
  );

  // Present but malformed — a hand-edited file. Keeping the stale value beats
  // blanking something real.
  const bad = adoptable(
    { projects: [], order: "a,b", covers: { editorial: 7 } },
    build,
  );
  assert.deepEqual(
    bad.order,
    build.order,
    "a string where a list belongs falls back",
  );
  assert.deepEqual(
    bad.covers,
    build.covers,
    "a number where a path belongs falls back",
  );

  // A file this editor has never written to keeps nothing it did not say.
  assert.ok(
    same(adoptable({ projects: [] }, build), {
      hidden: [],
      unlisted: [],
      categories: {},
      frames: {},
      credits: {},
      copy: {},
      order: [],
      covers: {},
    avatars: {},
    }),
    "a bare file reads as a bare manifest",
  );
}

// Undoing an edit on a gallery the repository already overrides.
{
  const published = { mirage: ["/work/mirage/16.jpg", "/work/mirage/01.jpg"] };

  // The bug: the sequence editor reports null when the frames are back in the
  // order it found them, and that order is the published override — so the
  // override has to stand, not be deleted. Deleting it published "no
  // override", which lays the gallery out in the harvester's order and throws
  // away the earlier edit.
  assert.deepEqual(
    withOverride(
      { mirage: ["/work/mirage/01.jpg"] },
      "mirage",
      null,
      published,
    ),
    published,
    "undo restores what is published",
  );

  // And nothing is left behind where there was nothing published to keep.
  assert.deepEqual(
    withOverride({ sago: ["/work/sago/02.jpg"] }, "sago", null, published),
    {},
    "undo on an un-overridden gallery leaves no entry",
  );

  // A real edit is stored, and the other galleries are untouched.
  const edited = withOverride(
    published,
    "sago",
    ["/work/sago/02.jpg"],
    published,
  );
  assert.deepEqual(edited.sago, ["/work/sago/02.jpg"], "an edit is stored");
  assert.deepEqual(
    edited.mirage,
    published.mirage,
    "other galleries are untouched",
  );
  assert.notEqual(edited, published, "the map is not mutated in place");

  // An intentionally empty list is not an undo — it is a credit block someone
  // emptied on purpose, and it publishes.
  assert.deepEqual(
    withOverride({}, "sago", [], published).sago,
    [],
    "an empty list is a value, not an absence",
  );
}

/* The guard in `components/admin-editor.tsx` that refuses a publish which
   would undo somebody else's commit. It is this comparison and nothing else,
   so this is where it is worth proving.

   The case is the one that actually happened: `f807362`, an /admin save from
   a page older than the commits that added the credits, which wrote its empty
   credit map over them and deleted two projects' worth. */
{
  const baseline = { ...edit };

  // The repo grew a credit block this page has never seen. Refuse.
  const ahead = adoptable(
    { projects: [], trash: [], credits: { "i-wanna-be-a-human": [{ role: "Model" }] } },
    baseline,
  );
  assert.equal(
    same(ahead, baseline),
    false,
    "a credit block added since this page loaded is not the baseline",
  );

  // The repo is exactly where this page left it. Publish.
  const level = adoptable({ projects: [], trash: [] }, baseline);
  assert.equal(same(level, baseline), true, "an unchanged repo publishes");

  // And the same for every other map the manifest writes wholesale, because
  // each one is overwritten by `projectsFile` the same way credits are.
  for (const [key, value] of [
    ["categories", { mirage: "chroma" }],
    ["frames", { sago: ["/work/sago/02.jpg"] }],
    ["avatars", { hennyoh: "/people/hennyoh.jpg" }],
    ["covers", { video: "/work/sago/01.jpg" }],
    ["order", ["sago"]],
    ["hidden", ["sago"]],
    ["unlisted", ["rouge"]],
  ]) {
    assert.equal(
      same(adoptable({ projects: [], trash: [], [key]: value }, baseline), baseline),
      false,
      `${key} moving in the repo is caught`,
    );
  }
}

/* The one way the guard above can rot: a field added to `projectsFile`
   and not to `adoptable`. The editor would then overwrite that field on
   every publish and the guard would never see it move, which is the
   `f807362` failure with a new name. So: everything `projectsFile` writes,
   `adoptable` reads back, or this fails on the day the field is added. */
{
  const rich = {
    hidden: ["a"],
    unlisted: ["b"],
    categories: { p: "editorial" },
    frames: { p: ["/work/p/01.jpg"] },
    credits: { p: [{ role: "Model", name: "X" }] },
    copy: { p: { title: "T", intent: null } },
    order: ["p", "q"],
    covers: { editorial: "/work/p/01.jpg" },
    avatars: { x: "/people/x.jpg" },
  };
  const back = adoptable(projectsFile({ projects: [], trash: [] }, rich), edit);
  assert.equal(
    same(back, rich),
    true,
    "every field projectsFile writes is a field adoptable reads back",
  );
  const written = Object.keys(projectsFile({ projects: [], trash: [] }, rich))
    .filter((k) => k !== "projects" && k !== "trash")
    .sort();
  assert.deepEqual(
    written,
    Object.keys(rich).sort(),
    "projectsFile writes exactly the manifest's fields and no others",
  );
}

console.log("admin payload: all cases pass");

// A rewritten title that was cleared is dropped rather than published.
{
  const file = projectsFile(null, {
    ...edit,
    copy: { a: { title: "  ", intent: "x" }, b: { title: "B", intent: null } },
  });
  assert.deepEqual(file.copy, { b: { title: "B", intent: null } });
  assert.equal(projectsFile(null, edit).copy, undefined, "no copy, no key");
}
