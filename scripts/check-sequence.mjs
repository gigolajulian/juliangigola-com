/**
 * The one check behind the sequence split.
 *
 * `/admin` stores photographs and writing in a single ordered list; the site
 * needs them apart, with each passage carrying the number of frames ahead of
 * it. That translation is the only piece of this feature with arithmetic in
 * it, and it is arithmetic that fails quietly — a block landing one frame late
 * looks like an editorial decision, not a bug. So it gets a test.
 *
 * Mirrors the loop in `reframe` (`lib/work.ts`) rather than importing it:
 * `work.ts` pulls in the generated manifest and the content JSON, which is a
 * lot of module graph to stand up for eleven lines of counting. If the shape
 * of that loop changes, this file has to change with it — the assertions below
 * are the specification either way.
 *
 *   node scripts/check-sequence.mjs
 */

import assert from "node:assert/strict";

const isTextRef = (f) =>
  typeof f !== "string" && "kind" in f && f.kind === "text";

/** The body of `reframe`, kept in step by hand. */
function split(stored, archive) {
  const found = new Map(archive.map((f) => [f.src, f]));
  const images = [];
  const blocks = [];

  for (const ref of stored) {
    if (isTextRef(ref)) {
      blocks.push({
        heading: ref.heading,
        body: ref.body,
        after: images.length,
      });
      continue;
    }
    const frame =
      typeof ref === "string" ? (found.get(ref) ?? null) : (found.get(ref.src) ?? ref);
    if (frame) images.push(frame);
  }

  return { images, blocks };
}

const frame = (src) => ({ src, width: 800, height: 1000, color: "#000000", alt: "" });
const archive = ["a", "b", "c"].map((n) => frame(`/work/x/${n}.jpg`));
const text = (body) => ({ kind: "text", heading: null, body });

// A passage at the front opens the sequence and counts nothing before it.
{
  const { images, blocks } = split(
    [text("opening"), "/work/x/a.jpg", "/work/x/b.jpg"],
    archive,
  );
  assert.equal(images.length, 2, "photographs survive alongside a passage");
  assert.deepEqual(
    blocks.map((b) => b.after),
    [0],
    "a leading passage sits at 0",
  );
}

// In the middle, it counts the frames actually laid before it.
{
  const { blocks } = split(
    ["/work/x/a.jpg", "/work/x/b.jpg", text("middle"), "/work/x/c.jpg"],
    archive,
  );
  assert.deepEqual(
    blocks.map((b) => b.after),
    [2],
    "two frames precede it",
  );
}

// Writing is never mistaken for a photograph.
{
  const { images } = split([text("a"), text("b"), "/work/x/a.jpg"], archive);
  assert.deepEqual(
    images.map((f) => f.src),
    ["/work/x/a.jpg"],
    "passages stay out of the gallery",
  );
}

// Consecutive passages share a position and keep their written order.
{
  const { blocks } = split(
    ["/work/x/a.jpg", text("first"), text("second")],
    archive,
  );
  assert.deepEqual(
    blocks.map((b) => [b.after, b.body]),
    [
      [1, "first"],
      [1, "second"],
    ],
    "both sit after frame 1, in order",
  );
}

/* The case that made the count relative to surviving frames rather than to
   position in the stored list. A re-harvest renumbers a gallery and a stored
   path stops resolving; the writing after it has to move up with the gap
   rather than stay pinned to an index that no longer has that many frames
   ahead of it — otherwise the passage lands past the end and never renders. */
{
  const { images, blocks } = split(
    ["/work/x/a.jpg", "/work/x/GONE.jpg", text("after the hole")],
    archive,
  );
  assert.equal(images.length, 1, "the missing frame is dropped, not faked");
  assert.equal(
    blocks[0].after,
    1,
    "the passage follows the frame that survived, not the one that went",
  );
  assert.ok(
    blocks[0].after <= images.length,
    "a passage never sits past the end of the gallery",
  );
}

// A photograph added through the editor carries its own numbers.
{
  const added = frame("/work/x/new.jpg");
  const { images } = split(["/work/x/a.jpg", added], archive);
  assert.deepEqual(
    images.map((f) => f.src),
    ["/work/x/a.jpg", "/work/x/new.jpg"],
    "a whole frame is kept even though the archive has never seen it",
  );
}

/* ── instagram handles ───────────────────────────────────────────
 * The other piece of this feature that takes typed input and turns it into
 * something structural — here, an `href`. Mirrors `instagramHandle` in
 * `lib/added.ts` the same way the split above mirrors `reframe`.
 * ─────────────────────────────────────────────────────────────── */
const instagramHandle = (raw) => {
  const bare = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@+/, "")
    .toLowerCase();
  // The first character must be a letter, digit or underscore. Instagram
  // allows none of its handles to open with a dot, and neither does this —
  // which is also what stops a bare `..` getting through and pointing the
  // link at Instagram's own root.
  return /^[a-z0-9_][a-z0-9._]{0,29}$/.test(bare) ? bare : null;
};

{
  // The three things people paste meaning the same account.
  for (const typed of [
    "rice666s",
    "@rice666s",
    "  @rice666s  ",
    "https://www.instagram.com/rice666s",
    "https://instagram.com/rice666s/",
    "https://www.instagram.com/rice666s/?hl=en",
    "RICE666S",
  ]) {
    assert.equal(
      instagramHandle(typed),
      "rice666s",
      `"${typed}" is the same account as the bare handle`,
    );
  }

  // Instagram's own alphabet, and nothing else.
  assert.equal(instagramHandle("a.b_c9"), "a.b_c9", "dots and underscores");

  // Anything that would put something other than a handle in the href.
  for (const bad of [
    "",
    "   ",
    "@",
    "javascript:alert(1)",
    "../../etc",
    "two words",
    "hand<le>",
    "a".repeat(31),
  ]) {
    assert.equal(
      instagramHandle(bad),
      null,
      `"${bad}" never reaches an href`,
    );
  }
}

console.log("sequence split: 6 cases pass");
console.log("instagram handles: 16 cases pass");
