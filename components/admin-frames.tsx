"use client";

import * as React from "react";
import Image from "next/image";
import { isTextRef, type FrameRef, type TextRef } from "@/lib/added";
import { MAX_WIDTH, processImage } from "@/lib/admin-image";
import { cn } from "@/lib/utils";

/* ── a project's sequence ─────────────────────────────────────────
 * Photographs and writing, in one list. Sequence, trim, extend.
 *
 * The order is the edit. Julian already sequences his galleries, and the
 * first frame is load-bearing twice over — it opens the project page and it
 * is what the card on every index shows — so moving a frame to the front is
 * the same gesture as choosing a cover, and `lib/work.ts` treats it as one.
 *
 * Writing lives in the same list rather than in a panel of its own, and that
 * is the whole reason a passage needs no position field: where it sits in
 * here is where it sits on the page. A separate list would mean typing "goes
 * after frame 7" and then retyping it every time a frame moved.
 *
 * Removing a frame takes it out of the sequence and leaves the file in the
 * repository. That is deliberate: the archive under `public/work/` is what
 * `scripts/harvest.mjs` produced from the old site, and deleting from it
 * would be undone by the next harvest with nothing to show it ever happened.
 * The gallery is the list, not the directory.
 *
 * Nothing here commits on its own. Added photographs are held in memory —
 * resized and encoded, but unwritten — until Publish, so a gallery that is
 * half-rearranged and then abandoned leaves no orphan files behind.
 * ─────────────────────────────────────────────────────────────── */

/** A photograph processed in the browser and waiting for Publish. */
export type PendingUpload = {
  /** Repo-relative, e.g. `public/work/luxe/a1757000000-1.jpg`. */
  path: string;
  base64: string;
  /** An object URL, so the tile can show it before it exists anywhere. */
  preview: string;
  bytes: number;
};

/** The path of a photograph. Empty for a passage, which has no file. */
const srcOf = (f: FrameRef): string =>
  typeof f === "string" ? f : isTextRef(f) ? "" : f.src;

/**
 * Drops passages nobody wrote anything in.
 *
 * `lib/added.ts` refuses an empty body, and rightly — it would publish as a
 * gap in the sequence that nobody put there. But pressing "Add text" and
 * then changing your mind is an ordinary thing to do, and a draft that fails
 * the deploy because of it would be the editor's fault, not Julian's. So the
 * empties are dropped on the way out instead of being validated against on
 * the way in.
 */
export const tidySequence = (list: FrameRef[]): FrameRef[] =>
  list.filter((f) => !isTextRef(f) || f.body.trim() !== "");

/**
 * A name the harvester cannot collide with.
 *
 * `harvest.mjs` writes `01.jpg`, `02.jpg`… by position and skips a file that
 * is already on disk — so a photograph added here under a numbered name would
 * either be silently adopted as one of Format's or be overwritten by it. The
 * prefix keeps the two sets of files apart for good.
 */
const uploadPath = (slug: string, i: number) =>
  `public/work/${slug}/a${Date.now().toString(36)}-${i + 1}.jpg`;

