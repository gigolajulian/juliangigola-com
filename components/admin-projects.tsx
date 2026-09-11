"use client";

import * as React from "react";
import Image from "next/image";
import {
  ADDED_PATH,
  type AddedProject,
  type TrashedProject,
} from "@/lib/added";
import { commitFiles, readFile } from "@/lib/admin-github";
import { cn } from "@/lib/utils";

/* ── the project list ─────────────────────────────────────────────
 * Everything on the site, and what can be done to it.
 *
 * Removal is two different operations wearing one label, and the difference
 * is worth understanding rather than hiding:
 *
 *   - **Hide** takes a project off the site. It works on anything, it is
 *     reversible, and it is the only kind of removal a harvested project can
 *     have — `lib/work-data.ts` is regenerated from the old site, so deleting
 *     an entry there comes back on the next harvest with nothing to show it
 *     ever went.
 *   - **Delete** only applies to projects added here. It removes the entry and
 *     the photographs, in one commit, and does not come back.
 *
 * So the button you get depends on where the project came from, and the one
 * that cannot be undone says so.
 * ─────────────────────────────────────────────────────────────── */

export type AdminProject = {
  slug: string;
  name: string;
  /** Display name of its discipline, for the row and the filter. */
  category: string;
  /** Its discipline's slug, for the refiling dropdown. */
  categorySlug: string;
  frames: number;
  cover: { src: string; width: number; height: number; color: string };
  /** Added through this editor, so its files are ours to remove. */
  added: boolean;
};

type Status =
  | { kind: "idle" }
  | { kind: "working"; message: string }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

