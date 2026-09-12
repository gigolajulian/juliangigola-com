"use client";

import * as React from "react";
import type { Credit } from "@/lib/work-types";
import { cn } from "@/lib/utils";

/* ── credits ──────────────────────────────────────────────────────
 * Role and name, as many rows as the job had.
 *
 * One component for both the project being added and the seventy already on
 * the site, because it is the same list and the same gesture — the only
 * difference is where the result is stored, and that is the caller's problem.
 *
 * Blank rows are kept while typing and dropped on save. Somebody adding four
 * credits presses Add four times before filling any of them in, and a form
 * that deletes the empty row underneath them is a form that fights back.
 * ─────────────────────────────────────────────────────────────── */

const field =
  "w-full border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-foreground";

/** What the roles actually are on Julian's jobs, in the order they recur. */
const ROLES = [
  "Client",
  "Model",
  "Artist",
  "Styling",
  "Hair",
  "Make-up",
  "Set design",
  "Production",
  "Assistant",
  "Retouching",
  "Direction",
];

export function AdminCredits({
  credits,
  onChange,
  /** Shown above the rows. Absent inside a panel that already has a heading. */
  title = "Credits",
  className,
}: {
  credits: Credit[];
  onChange: (c: Credit[]) => void;
  title?: string | null;
  className?: string;
}) {
  const set = (i: number, patch: Partial<Credit>) =>
    onChange(credits.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const move = (i: number, to: number) => {
    if (to < 0 || to >= credits.length) return;
    const next = [...credits];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };

  return (
    <div className={className}>
      {title ? (
        <p className="label flex items-baseline justify-between gap-3 text-muted-foreground">
          <span>{title}</span>
          {credits.length ? (
            <span className="tabular-nums">{credits.length}</span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {credits.map((credit, i) => (
          <div key={i} className="flex items-center gap-2">
            {/* A list, not a closed set. The roles above cover most jobs and
                save the typing; anything can still be written in, because a
                shoot invents a role now and then and a dropdown that refuses
                one is a dropdown you work around by lying. */}
            <input
              value={credit.role}
              onChange={(e) => set(i, { role: e.target.value })}
              list="jg-credit-roles"
              placeholder="Role"
              aria-label={`Role for credit ${i + 1}`}
              className={cn(field, "sm:w-44 sm:shrink-0")}
            />
            <input
              value={credit.name}
              onChange={(e) => set(i, { name: e.target.value })}
              placeholder="Name or @handle"
              aria-label={`Name for credit ${i + 1}`}
              className={field}
            />
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label={`Move credit ${i + 1} up`}
                className="label border border-border px-2 py-2 press hoverable:hover:bg-card disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === credits.length - 1}
                aria-label={`Move credit ${i + 1} down`}
                className="label border border-border px-2 py-2 press hoverable:hover:bg-card disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(credits.filter((_, j) => j !== i))}
                aria-label={`Remove credit ${i + 1}`}
                className="label border border-border px-2 py-2 text-muted-foreground press hoverable:hover:text-destructive"
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>

      <datalist id="jg-credit-roles">
        {ROLES.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <button
        type="button"
        onClick={() => onChange([...credits, { role: "", name: "" }])}
        className="label mt-3 border border-border px-4 py-2 press hoverable:hover:bg-card"
      >
        Add credit
      </button>

      {credits.length === 0 ? (
        <p className="label mt-3 text-muted-foreground">
          No credits. The block is left off the project page entirely.
        </p>
      ) : null}
    </div>
  );
}

/** Drops the half-filled rows. Both halves of a credit or neither. */
export const tidyCredits = (credits: Credit[]): Credit[] =>
  credits.filter((c) => c.role.trim() !== "" && c.name.trim() !== "");