export function AdminFrames({
  slug,
  original,
  frames,
  uploads,
  onChange,
  onUpload,
}: {
  slug: string;
  /** The gallery as the live build has it, in order. */
  original: string[];
  /** The draft sequence, or null while it is still the original. */
  frames: FrameRef[] | null;
  /** Photographs staged for this publish, by repo path. */
  uploads: Record<string, PendingUpload>;
  onChange: (next: FrameRef[] | null) => void;
  onUpload: (added: PendingUpload[]) => void;
}) {
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  /** Which passage is open for editing, by position. One at a time. */
  const [editing, setEditing] = React.useState<number | null>(null);
  /** The tile being dragged, and the one it is currently over. */
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [over, setOver] = React.useState<number | null>(null);

  const list: FrameRef[] = frames ?? original;

  /** Null when the draft is back to the original, so Publish stops seeing a change. */
  const commit = (next: FrameRef[]) => {
    const same =
      next.length === original.length &&
      // A passage never matches a path, so a sequence carrying one can never
      // compare equal — which is correct: it is a change.
      next.every((f, i) => !isTextRef(f) && srcOf(f) === original[i]);
    onChange(same ? null : next);
  };

  /**
   * Takes an item out and puts it back somewhere else.
   *
   * Lift-and-insert, not a swap. For the arrows the two are the same thing —
   * moving one step and trading with your neighbour are the same edit — but
   * for a drag they are not: dropping frame twelve on the cover slot should
   * put it first and push the rest down, whereas a swap would fling the old
   * cover out to position twelve, which is a second edit nobody asked for.
   */
  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [held] = next.splice(from, 1);
    next.splice(to, 0, held);
    commit(next);
    // The open editor follows the passage it belongs to rather than staying
    // on a position that now holds something else. Every item between the two
    // ends shifts by one, and which way depends on the direction of travel.
    setEditing((at) =>
      at === null
        ? null
        : at === from
          ? to
          : from < at && at <= to
            ? at - 1
            : to <= at && at < from
              ? at + 1
              : at,
    );
  };

  const drop = (i: number) => {
    commit(list.filter((_, n) => n !== i));
    if (editing === i) setEditing(null);
    else if (editing !== null && editing > i) setEditing(editing - 1);
  };

  const addText = () => {
    commit([...list, { kind: "text", heading: null, body: "" } as TextRef]);
    // Opened straight away — a passage is added in order to write it, and an
    // empty tile you then have to find and click is a step for nothing.
    setEditing(list.length);
  };

  const setText = (i: number, patch: Partial<TextRef>) =>
    commit(
      list.map((f, n) => (n === i && isTextRef(f) ? { ...f, ...patch } : f)),
    );

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const chosen = [...files];
    const made: PendingUpload[] = [];

    for (const [i, file] of chosen.entries()) {
      setBusy(`Reading ${i + 1} of ${chosen.length}…`);
      try {
        const image = await processImage(file, MAX_WIDTH);
        made.push({
          path: uploadPath(slug, i),
          base64: image.base64,
          preview: URL.createObjectURL(file),
          bytes: image.bytes,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }

    setBusy("");
    if (!made.length) return;
    onUpload(made);
    // `public/work/x.jpg` in the repo is `/work/x.jpg` on the site.
    commit([...list, ...made.map((u) => u.path.replace(/^public/, ""))]);
  }

  const photos = list.filter((f) => !isTextRef(f));
  const passages = list.length - photos.length;
  const staged = list.filter((f) => uploads[`public${srcOf(f)}`]).length;

  /* Numbered by photograph, so the badges match the frame numbers the rest of
     the site counts in — a passage sitting third in the list does not make
     the photograph after it the fourth frame. Built up front rather than
     counted inside the map: React may run that callback more than once, and a
     tally that survives between runs would number the grid differently on a
     re-render. Zero where the item is a passage. */
  const ordinal = ((): number[] => {
    let n = 0;
    return list.map((f) => (isTextRef(f) ? 0 : ++n));
  })();

  return (
    <div className="border-t border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="label text-muted-foreground">
          {photos.length} {photos.length === 1 ? "frame" : "frames"}
          {passages > 0
            ? ` · ${passages} ${passages === 1 ? "passage" : "passages"}`
            : ""}
          {staged > 0 ? ` · ${staged} not yet uploaded` : ""}
          {frames ? " · edited" : ""}
        </p>
        <div className="flex items-center gap-2">
          {frames ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setEditing(null);
              }}
              className="label border border-border px-3 py-2 press hoverable:hover:bg-card"
            >
              Undo changes
            </button>
          ) : null}
          <button
            type="button"
            onClick={addText}
            className="label border border-border px-3 py-2 press hoverable:hover:bg-card"
          >
            Add text
          </button>
          <label className="label cursor-pointer border border-border px-3 py-2 press hoverable:hover:bg-card">
            Add photographs
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(e) => {
                void add(e.target.files);
                e.target.value = "";
              }}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {busy || error ? (
        <p className={cn("label mt-3", error && "text-destructive")}>
          {error || busy}
        </p>
      ) : null}

      <ol className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
        {list.map((f, i) => {
          const text = isTextRef(f) ? f : null;
          const src = srcOf(f);
          // The frame's own mat where it is known — the same way the site
          // sits a photograph in a box it does not fill. Narrowed with the
          // guard rather than via `text`, which the checker will not follow.
          const mat =
            typeof f === "string" || isTextRef(f) ? undefined : f.color;
          const pending = uploads[`public${src}`];
          // The last photograph cannot go: `lib/added.ts` refuses to build a
          // gallery of pure text, and saying so here beats failing the deploy
          // an hour later. A passage is always removable.
          const locked = !text && photos.length === 1;

          return (
            /* Dragged by the tile itself rather than by a handle. The tile is
               the photograph, and a grid of photographs you rearrange is the
               one interface everybody already knows — a handle would be a
               small target next to a large obvious one.

               Native drag-and-drop, no library: the whole interaction is four
               events and a splice, and this panel already ships a megabyte of
               image processing without adding a drag engine to it.

               It does not fire on touch, which is exactly why the arrows
               below stay. They are also the keyboard path — a drag has no
               keyboard equivalent, so removing them would make resequencing
               a gallery impossible without a mouse. */
            <li
              key={text ? `text-${i}` : src}
              draggable
              onDragStart={(e) => {
                setDragging(i);
                e.dataTransfer.effectAllowed = "move";
                // Where the item came from, and the only authority on it.
                // Firefox also starts no drag at all unless something is set.
                e.dataTransfer.setData("text/plain", String(i));
              }}
              onDragOver={(e) => {
                // Without this the browser refuses the drop outright.
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== i) setOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                // Read back out of the drag, not out of React state. The
                // `dragging` state is for the dimming and nothing else — it
                // is set during `dragstart` and a drop that arrives before
                // that render has committed would find it still null and do
                // nothing. Frames apart in a real drag, instant in a test,
                // and the platform is already carrying the answer.
                const from = Number(e.dataTransfer.getData("text/plain"));
                if (Number.isInteger(from)) reorder(from, i);
                setDragging(null);
                setOver(null);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              className={cn(
                "cursor-grab transition-opacity duration-150 active:cursor-grabbing",
                dragging === i && "opacity-30",
                // The slot it would land in, outlined rather than nudged
                // aside: seventy tiles reflowing on every pointer move is
                // motion sickness, and the outline says the same thing.
                over === i &&
                  dragging !== null &&
                  dragging !== i &&
                  "outline outline-2 outline-offset-2 outline-foreground",
              )}
            >
              {text ? (
                <button
                  type="button"
                  onClick={() => setEditing(editing === i ? null : i)}
                  aria-expanded={editing === i}
                  className={cn(
                    "relative flex aspect-[4/5] w-full flex-col justify-between overflow-hidden border p-2 text-left press",
                    editing === i
                      ? "border-foreground bg-card"
                      : "border-dashed border-border hoverable:hover:bg-card",
                  )}
                >
                  <span className="label shrink-0 text-muted-foreground">
                    TEXT
                  </span>
                  <span className="min-h-0 flex-1 overflow-hidden py-1">
                    {text.heading ? (
                      <span className="label block truncate text-foreground">
                        {text.heading}
                      </span>
                    ) : null}
                    <span className="mt-1 line-clamp-4 block text-[0.7rem] leading-snug text-muted-foreground">
                      {text.body || "Empty — click to write"}
                    </span>
                  </span>
                </button>
              ) : (
                <span
                  className="relative block aspect-[4/5] overflow-hidden bg-card"
                  style={mat ? { backgroundColor: mat } : undefined}
                >
                  {pending ? (
                    // Not in the repo yet, so `next/image` has nothing to fetch
                    // and the object URL is the only copy there is.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pending.preview}
                      alt=""
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <Image
                      src={src}
                      alt=""
                      fill
                      draggable={false}
                      sizes="160px"
                      // A gallery runs to thirty 2500px frames, and until the
                      // zone is transforming them that is what arrives. Lazy
                      // means only the ones actually scrolled to.
                      loading="lazy"
                      className="object-cover"
                    />
                  )}
                  <span className="label absolute left-0 top-0 bg-background/80 px-2 py-1 tabular-nums">
                    {ordinal[i] === 1
                      ? "CVR"
                      : String(ordinal[i]).padStart(2, "0")}
                  </span>
                </span>
              )}

              {/* Always present rather than revealed on hover: this grid is
                  the whole point of the panel, and a control you have to go
                  looking for on a touch screen is one that does not exist. */}
              <span className="mt-1 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => reorder(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move item ${i + 1} earlier`}
                  className="label flex-1 border border-border py-1 press hoverable:hover:bg-card disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => reorder(i, i + 1)}
                  disabled={i === list.length - 1}
                  aria-label={`Move item ${i + 1} later`}
                  className="label flex-1 border border-border py-1 press hoverable:hover:bg-card disabled:opacity-30"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => drop(i)}
                  disabled={locked}
                  aria-label={`Remove item ${i + 1}`}
                  className="label flex-1 border border-border py-1 text-muted-foreground press hoverable:hover:text-destructive disabled:opacity-30"
                >
                  ×
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      {/* Below the grid rather than inside the tile: a passage is prose, and a
          textarea the width of a thumbnail is not somewhere anyone can write. */}
      {editing !== null && isTextRef(list[editing]) ? (
        <PassageForm
          block={list[editing] as TextRef}
          position={editing}
          before={list.slice(0, editing).filter((f) => !isTextRef(f)).length}
          onChange={(patch) => setText(editing, patch)}
          onClose={() => setEditing(null)}
          onRemove={() => drop(editing)}
        />
      ) : null}

      <p className="label mt-5 text-muted-foreground">
        Drag a tile to move it, or use the arrows — the arrows are the way on
        a touch screen and with a keyboard. The first photograph opens the
        project and is the card shown on every index. Text sits on the page
        exactly where it sits in this list. Removing a photograph takes it out
        of the sequence and keeps the file. Nothing here is live until you
        press Publish.
      </p>
    </div>
  );
}

function PassageForm({
  block,
  position,
  before,
  onChange,
  onClose,
  onRemove,
}: {
  block: TextRef;
  /** Where it sits in the list, for the heading. */
  position: number;
  /** How many photographs precede it — what the reader will actually see. */
  before: number;
  onChange: (patch: Partial<TextRef>) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const field =
    "w-full border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-foreground";

  return (
    <div className="mt-5 border border-foreground p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="label">
          Passage · item {position + 1}
          {before === 0
            ? " · opens the project"
            : ` · after ${before} ${before === 1 ? "frame" : "frames"}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRemove}
            className="label border border-border px-3 py-1.5 text-muted-foreground press hoverable:hover:text-destructive"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={onClose}
            className="label border border-border px-3 py-1.5 press hoverable:hover:bg-card"
          >
            Done
          </button>
        </div>
      </div>

      <input
        value={block.heading ?? ""}
        onChange={(e) => onChange({ heading: e.target.value || null })}
        placeholder="Heading (optional)"
        aria-label="Passage heading"
        className={cn(field, "mt-4")}
      />
      <textarea
        value={block.body}
        onChange={(e) => onChange({ body: e.target.value })}
        rows={6}
        placeholder="The writing. Leave a blank line between paragraphs."
        aria-label="Passage text"
        className={cn(field, "mt-2 resize-y leading-relaxed")}
      />
      <p className="label mt-2 text-muted-foreground">
        A blank line starts a new paragraph. A passage left empty is dropped on
        publish rather than printed as a gap.
      </p>
    </div>
  );
}
