"use client";

import * as React from "react";
import type { FrameRef } from "@/lib/added";
import type { Bts, Frame } from "@/lib/work-types";
import { MAX_WIDTH, processClip, processImage } from "@/lib/admin-image";
import { useSequence, srcOf, type PendingUpload } from "@/lib/admin-sequence";
import { cn } from "@/lib/utils";

/* ── a project's BTS ──────────────────────────────────────────────
 * The behind-the-scenes frames under a gallery: who shot them, then
 * add, reorder, remove. Same sequence machinery as the gallery, so the
 * drag, the arrows and the staging until Publish all behave the same.
 * A clip is an MP4, uploaded as shot. Clearing every frame removes the
 * project's BTS on publish (`projectsFile`).
 * ─────────────────────────────────────────────────────────────── */

const isClip = (src: string) => src.endsWith(".mp4");

export function AdminBts({
  slug,
  published,
  value,
  uploads,
  onChange,
  onUpload,
}: {
  slug: string;
  /** The BTS the repository holds, if any. */
  published: Bts | undefined;
  /** The draft, if it differs from nothing. */
  value: Bts | undefined;
  uploads: Record<string, PendingUpload>;
  onChange: (next: Bts) => void;
  onUpload: (added: PendingUpload[]) => void;
}) {
  const by = value?.by ?? null;
  const frames = (value?.frames ?? []) as FrameRef[];
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  const [help, setHelp] = React.useState(false);

  const { list, dragging, over, reorder, drop, dragProps } = useSequence({
    slug,
    original: (published?.frames ?? []).map((f) => f.src),
    frames,
    // `null` is the sequence back in its published order.
    onChange: (next) =>
      onChange({ by, frames: (next ?? published?.frames ?? []) as Frame[] }),
    onUpload,
  });

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const chosen = [...files];
    const made: PendingUpload[] = [];
    const added: Frame[] = [];
    const stamp = Date.now().toString(36);

    for (const [i, file] of chosen.entries()) {
      setBusy(`Reading ${i + 1} of ${chosen.length}…`);
      try {
        const clip = file.type === "video/mp4";
        const media = clip
          ? await processClip(file)
          : await processImage(file, MAX_WIDTH);
        const path = `public/work/${slug}/bts/b${stamp}-${i + 1}.${clip ? "mp4" : "jpg"}`;
        made.push({
          path,
          base64: media.base64,
          preview: URL.createObjectURL(file),
          bytes: media.bytes,
        });
        added.push({
          src: path.replace(/^public/, ""),
          width: media.width,
          height: media.height,
          color: media.color,
          alt: "",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }

    setBusy("");
    if (!made.length) return;
    onUpload(made);
    onChange({ by, frames: [...(list as Frame[]), ...added] });
  }

  const ctl = "label border border-border px-3 py-2 press hoverable:hover:bg-card";

  return (
    <div className="border-t border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <label className="label flex flex-wrap items-baseline gap-1 text-muted-foreground">
          <span className="text-foreground">BTS</span>
          <span>
            · {String(list.length).padStart(2, "0")}{" "}
            {list.length === 1 ? "frame" : "frames"} · by @
          </span>
          <input
            type="text"
            value={by ?? ""}
            onChange={(e) =>
              onChange({
                by: e.target.value.replace(/^@/, "").trim() || null,
                frames: list as Frame[],
              })
            }
            placeholder="handle"
            spellCheck={false}
            autoCapitalize="none"
            aria-label="BTS by, Instagram handle"
            style={{ width: `${Math.max(8, (by ?? "").length + 2)}ch` }}
            className="label border-b border-border bg-transparent px-0 py-0 text-foreground outline-none focus:border-foreground"
          />
        </label>
        <div className="flex items-center gap-2">
          <label className={cn(ctl, "cursor-pointer")}>
            Add BTS
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif,video/mp4"
              onChange={(e) => {
                void add(e.target.files);
                e.target.value = "";
              }}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            onClick={() => setHelp((h) => !h)}
            aria-expanded={help}
            aria-label="Help"
            className={ctl}
          >
            ?
          </button>
        </div>
      </div>

      {help ? (
        <p className="label mt-3 text-muted-foreground">
          Photographs or MP4 clips under 25 MB. They show in two rows on the
          project page and on /bts, in this order. Drag or use the arrows.
          The handle links to Instagram. Removing every frame takes the
          project off /bts on publish. Nothing is live until Publish.
        </p>
      ) : null}

      {busy || error ? (
        <p className={cn("label mt-3", error && "text-destructive")}>
          {error || busy}
        </p>
      ) : null}

      {list.length ? (
        <ol className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
          {list.map((f, i) => {
            const src = srcOf(f);
            const shown = uploads[`public${src}`]?.preview ?? src;
            const color = typeof f === "object" && "color" in f ? f.color : undefined;
            return (
              <li
                key={src}
                {...dragProps(i)}
                className={cn(
                  "cursor-grab active:cursor-grabbing",
                  dragging === i && "opacity-30",
                  over === i &&
                    dragging !== null &&
                    dragging !== i &&
                    "outline outline-2 outline-offset-2 outline-foreground",
                )}
              >
                <span
                  className="relative block aspect-[4/3] w-full overflow-hidden bg-card"
                  style={color ? { backgroundColor: color } : undefined}
                >
                  {isClip(src) ? (
                    <video
                      src={shown}
                      muted
                      playsInline
                      preload="metadata"
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shown}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <span className="label absolute left-0 top-0 bg-background/80 px-2 py-1 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                    {isClip(src) ? " · CLIP" : ""}
                  </span>
                </span>
                <span className="mt-1 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => reorder(i, i - 1)}
                    disabled={i === 0}
                    aria-label={`Move BTS ${i + 1} earlier`}
                    className="label flex-1 border border-border py-1 press hoverable:hover:bg-card disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => reorder(i, i + 1)}
                    disabled={i === list.length - 1}
                    aria-label={`Move BTS ${i + 1} later`}
                    className="label flex-1 border border-border py-1 press hoverable:hover:bg-card disabled:opacity-30"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() => drop(i)}
                    aria-label={`Remove BTS ${i + 1}`}
                    className="label flex-1 border border-border py-1 text-muted-foreground press hoverable:hover:text-destructive"
                  >
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
