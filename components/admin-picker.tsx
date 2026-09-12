"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/* ── a picker ─────────────────────────────────────────────────────
 * Which things lead a section of the homepage, and in what order.
 *
 * This was a textarea of slugs, one per line. It worked, in the sense that
 * the right characters in the right order produced the right page — but it
 * asked Julian to remember what `oakley-x-nike` looks like as a photograph,
 * to know that a typo silently drops a card rather than failing, and to
 * reorder by cutting and pasting lines. For the most editorial decisions on
 * the homepage, that is the wrong instrument.
 *
 * Now it is the pictures, in order, with the same two arrows the frame list
 * uses.
 *
 * One component for projects and for cover art, because the decision is the
 * same shape in both cases — pick some things, put them in an order — and the
 * only differences are what the second line says and how many are allowed.
 * Callers map their own data down to `PickerItem`; nothing in here knows what
 * a project or a release is.
 * ─────────────────────────────────────────────────────────────── */

export type PickerItem = {
  slug: string;
  name: string;
  /** The second line: a discipline, or an artist. */
  detail: string;
  cover: { src: string; color: string };
};

export function AdminPicker({
  chosen,
  items,
  onChange,
  /** Slugs that exist but will not render — a hidden project, say. */
  unavailable,
  unavailableNote = "hidden — will not appear",
  /** Past this many, further picks would not be shown. Absent means no cap. */
  limit,
  addLabel,
  searchLabel,
  emptyNote,
  /** Explains what happens with fewer than `limit` picks. */
  shortfallNote,
  /**
   * A count past which this warns instead of refusing.
   *
   * `limit` is a hard cap — the rack shows ten and an eleventh would not be
   * drawn, so offering it would be a lie. This is the other kind of ceiling:
   * a seventh discipline on the cover renders fine and makes the cover taller
   * than the screen, which is a cost worth naming and not a decision to take
   * out of Julian's hands.
   */
  warnAfter,
  warnNote,
}: {
  chosen: string[];
  items: PickerItem[];
  onChange: (next: string[]) => void;
  unavailable?: ReadonlySet<string>;
  unavailableNote?: string;
  limit?: number;
  addLabel: string;
  searchLabel: string;
  emptyNote: string;
  shortfallNote?: string;
  warnAfter?: number;
  warnNote?: string;
}) {
  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const bySlug = React.useMemo(
    () => new Map(items.map((p) => [p.slug, p])),
    [items],
  );

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= chosen.length) return;
    const next = [...chosen];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const candidates = items.filter(
    (p) =>
      !chosen.includes(p.slug) &&
      (query.trim() === "" ||
        `${p.name} ${p.slug} ${p.detail}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );

  const full = limit !== undefined && chosen.length >= limit;

  return (
    <div className="flex flex-col gap-3">
      <ol className="border-t border-border">
        {chosen.map((slug, i) => {
          const item = bySlug.get(slug);
          const isUnavailable = unavailable?.has(slug) ?? false;
          const beyond = limit !== undefined && i >= limit;

          return (
            <li
              key={`${slug}-${i}`}
              className="flex items-center gap-3 border-b border-border py-2"
            >
              <span className="label w-6 shrink-0 tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>

              {item ? (
                <span
                  className="relative block h-12 w-10 shrink-0 overflow-hidden"
                  style={{ backgroundColor: item.cover.color }}
                >
                  <Image
                    src={item.cover.src}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </span>
              ) : (
                <span className="block h-12 w-10 shrink-0 border border-destructive" />
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {item?.name ?? slug}
                </span>
                {/* The three ways a row can be wrong are worth saying here
                    rather than leaving to the preview: a slug that matches
                    nothing is silently skipped, something withheld is skipped
                    for a different reason entirely, and a row past the limit
                    is correct but will not be reached. */}
                <span
                  className={cn(
                    "label block truncate",
                    item && !isUnavailable && !beyond
                      ? "text-muted-foreground"
                      : "text-destructive",
                  )}
                >
                  {!item
                    ? "nothing with this slug — will be skipped"
                    : isUnavailable
                      ? unavailableNote
                      : beyond
                        ? `past the first ${limit} — will not be shown`
                        : item.detail}
                </span>
              </span>

              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${item?.name ?? slug} up`}
                  className={arrow}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === chosen.length - 1}
                  aria-label={`Move ${item?.name ?? slug} down`}
                  className={arrow}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onChange(chosen.filter((_, j) => j !== i))}
                  aria-label={`Remove ${item?.name ?? slug}`}
                  className={arrow}
                >
                  ✕
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      {warnAfter !== undefined && chosen.length > warnAfter && warnNote ? (
        <p className="text-sm text-destructive">
          {chosen.length} chosen. {warnNote}
        </p>
      ) : null}

      {chosen.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyNote}</p>
      ) : shortfallNote && limit !== undefined && chosen.length < limit ? (
        <p className="text-sm text-muted-foreground">
          {chosen.length} of {limit}. {shortfallNote}
        </p>
      ) : null}

      {adding ? (
        <div className="border border-border">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchLabel}
            className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-foreground"
          />
          <ul className="max-h-64 overflow-y-auto">
            {candidates.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...chosen, p.slug]);
                    setQuery("");
                    setAdding(false);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hoverable:hover:bg-card"
                >
                  <span
                    className="relative block h-10 w-8 shrink-0 overflow-hidden"
                    style={{ backgroundColor: p.cover.color }}
                  >
                    <Image
                      src={p.cover.src}
                      alt=""
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{p.name}</span>
                    <span className="label block truncate text-muted-foreground">
                      {p.detail}
                      {unavailable?.has(p.slug) ? " · withheld" : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {candidates.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                Nothing left to add.
              </li>
            ) : null}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="label self-start border border-border px-4 py-2 press hoverable:hover:bg-card disabled:cursor-not-allowed disabled:opacity-40"
          disabled={full}
        >
          {full ? `That is all ${limit}` : addLabel}
        </button>
      )}
    </div>
  );
}

const arrow =
  "label border border-border px-2 py-1 text-muted-foreground transition-opacity hoverable:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30";
