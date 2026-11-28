"use client";

import * as React from "react";
import { useDs } from "@/lib/flags/ds";
import { SPREAD_SEED, refit, setBlock, spreadBlocks, type SpreadKind } from "@/lib/work/spreads";
import { cn } from "@/lib/utils";

/* ds: arrange a project's spread blocks (design system preview, DESIGN.md "No Singles"). The hero is always frame 1;
   each block after it is a full, a pair or a row of three. Changing a block keeps the blocks after it where they
   still fit and fills the end, so the code always covers every frame. The preview is the page's own rule: frames in
   a block share one height, each at its own ratio. Saved with the rest of the draft, in content/projects.json. */

const KINDS: [SpreadKind, string][] = [
  ["full", "Full"],
  ["pair", "Pair"],
  ["row", "Row"],
];

export function AdminSpreads({
  slug,
  photos,
  value,
  onChange,
}: {
  slug: string;
  /** The draft's photographs, in order (no passages). */
  photos: string[];
  /** This project's arranged code in the draft, if any. */
  value: string | undefined;
  /** Null is back to the hand pick. */
  onChange: (next: string | null) => void;
}) {
  const ds = useDs();
  const [ratio, setRatio] = React.useState<Record<string, number>>({});
  const count = photos.length;
  if (!ds || count < 2) return null;
  const pick = spreadBlocks(SPREAD_SEED[slug], count) ? SPREAD_SEED[slug] : null;
  const mine = spreadBlocks(value, count) ? value! : null;
  const code = mine ?? pick ?? refit("", count);
  const blocks = spreadBlocks(code, count) ?? [];
  const frame = (i: number) => {
    const src = photos[i];
    const r = ratio[src] ?? 0.8;
    return (
      // A plain <img>: the preview needs the file's own ratio, and a staged upload has no size on record.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        src={src}
        alt={`Frame ${i + 1}`}
        loading="lazy"
        draggable={false}
        onLoad={(e) => {
          const im = e.currentTarget;
          if (im.naturalHeight) setRatio((m) => (m[src] ? m : { ...m, [src]: im.naturalWidth / im.naturalHeight }));
        }}
        style={{ flex: `${r} 1 0%`, aspectRatio: r, minWidth: 0, objectFit: "cover" }}
      />
    );
  };
  return (
    <section className="border-t border-border p-5" aria-label="Spreads">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="label">
          Spreads
          <span className="ml-3 text-muted-foreground">
            {mine ? "Arranged here" : pick ? "Hand pick" : "Not arranged: the page keeps today's layout until a block is set"}
          </span>
        </p>
        {mine ? (
          <button type="button" onClick={() => onChange(null)} className="label border border-border px-3 py-2 press hoverable:hover:bg-card">
            {pick ? "Back to the hand pick" : "Clear"}
          </button>
        ) : null}
      </div>
      <div className="grid max-w-[640px] gap-1">
        <div className="grid grid-cols-[minmax(0,1fr)_168px] items-center gap-3">
          <div className="flex">{frame(0)}</div>
          <span className="label text-muted-foreground">01 Hero</span>
        </div>
        {blocks.map((b, i) => (
          <div key={b.frames[0]} className="grid grid-cols-[minmax(0,1fr)_168px] items-center gap-3">
            <div className={cn("flex gap-1", b.kind === "full" && (ratio[photos[b.frames[0]]] ?? 0.8) < 1 && "mx-auto w-1/2")}>{b.frames.map(frame)}</div>
            <div className="flex" role="group" aria-label={`Block ${i + 1}, frames ${b.frames.map((f) => f + 1).join(", ")}`}>
              {KINDS.map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={b.kind === kind}
                  onClick={() => {
                    const next = setBlock(code, i, kind, count);
                    onChange(next === pick ? null : next);
                  }}
                  className={cn(
                    "label -ml-px border border-border px-3 py-2 press first:ml-0",
                    b.kind === kind ? "bg-foreground text-background" : "text-muted-foreground hoverable:hover:bg-card",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