export function AdminProjects({
  token,
  projects,
  hidden,
  onHiddenChange,
  onRemoved,
  disciplines,
  recategorised,
  onRecategorise,
}: {
  token: string;
  projects: AdminProject[];
  /** Slugs currently hidden, as the draft has them. */
  hidden: Set<string>;
  onHiddenChange: (next: Set<string>) => void;
  /** Handed the new bin contents after a removal, so the panel below updates. */
  onRemoved?: (trash: TrashedProject[]) => void;
  /** Disciplines a project can be refiled under. */
  disciplines: { slug: string; name: string }[];
  /** Draft refilings, slug → category slug. */
  recategorised: Record<string, string>;
  onRecategorise: (slug: string, categorySlug: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [gone, setGone] = React.useState<Set<string>>(new Set());

  const visible = projects.filter(
    (p) =>
      !gone.has(p.slug) &&
      (query.trim() === "" ||
        `${p.name} ${p.slug} ${p.category}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );

  const toggleHidden = (slug: string) => {
    const next = new Set(hidden);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onHiddenChange(next);
  };

  /**
   * Moves the project to Recently deleted.
   *
   * The entry leaves `projects`, so the route stops being built and every
   * index forgets it immediately — the work is off the site the moment this
   * deploys. The photographs stay exactly where they are, which is what makes
   * recovery a matter of moving the entry back rather than of finding the
   * originals again. They go for good a week later; see `admin-trash.tsx`.
   *
   * One commit, and nothing is destroyed in it.
   */
  async function remove(slug: string) {
    setConfirming(null);
    try {
      setStatus({ kind: "working", message: `Reading ${slug}…` });

      const current = await readFile(token, ADDED_PATH);
      if (!current) throw new Error("Could not read the project list.");
      const parsed = JSON.parse(current) as {
        projects: AddedProject[];
        trash?: TrashedProject[];
        hidden?: string[];
      };

      const entry = parsed.projects.find((p) => p.slug === slug);
      if (!entry) {
        throw new Error(
          `"${slug}" is not in the project list — it may already be removed.`,
        );
      }

      parsed.projects = parsed.projects.filter((p) => p.slug !== slug);
      parsed.trash = [
        { ...entry, deletedAt: new Date().toISOString() },
        ...(parsed.trash ?? []),
      ];
      // Hiding something that is no longer published is dead weight, and would
      // silently suppress a future project that reused the slug.
      parsed.hidden = (parsed.hidden ?? []).filter((s) => s !== slug);

      await commitFiles({
        token,
        message: `Remove ${slug} from /admin`,
        files: [
          {
            path: ADDED_PATH,
            content: `${JSON.stringify(parsed, null, 2)}\n`,
            encoding: "utf-8" as const,
          },
        ],
      });

      setGone((g) => new Set(g).add(slug));
      onHiddenChange(new Set([...hidden].filter((s) => s !== slug)));
      onRemoved?.(parsed.trash);
      setStatus({
        kind: "done",
        message: `${entry.name} moved to Recently deleted. Its photographs are kept for a week.`,
      });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const hiddenCount = projects.filter(
    (p) => hidden.has(p.slug) && !gone.has(p.slug),
  ).length;

  return (
    <section className="border-t border-border pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="title">Projects</h2>
        <p className="label text-muted-foreground">
          {projects.length - gone.size} total
          {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}
        </p>
      </div>

      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Hiding takes a project off the site and can be undone at any time.
        Removing takes it off and puts it in Recently deleted, where its
        photographs are kept for a week — offered only for projects added here,
        because the migrated archive is regenerated and a removal there would
        come back.
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by name, slug or discipline"
        className="mt-6 w-full border border-border bg-transparent px-4 py-3 text-sm outline-none focus-visible:border-foreground"
      />

      {status.kind !== "idle" ? (
        <p
          className={cn(
            "label mt-4",
            status.kind === "error"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {status.message}
        </p>
      ) : null}

      <ul className="mt-6 border-t border-border">
        {visible.map((p) => {
          const isHidden = hidden.has(p.slug);
          return (
            <li
              key={p.slug}
              className={cn(
                "flex items-center gap-4 border-b border-border py-3",
                isHidden && "opacity-45",
              )}
            >
              <span
                className="relative block h-14 w-11 shrink-0 overflow-hidden"
                style={{ backgroundColor: p.cover.color }}
              >
                <Image
                  src={p.cover.src}
                  alt=""
                  fill
                  sizes="44px"
                  className="object-cover"
                  // Dozens of rows; none of them worth blocking the page.
                  loading="lazy"
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">
                  {p.name}
                </span>
                <span className="label block truncate text-muted-foreground">
                  {p.category} · {p.frames} frames · /{p.slug}
                  {isHidden ? " · hidden" : ""}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-2">
                {/* Refiling works on migrated projects too, which is why it
                    is an override map rather than a field: their categories
                    come from the generated manifest, where an edit would last
                    until the next harvest and no longer. */}
                <select
                  value={recategorised[p.slug] ?? p.categorySlug}
                  onChange={(e) => onRecategorise(p.slug, e.target.value)}
                  aria-label={`Discipline for ${p.name}`}
                  className="label max-w-[9rem] border border-border bg-transparent px-2 py-2 text-muted-foreground outline-none focus-visible:border-foreground"
                >
                  {disciplines.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => toggleHidden(p.slug)}
                  className="label border border-border px-3 py-2 press hoverable:hover:bg-card"
                >
                  {isHidden ? "Show" : "Hide"}
                </button>

                {p.added ? (
                  confirming === p.slug ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void remove(p.slug)}
                        className="label border border-destructive px-3 py-2 text-destructive press"
                      >
                        Really delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="label border border-border px-3 py-2 press hoverable:hover:bg-card"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(p.slug)}
                      className="label border border-border px-3 py-2 text-muted-foreground press hoverable:hover:text-destructive"
                    >
                      Remove
                    </button>
                  )
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing matches that.
        </p>
      ) : null}

      <p className="label mt-6 text-muted-foreground">
        Hiding is part of the draft — it publishes with the rest when you press
        Publish. Deleting commits on its own, immediately.
      </p>
    </section>
  );
}
