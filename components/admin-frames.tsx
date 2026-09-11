"use client";

import * as React from "react";
import Image from "next/image";
import type { FrameRef } from "@/lib/added";
import { MAX_WIDTH, processImage } from "@/lib/admin-image";
import { cn } from "@/lib/utils";

/* ── a project's photographs ──────────────────────────────────────
 * Sequence, trim, extend.
 *
 * The order is the edit. Julian already sequences his galleries, and the
 * first frame is load-bearing twice over — it opens the project page and it
 * is what the card on every index shows — so moving a frame to the front is
 * the same gesture as choosing a cover, and `lib/work.ts` treats it as one.
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

const srcOf = (f: FrameRef): string => (typeof f === "string" ? f : f.src);

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

  const list: FrameRef[] = frames ?? original;

  /** Null when the draft is back to the original, so Publish stops seeing a change. */
  const commit = (next: FrameRef[]) => {
    const same =
      next.length === original.length &&
      next.every((f, i) => srcOf(f) === original[i]);
    onChange(same ? null : next);
  };

  const move = (i: number, to: number) => {
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[i], next[to]] = [next[to], next[i]];
    commit(next);
  };

  const drop = (i: number) => commit(list.filter((_, n) => n !== i));

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

  const staged = list.filter((f) => uploads[`public${srcOf(f)}`]).length;

  return (
    <div className="border-t border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="label text-muted-foreground">
          {list.length} {list.length === 1 ? "frame" : "frames"}
          {staged > 0 ? ` · ${staged} not yet uploaded` : ""}
          {frames ? " · edited" : ""}
        </p>
        <div className="flex items-center gap-2">
          {frames ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="label border border-border px-3 py-2 press hoverable:hover:bg-card"
            >
              Undo changes
            </button>
          ) : null}
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
          const src = srcOf(f);
          const pending = uploads[`public${src}`];
          return (
            <li key={src}>
              <span
                className="relative block aspect-[4/5] overflow-hidden bg-card"
                // The frame's own mat where it is known — the same way the
                // site sits a photograph in a box it does not fill.
                style={
                  typeof f === "string"
                    ? undefined
                    : { backgroundColor: f.color }
                }
              >
                {pending ? (
                  // Not in the repo yet, so `next/image` has nothing to fetch
                  // and the object URL is the only copy there is.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pending.preview}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="160px"
                    // A gallery runs to thirty 2500px frames, and until the
                    // zone is transforming them that is what arrives. Lazy
                    // means only the ones actually scrolled to.
                    loading="lazy"
                    className="object-cover"
                  />
                )}
                <span className="label absolute left-0 top-0 bg-background/80 px-2 py-1 tabular-nums">
                  {i === 0 ? "CVR" : String(i + 1).padStart(2, "0")}
                </span>
              </span>

              {/* Always present rather than revealed on hover: this grid is
                  the whole point of the panel, and a control you have to go
                  looking for on a touch screen is one that does not exist. */}
              <span className="mt-1 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move frame ${i + 1} earlier`}
                  className="label flex-1 border border-border py-1 press hoverable:hover:bg-card disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === list.length - 1}
                  aria-label={`Move frame ${i + 1} later`}
                  className="label flex-1 border border-border py-1 press hoverable:hover:bg-card disabled:opacity-30"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => drop(i)}
                  // A gallery with no frames is a title over nothing, and
                  // `lib/added.ts` refuses to build one — better to say so
                  // here than to fail the deploy an hour later.
                  disabled={list.length === 1}
                  aria-label={`Remove frame ${i + 1}`}
                  className="label flex-1 border border-border py-1 text-muted-foreground press hoverable:hover:text-destructive disabled:opacity-30"
                >
                  ×
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="label mt-5 text-muted-foreground">
        The first frame opens the project and is the card shown on every index.
        Removing takes a photograph out of the sequence and keeps the file.
        Nothing here is live until you press Publish.
      </p>
    </div>
  );
}
