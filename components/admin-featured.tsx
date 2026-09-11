"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { AdminProject } from "@/components/admin-projects";

/* ── selected work ────────────────────────────────────────────────
 * Which projects lead the homepage, and in what order.
 *
 * This was a textarea of slugs, one per line. It worked, in the sense that
 * the right characters in the right order produced the right page — but it
 * asked Julian to remember what `oakley-x-nike` looks like as a photograph,
 * to know that a typo silently drops a card rather than failing, and to
 * reorder by cutting and pasting lines. For the single most editorial
 * decision on the homepage, that is the wrong instrument.
 *
 * Now it is the photographs, in order, with the same two arrows the frame
 * list uses.
 * ─────────────────────────────────────────────────────────────── */

export function AdminFeatured({
  featured,
  projects,
  hidden,
  onChange,
}: {
  featured: string[];
  projects: AdminProject[];
  hidden: Set<string>;
  onChange: (next: string[]) => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const bySlug = React.useMemo(
    () => new Map(projects.map((p) => [p.slug, p])),
    [projects],
  );

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= featured.length) return;
    const next = [...featured];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const candidates = projects.filter(
    (p) =>
      !featured.includes(p.slug) &&
      (query.trim() === "" ||
        `${p.name} ${p.slug} ${p.category}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );

  return (
    <div className="flex flex-col gap-3">
      <ol className="border-t border-border">
        {featured.map((slug, i) => {
          const project = bySlug.get(slug);
          const isHidden = hidden.has(slug);

          return (
            <li
              key={`${slug}-${i}`}
              className="flex items-center gap-3 border-b border-border py-2"
            >
              <span className="label w-6 shrink-0 tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>

              {project ? (
                <span
                  className="relative block h-12 w-10 shrink-0 overflow-hidden"
                  style={{ backgroundColor: project.cover.color }}
                >
                  <Image
                    src={project.cover.src}
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
                  {project?.name ?? slug}
                </span>
                {/* The two ways a row can be wrong are worth saying here
                    rather than leaving to the preview: a slug that matches
                    nothing is silently skipped, and a hidden project is
                    skipped for a different reason entirely. */}
                <span
                  className={cn(
                    "label block truncate",
                    project && !isHidden
                      ? "text-muted-foreground"
                      : "text-destructive",
                  )}
                >
                  {!project
                    ? "no project with this slug — will be skipped"
                    : isHidden
                      ? "hidden — will not appear"
                      : project.category}
                </span>
              </span>

              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${project?.name ?? slug} up`}
                  className={arrow}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === featured.length - 1}
                  aria-label={`Move ${project?.name ?? slug} down`}
                  className={arrow}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onChange(featured.filter((_, j) => j !== i))}
                  aria-label={`Remove ${project?.name ?? slug}`}
                  className={arrow}
                >
                  ✕
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      {featured.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing selected — the section is left out of the homepage entirely.
        </p>
      ) : null}

      {adding ? (
        <div className="border border-border">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects"
            className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-foreground"
          />
          <ul className="max-h-64 overflow-y-auto">
            {candidates.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...featured, p.slug]);
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
                      {p.category}
                      {hidden.has(p.slug) ? " · hidden" : ""}
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
          className="label self-start border border-border px-4 py-2 press hoverable:hover:bg-card"
        >
          Add a project
        </button>
      )}
    </div>
  );
}

const arrow =
  "label border border-border px-2 py-1 text-muted-foreground transition-opacity hoverable:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30";
