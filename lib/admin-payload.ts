/* ── what /admin actually commits ─────────────────────────────────
 * The `content/projects.json` the editor writes back, built from the draft.
 *
 * Pulled out of `publish()` so it can be tested. Publishing itself cannot be
 * — it needs Julian's GitHub token, which is his and stays his — but the
 * transport was never the risky part: those commits land today and the repo
 * history shows them. The risk is this, the shape of what goes in them. A
 * field silently dropped here publishes as "you never made that edit", and
 * the only place it shows up is the live site.
 *
 * Deliberately dependency-free — no React, no `@/` aliases, no JSON imports —
 * so `scripts/check-payload.mjs` can run this exact function under Node's
 * type stripping rather than mirroring it by hand. Every other check script
 * in here mirrors the code it covers, which is fine for eleven lines of
 * counting and not fine for the one function that decides what gets written
 * to the repository.
 * ─────────────────────────────────────────────────────────────── */

/** Structurally what `lib/added.ts` accepts, kept loose on purpose. */
export type ProjectsFile = {
  projects: unknown[];
  trash?: unknown[];
  hidden?: string[];
  categories?: Record<string, string>;
  frames?: Record<string, unknown[]>;
  credits?: Record<string, unknown[]>;
  order?: string[];
  covers?: Record<string, string>;
};

/**
 * A passage, structurally.
 *
 * Inlined rather than imported from `lib/added.ts`, whose `isTextRef` this
 * duplicates: that module reads `content/projects.json` at import, and a value
 * import from it would drag the JSON in and cost this module the one property
 * that makes it testable. One line is the cheaper of the two prices.
 */
const isText = (f: unknown): f is { body: string } =>
  typeof f === "object" && f !== null && "kind" in f && f.kind === "text";

/**
 * Drops passages nobody wrote anything in.
 *
 * `lib/added.ts` refuses an empty body, and rightly — it would publish as a
 * gap in the sequence nobody put there. But pressing "Add text" and changing
 * your mind is an ordinary thing to do, and a draft that fails the deploy over
 * it would be the editor's fault rather than Julian's. So the empties go on
 * the way out instead of being validated against on the way in.
 */
export const tidySequence = <T>(list: T[]): T[] =>
  list.filter((f) => !isText(f) || f.body.trim() !== "");

/**
 * The file to commit, given the file that is already there.
 *
 * `existing` is read fresh from the repo at publish time rather than trusted
 * from page load: a project may have been added or removed since, and writing
 * back a stale list would undo it. Everything this function owns is replaced
 * wholesale; everything else on `existing` — `projects`, `trash` — is carried
 * through untouched, which is what makes it safe to publish a content edit
 * without having loaded the project list at all.
 */
export function projectsFile(
  existing: ProjectsFile | null,
  edit: {
    hidden: Iterable<string>;
    categories: Record<string, string>;
    frames: Record<string, unknown[]>;
    credits: Record<string, unknown[]>;
    order: readonly string[];
    covers: Record<string, string>;
  },
): ProjectsFile {
  const next: ProjectsFile = existing
    ? { ...existing }
    : { projects: [], trash: [] };

  // Sorted, so the committed file does not churn on the order a Set happens
  // to iterate in — a diff should show what changed and nothing else.
  next.hidden = [...edit.hidden].sort();
  next.categories = edit.categories;

  // A sequence that is nothing but dropped passages leaves no entry at all,
  // rather than an empty array — which `lib/added.ts` rejects outright, and
  // which would mean "this gallery has no frames" instead of "no override".
  next.frames = Object.fromEntries(
    Object.entries(edit.frames)
      .map(([slug, list]) => [slug, tidySequence(list)] as const)
      .filter(([, list]) => list.length > 0),
  );

  next.credits = edit.credits;

  // The running order, and the picked discipline covers. Both are absent from
  // the file entirely when empty rather than written as `[]` and `{}`: the
  // meaning is identical and a file that only carries what has been decided
  // is easier to read six months from now.
  if (edit.order.length) next.order = [...edit.order];
  else delete next.order;

  if (Object.keys(edit.covers).length) next.covers = edit.covers;
  else delete next.covers;

  return next;
}
