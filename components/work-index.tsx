"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Project, Category } from "@/lib/work-types";

/* ── the contact sheet ────────────────────────────────────────────
 * The index is a typographic list, not a grid of thumbnails.
 *
 * Seventy-odd projects as a grid is a wall — nothing is legible and nothing
 * is comparable. As a list they are all scannable at once, and pointing at a
 * row brings its opening frame up in the fixed panel beside it. That is a
 * photographer's contact sheet: names on the sleeve, the frame you are
 * looking at held up to the light.
 *
 * It is also the fast option. The list is text, so it renders instantly and
 * a crawler reads every project; only one photograph is ever loaded at full
 * size, and it changes as you move.
 *
 * On a touch screen there is no pointer to follow, so each row carries its
 * own frame inline and the panel is not rendered at all.
 * ─────────────────────────────────────────────────────────────── */

export function WorkIndex({
  projects,
  categories,
}: {
  projects: Project[];
  categories: Category[];
}) {
  const [filter, setFilter] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);

  const shown = React.useMemo(
    () => (filter ? projects.filter((p) => p.categories.some((c) => c.slug === filter)) : projects),
    [projects, filter],
  );

  // A filter change can leave the highlight pointing past the end of the
  // shorter list. Clamping on read covers that without a state sync, and the
  // filter buttons reset it to the top so a new filter always previews its
  // own first project rather than whatever row was last pointed at.
  const preview = shown[Math.min(active, shown.length - 1)];

  const applyFilter = (slug: string | null) => {
    setFilter(slug);
    setActive(0);
  };

  return (
    <>
      {/* Filters. The old site's three dropdowns become one row that can be
          ignored: the default is everything, so nobody has to make a choice
          before they can look at anything. */}
      <nav aria-label="Filter by category" className="mt-10 border-b border-border pb-5">
        <ul className="flex flex-wrap gap-x-6 gap-y-3">
          <li>
            <FilterButton active={filter === null} onClick={() => applyFilter(null)}>
              All
            </FilterButton>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <FilterButton active={filter === c.slug} onClick={() => applyFilter(c.slug)}>
                {c.name}
              </FilterButton>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8 gap-16 lg:flex lg:items-start">
        <ol className="lg:w-1/2 lg:min-w-0">
          {shown.map((project, i) => {
            const client = project.credits.find((c) => /client|model|artist/i.test(c.role));

            return (
              <li key={project.slug}>
                <Link
                  href={`/work/${project.slug}`}
                  // Focus updates the panel too, so a keyboard visitor sees
                  // exactly what a pointer visitor sees. Without this the
                  // panel would sit on whatever was hovered last.
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className={cn(
                    "group block border-b border-border py-5 transition-colors duration-200",
                    "hoverable:hover:border-foreground/30",
                  )}
                >
                  {/* Touch screens have no pointer to follow, so the frame
                      comes to the row. Lazy and display:none above `lg`, so a
                      desktop visit does not pay for seventy of these. */}
                  <div
                    className="relative mb-4 overflow-hidden lg:hidden"
                    style={{
                      backgroundColor: project.cover.color,
                      aspectRatio: `${project.cover.width} / ${project.cover.height}`,
                    }}
                  >
                    <Image
                      src={project.cover.src}
                      alt={project.cover.alt || project.name}
                      width={project.cover.width}
                      height={project.cover.height}
                      sizes="100vw"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="flex items-baseline justify-between gap-6">
                    <h2 className="font-display text-xl leading-tight sm:text-2xl">
                      {project.name}
                    </h2>
                    <span className="label shrink-0 text-muted-foreground">
                      {client ? client.name : project.categories[0]?.name}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}

          {shown.length === 0 ? (
            <li className="py-10 text-sm text-muted-foreground">
              Nothing filed under that yet.
            </li>
          ) : null}
        </ol>

        {/* The panel. Sticky rather than fixed, so it scrolls out with the
            section instead of hanging over the footer. */}
        <div className="hidden lg:sticky lg:top-28 lg:block lg:w-1/2">
          {preview ? (
            <div
              key={preview.slug}
              className="relative overflow-hidden"
              style={{
                backgroundColor: preview.cover.color,
                aspectRatio: `${preview.cover.width} / ${preview.cover.height}`,
              }}
            >
              <Image
                src={preview.cover.src}
                alt=""
                width={preview.cover.width}
                height={preview.cover.height}
                sizes="50vw"
                priority
                // `key` on the wrapper remounts this on every change, so the
                // fade runs from the start each time rather than retargeting
                // a transition that is already at its end.
                className="h-full w-full object-cover animate-in fade-in duration-300 ease-out motion-reduce:animate-none"
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "label py-1 transition-colors duration-200",
        active ? "text-foreground" : "text-muted-foreground hoverable:hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
