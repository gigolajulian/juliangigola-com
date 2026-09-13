"use client";

import * as React from "react";
import Image from "next/image";
import { isTextRef, type FrameRef, type TextRef } from "@/lib/added";
import { useSequence, srcOf, type PendingUpload } from "@/lib/admin-sequence";
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
export type { PendingUpload };

/** The path of a photograph. Empty for a passage, which has no file. */
/* Re-exported so this panel's callers keep importing it from here. The
   implementation moved to `lib/admin-payload.ts`, beside the publish payload
   it is part of and where a test can reach it. */
export { tidySequence } from "@/lib/admin-payload";

/**
 * A name the harvester cannot collide with.
 *
 * `harvest.mjs` writes `01.jpg`, `02.jpg`… by position and skips a file that
 * is already on disk — so a photograph added here under a numbered name would
 * either be silently adopted as one of Format's or be overwritten by it. The
 * prefix keeps the two sets of files apart for good.
 */
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
  const seq = useSequence({ slug, original, frames, onChange, onUpload });
  const {
    list,
    busy,
    error,
    editing,
    setEditing,
    dragging,
    over,
    reorder,
    drop,
    addText,
    setText,
    add,
    reset,
    dragProps,
  } = seq;

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
              onClick={reset}
              className="label border border-border px-3 py-2 press hoverable:hover:bg-card"
            >
              Undo changes
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => addText()}
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
              {...dragProps(i)}
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
        Drag a tile to move it, or use the arrows — the arrows are the way on a
        touch screen and with a keyboard. The first photograph opens the project
        and is the card shown on every index. Text sits on the page exactly
        where it sits in this list. Removing a photograph takes it out of the
        sequence and keeps the file. Nothing here is live until you press
        Publish.
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
