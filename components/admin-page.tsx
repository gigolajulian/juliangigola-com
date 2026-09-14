"use client";

import * as React from "react";
import Image from "next/image";
import { isTextRef, type FrameRef, type TextRef } from "@/lib/added";
import { useSequence, srcOf, type PendingUpload } from "@/lib/admin-sequence";
import { pair } from "@/components/gallery";
import { AdminCredits } from "@/components/admin-credits";
import type { AdminProject } from "@/components/admin-projects";
import type { Copy, Credit } from "@/lib/work-types";
import { cn } from "@/lib/utils";

/* ── the page, editable ───────────────────────────────────────────
 * A project drawn the way /work/<slug> draws it — the title, the meta
 * row, the intent, the frames in the same paired rows, the passages
 * between them, the credits at the end — with the editing on the page
 * itself. Julian asked for it: the thumbnail grid tells you the order,
 * this tells you what the order looks like.
 *
 * Same markup and the same classes as `app/work/[slug]/page.tsx` and
 * `gallery.tsx`, minus what is not content: the scroll reveal, the
 * lightbox, the morph, the call to action. Every change goes through the
 * sequence hook the grid uses, so nothing here can publish anything the
 * grid could not — and Undo, Publish and the "edited" marks all agree.
 * ─────────────────────────────────────────────────────────────── */

type Dims = { width: number; height: number; color?: string };

