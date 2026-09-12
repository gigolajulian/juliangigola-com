"use client";

import * as React from "react";
import type { Credit } from "@/lib/work-types";
import { instagramHandle } from "@/lib/added";
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
          <div key={i} className="flex flex-wrap items-center gap-2">
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
              placeholder="Name"
              aria-label={`Name for credit ${i + 1}`}
              className={field}
            />
            {/* Kept raw while typing and normalised on the way out.
                Rewriting the box under somebody's cursor — eating the `@` as
                they type it, lowercasing mid-word — is the kind of helpful
                that makes a field feel broken. `@` is printed beside it
                instead of expected inside it, and a pasted profile URL is
                accepted whole and reduced on blur. */}
            <span className="relative shrink-0 sm:w-52">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                @
              </span>
              <input
                value={credit.instagram ?? ""}
                onChange={(e) => set(i, { instagram: e.target.value })}
                onBlur={(e) =>
                  set(i, { instagram: instagramHandle(e.target.value) })
                }
                placeholder="instagram"
                aria-label={`Instagram handle for credit ${i + 1}`}
                className={cn(field, "pl-7")}
              />
            </span>
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
        onClick={() =>
          onChange([...credits, { role: "", name: "", instagram: null }])
        }
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

/**
 * Drops the half-filled rows, and anything unusable in the handle.
 *
 * Role and name are both required — half a credit is not one. The handle is
 * not: a crew member with no Instagram, or with one nobody could remember, is
 * an ordinary credit and prints as plain text. Normalised here as well as on
 * blur, because a row can be added and published without the field ever being
 * focused, and `lib/added.ts` would then refuse the build over a stray `@`.
 */
export const tidyCredits = (credits: Credit[]): Credit[] =>
  credits
    .filter((c) => c.role.trim() !== "" && c.name.trim() !== "")
    .map((c) => ({
      ...c,
      instagram: c.instagram ? instagramHandle(c.instagram) : null,
    }));
