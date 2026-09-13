"use client";

import * as React from "react";
import { isTextRef, type FrameRef, type TextRef } from "@/lib/added";
import { MAX_WIDTH, processImage } from "@/lib/admin-image";

/* ── a project's sequence, as state ───────────────────────────────
 * Everything that changes the order of a project's frames and passages,
 * in one place: reorder, remove, add text, add photographs, and the
 * drag-and-drop that drives the first of those. Two views draw the same
 * sequence — the thumbnail grid in `admin-frames.tsx` and the page-shaped
 * editor in `admin-page.tsx` — and a sequence that can be resequenced in
 * two places had better be resequenced by one piece of code.
 *
 * `frames` is the draft — `null` while it matches `original`, the
 * published order — and every change goes out through `onChange` in the
 * same shape, so the editor above cannot tell which view made it.
 * ─────────────────────────────────────────────────────────────── */

export type PendingUpload = {
  path: string;
  base64: string;
  preview: string;
  bytes: number;
};

/** The path a ref points at; empty for a passage. */
export const srcOf = (f: FrameRef): string =>
  typeof f === "string" ? f : isTextRef(f) ? "" : f.src;

const uploadPath = (slug: string, i: number) =>
  `public/work/${slug}/a${Date.now().toString(36)}-${i + 1}.jpg`;

export function useSequence({
  slug,
  original,
  frames,
  onChange,
  onUpload,
}: {
  slug: string;
  original: string[];
  frames: FrameRef[] | null;
  onChange: (next: FrameRef[] | null) => void;
  onUpload: (added: PendingUpload[]) => void;
}) {
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  const [editing, setEditing] = React.useState<number | null>(null);
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [over, setOver] = React.useState<number | null>(null);

  const list: FrameRef[] = frames ?? original;

  // Back to `null` the moment the draft matches what is published, so
  // "edited" means edited and Undo has something to undo.
  const commit = (next: FrameRef[]) => {
    const same =
      next.length === original.length &&
      next.every((f, i) => !isTextRef(f) && srcOf(f) === original[i]);
    onChange(same ? null : next);
  };

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [held] = next.splice(from, 1);
    next.splice(to, 0, held);
    commit(next);
    // The passage being written follows its own tile.
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

  const addText = (at: number = list.length) => {
    const next = [...list];
    next.splice(at, 0, { kind: "text", heading: null, body: "" } as TextRef);
    commit(next);
    setEditing(at);
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
    commit([...list, ...made.map((u) => u.path.replace(/^public/, ""))]);
  }

  const reset = () => {
    onChange(null);
    setEditing(null);
  };

  /* Native drag-and-drop, no library: the whole interaction is four events
     and a splice. It does not fire on touch, which is why every view keeps
     its arrows — they are also the keyboard path. */
  const dragProps = (i: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragging(i);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== i) setOver(i);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const carried = e.dataTransfer.getData("text/plain");
      const from = carried === "" ? dragging : Number(carried);
      if (from !== null && Number.isInteger(from)) reorder(from, i);
      setDragging(null);
      setOver(null);
    },
    onDragEnd: () => {
      setDragging(null);
      setOver(null);
    },
  });

  return {
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
  };
}