export function AdminPage({
  project,
  disciplines,
  filedAs,
  onRecategorise,
  frames,
  uploads,
  onReframe,
  onUpload,
  credits,
  onCredits,
  copy,
  onCopy,
  onClose,
}: {
  project: AdminProject;
  disciplines: { slug: string; name: string; group: string }[];
  filedAs: string;
  onRecategorise: (categorySlug: string) => void;
  frames: FrameRef[] | null;
  uploads: Record<string, PendingUpload>;
  onReframe: (next: FrameRef[] | null) => void;
  onUpload: (added: PendingUpload[]) => void;
  credits: Credit[];
  onCredits: (next: Credit[] | null) => void;
  /** The rewritten title and intent, or null while they match what is published. */
  copy: Copy | null;
  onCopy: (next: Copy | null) => void;
  onClose: () => void;
}) {
  const seq = useSequence({
    slug: project.slug,
    original: project.images,
    frames,
    onChange: onReframe,
    onUpload,
  });
  const { list } = seq;

  /* The public page pairs portrait frames two-up by their dimensions. The
     published frames carry theirs; a photograph added in this session has
     none until it is measured, so its preview reports them on load and the
     row it sits in settles then. Until it does it is treated as a portrait,
     which most of the work is. */
  const [measured, setMeasured] = React.useState<Record<string, Dims>>({});
  const dims = React.useCallback(
    (f: FrameRef): Dims => {
      if (typeof f !== "string" && !isTextRef(f)) return f;
      const src = srcOf(f);
      return (
        project.frames.find((p) => p.src === src) ??
        measured[src] ?? { width: 4, height: 5 }
      );
    },
    [project.frames, measured],
  );

  /* Rows as the page lays them: a passage is a row of its own, and the
     frames between passages pair the way `gallery.tsx` pairs them. Each
     row item keeps its index in `list`, which is what every control acts
     on. */
  const rows = React.useMemo(() => {
    const out: { i: number; f: FrameRef }[][] = [];
    let run: { i: number; f: FrameRef; width: number; height: number }[] = [];
    const flush = () => {
      for (const row of pair(run)) out.push(row.map(({ i, f }) => ({ i, f })));
      run = [];
    };
    list.forEach((f, i) => {
      if (isTextRef(f)) {
        flush();
        out.push([{ i, f }]);
      } else {
        run.push({ i, f, ...dims(f) });
      }
    });
    flush();
    return out;
  }, [list, dims]);

  const photos = list.filter((f) => !isTextRef(f));
  const ordinal = (() => {
    let n = 0;
    return list.map((f) => (isTextRef(f) ? 0 : ++n));
  })();
  const client = credits.find((c) => /client/i.test(c.role));

  /* The words, as they will publish. Reported as an override only while
     they differ from the page as built, so putting a title back by hand
     clears the "edited" mark the same way it does for the frames. */
  const published: Copy = { title: project.title, intent: project.intent };
  const words = copy ?? published;
  const setWords = (patch: Partial<Copy>) => {
    const next = { ...words, ...patch };
    onCopy(
      next.title === published.title && next.intent === published.intent
        ? null
        : next,
    );
  };
  const edited = frames !== null || copy !== null;
  const staged = list.filter((f) => uploads[`public${srcOf(f)}`]).length;

  return (
    <article className="-mx-6 sm:-mx-10">
      {/* The bar: what the grid's header row said, plus the way back. Sticky
          so Add and Undo are never a long scroll away on a 40-frame page. */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-6 py-3 backdrop-blur sm:px-10">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="label border border-border px-3 py-2 press hoverable:hover:bg-card"
          >
            &larr; Projects
          </button>
          <p className="label text-muted-foreground">
            {photos.length} {photos.length === 1 ? "frame" : "frames"}
            {list.length - photos.length > 0
              ? ` · ${list.length - photos.length} ${list.length - photos.length === 1 ? "passage" : "passages"}`
              : ""}
            {staged > 0 ? ` · ${staged} not yet uploaded` : ""}
            {edited ? " · edited" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {edited ? (
            <button
              type="button"
              onClick={() => {
                seq.reset();
                onCopy(null);
              }}
              className="label border border-border px-3 py-2 press hoverable:hover:bg-card"
            >
              Undo changes
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => seq.addText()}
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
                void seq.add(e.target.files);
                e.target.value = "";
              }}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {seq.busy || seq.error ? (
        <p
          className={cn(
            "label px-6 pt-4 sm:px-10",
            seq.error && "text-destructive",
          )}
        >
          {seq.error || seq.busy}
        </p>
      ) : null}

      {/* ── the header, as the page has it ── */}
      <header className="mx-auto max-w-[100rem] px-6 pt-12 sm:px-10 sm:pt-16">
        <p className="label text-muted-foreground">/work/{project.slug}</p>
        {/* The title and the intent, typed on the page in the page's own
            type. A textarea rather than an input so a long title wraps the
            way the published one does. */}
        <textarea
          value={words.title}
          onChange={(e) =>
            setWords({ title: e.target.value.replace(/\n/g, " ") })
          }
          rows={1}
          aria-label="Title"
          placeholder="Title"
          className="title mt-4 block w-full max-w-[20ch] resize-none border-0 border-b border-transparent bg-transparent p-0 field-sizing-content text-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:border-border"
        />

        <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4 border-t border-border pt-6">
          {client ? (
            <div>
              <dt className="label text-muted-foreground">Client</dt>
              <dd className="mt-2 text-sm">{client.name}</dd>
            </div>
          ) : null}
          <div>
            <dt className="label text-muted-foreground">Category</dt>
            <dd className="mt-2 text-sm">
              {/* The one control in the meta row: the same refiling select
                  the list row has, dressed as the value it replaces. */}
              <select
                value={filedAs}
                onChange={(e) => onRecategorise(e.target.value)}
                aria-label="Category"
                className="-ml-1 cursor-pointer border-b border-border bg-transparent px-1 py-0.5 text-sm text-foreground outline-none focus-visible:border-foreground"
              >
                <option value="">Unfiled</option>
                {disciplines.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </select>
            </dd>
          </div>
          <div>
            <dt className="label text-muted-foreground">Frames</dt>
            <dd className="mt-2 text-sm tabular-nums">{photos.length}</dd>
          </div>
        </dl>

        <textarea
          value={words.intent ?? ""}
          onChange={(e) => setWords({ intent: e.target.value || null })}
          aria-label="Intent"
          placeholder="A paragraph under the meta row, if the project wants one."
          className="mt-10 block w-full max-w-prose resize-y border-0 border-b border-transparent bg-transparent p-0 field-sizing-content text-base leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:border-border"
        />
      </header>

      {/* ── the sequence, in the page's own rows ── */}
      <div className="mt-16 flex flex-col gap-4 sm:mt-24 sm:gap-6">
        {rows.map((row, r) => {
          const passage = row.length === 1 && isTextRef(row[0].f);
          if (passage) {
            const { i, f } = row[0];
            return (
              <Passage
                key={`text-${i}`}
                index={i}
                block={f as TextRef}
                last={i === list.length - 1}
                dragProps={seq.dragProps(i)}
                dragging={seq.dragging === i}
                over={
                  seq.over === i && seq.dragging !== null && seq.dragging !== i
                }
                onChange={(patch) => seq.setText(i, patch)}
                onMove={(d) => seq.reorder(i, i + d)}
                onRemove={() => seq.drop(i)}
              />
            );
          }
          return (
            <div
              key={`row-${r}-${row.map((x) => x.i).join("-")}`}
              className={cn(
                "mx-auto grid w-full max-w-[100rem] gap-4 px-6 sm:gap-6 sm:px-10",
                row.length === 2 ? "sm:grid-cols-2" : "grid-cols-1",
              )}
            >
              {row.map(({ i, f }) => {
                const src = srcOf(f);
                const d = dims(f);
                const pending = uploads[`public${src}`];
                return (
                  <FrameCell
                    key={src}
                    index={i}
                    ordinal={ordinal[i]}
                    src={src}
                    pending={pending?.preview}
                    dims={d}
                    last={i === list.length - 1}
                    locked={photos.length === 1}
                    dragProps={seq.dragProps(i)}
                    dragging={seq.dragging === i}
                    over={
                      seq.over === i &&
                      seq.dragging !== null &&
                      seq.dragging !== i
                    }
                    onMeasured={(w, h) =>
                      setMeasured((m) =>
                        m[src] ? m : { ...m, [src]: { width: w, height: h } },
                      )
                    }
                    onMove={(delta) => seq.reorder(i, i + delta)}
                    onRemove={() => seq.drop(i)}
                    onTextAfter={() => seq.addText(i + 1)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── credits, at the end, as the page has them ── */}
      <div className="mx-auto mt-24 max-w-[100rem] px-6 sm:px-10">
        <AdminCredits credits={credits} onChange={onCredits} title="Credits" />
      </div>

      <p className="label mx-auto mt-12 max-w-[100rem] px-6 pb-10 text-muted-foreground sm:px-10">
        This is the page as it will be published, with the controls on it. Drag
        a photograph to move it, or use its arrows — the arrows are the way on a
        touch screen and with a keyboard. The title and the paragraph under it
        are typed in place; the credits are edited at the foot. The first
        photograph opens the project and is the card shown on every index. A
        passage sits on the page exactly where it sits here. Removing a
        photograph takes it out of the sequence and keeps the file. Nothing is
        live until you press Publish.
      </p>
    </article>
  );
}

/* A photograph at the size and shape the page gives it, with the three
   controls that exist — earlier, later, out — on the picture. Always shown
   rather than revealed on hover: the page is the point of this view, and a
   control you have to go looking for on a touch screen is one that does
   not exist. */
function FrameCell({
  index,
  ordinal,
  src,
  pending,
  dims,
  last,
  locked,
  dragProps,
  dragging,
  over,
  onMeasured,
  onMove,
  onRemove,
  onTextAfter,
}: {
  index: number;
  ordinal: number;
  src: string;
  pending?: string;
  dims: Dims;
  last: boolean;
  locked: boolean;
  dragProps: ReturnType<ReturnType<typeof useSequence>["dragProps"]>;
  dragging: boolean;
  over: boolean;
  onMeasured: (w: number, h: number) => void;
  onMove: (delta: 1 | -1) => void;
  onRemove: () => void;
  onTextAfter: () => void;
}) {
  return (
    <figure
      {...dragProps}
      className={cn(
        "group relative w-full cursor-grab overflow-hidden transition-opacity duration-150 active:cursor-grabbing",
        dragging && "opacity-30",
        over && "outline outline-2 outline-offset-2 outline-foreground",
      )}
      style={{
        backgroundColor: dims.color,
        aspectRatio: `${dims.width} / ${dims.height}`,
      }}
    >
      {pending ? (
        // A blob URL from this session, which next/image cannot serve.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pending}
          alt=""
          draggable={false}
          onLoad={(e) =>
            onMeasured(
              e.currentTarget.naturalWidth,
              e.currentTarget.naturalHeight,
            )
          }
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <Image
          src={src}
          alt=""
          fill
          draggable={false}
          sizes="(min-width: 1280px) 60vw, 100vw"
          loading={index < 2 ? "eager" : "lazy"}
          className="object-cover"
        />
      )}

      <span className="label absolute left-3 top-3 bg-background/80 px-2 py-1 tabular-nums">
        {ordinal === 1 ? "CVR" : String(ordinal).padStart(2, "0")}
      </span>

      <span className="absolute bottom-3 right-3 flex items-center gap-1">
        <Ctl
          label={`Move frame ${ordinal} earlier`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          &larr;
        </Ctl>
        <Ctl
          label={`Move frame ${ordinal} later`}
          disabled={last}
          onClick={() => onMove(1)}
        >
          &rarr;
        </Ctl>
        <Ctl label={`Add text after frame ${ordinal}`} onClick={onTextAfter}>
          T
        </Ctl>
        <Ctl
          label={`Remove frame ${ordinal}`}
          disabled={locked}
          onClick={onRemove}
          className="hoverable:hover:text-destructive"
        >
          &times;
        </Ctl>
      </span>
    </figure>
  );
}

/* A passage, written where it will be read: the heading in the display
   face, the body at the reading size, both live. The controls sit above it
   because there is no picture to sit on. */
function Passage({
  index,
  block,
  last,
  dragProps,
  dragging,
  over,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  block: TextRef;
  last: boolean;
  dragProps: ReturnType<ReturnType<typeof useSequence>["dragProps"]>;
  dragging: boolean;
  over: boolean;
  onChange: (patch: Partial<TextRef>) => void;
  onMove: (delta: 1 | -1) => void;
  onRemove: () => void;
}) {
  const lines = block.body.split("\n").length;
  return (
    <div
      {...dragProps}
      className={cn(
        "mx-auto w-full max-w-[100rem] px-6 py-8 transition-opacity duration-150 sm:px-10 sm:py-16",
        dragging && "opacity-30",
        over && "outline outline-2 outline-offset-2 outline-foreground",
      )}
    >
      <div className="mx-auto max-w-prose">
        <div className="mb-4 flex items-center gap-1">
          <span className="label mr-3 text-muted-foreground">Passage</span>
          <Ctl
            label="Move passage earlier"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            &larr;
          </Ctl>
          <Ctl
            label="Move passage later"
            disabled={last}
            onClick={() => onMove(1)}
          >
            &rarr;
          </Ctl>
          <Ctl
            label="Remove passage"
            onClick={onRemove}
            className="hoverable:hover:text-destructive"
          >
            &times;
          </Ctl>
        </div>
        <input
          value={block.heading ?? ""}
          onChange={(e) => onChange({ heading: e.target.value || null })}
          placeholder="Heading (optional)"
          aria-label="Passage heading"
          className="font-display w-full border-0 border-b border-transparent bg-transparent p-0 text-2xl uppercase tracking-[0] text-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:border-border"
        />
        <textarea
          value={block.body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={Math.max(3, lines + 1)}
          placeholder="The writing. Leave a blank line between paragraphs."
          aria-label="Passage text"
          className="mt-6 w-full resize-y border-0 border-b border-transparent bg-transparent p-0 text-base leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:border-border"
        />
      </div>
    </div>
  );
}

function Ctl({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "label flex h-9 w-9 items-center justify-center glass rounded-full text-foreground press hoverable:hover:bg-card disabled:opacity-30",
        className,
      )}
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
