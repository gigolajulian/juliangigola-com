"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { SiteContent } from "@/lib/content";
import type { AdminProject } from "@/components/admin-projects";

/* ── the preview ──────────────────────────────────────────────────
 * The draft, drawn with the site's own type and colour.
 *
 * Deliberately not an iframe of the live site: that shows the last build, so
 * it would answer a question nobody is asking. Everything here is rendered
 * from the draft in memory, which means the panel changes as you type and
 * shows exactly what pressing Publish would put on the site.
 *
 * It is a rendering of the content, not a pixel copy of the page. A faithful
 * clone would mean either importing the real sections — which drag in the
 * whole archive and a scroll-linked masthead that has no business running in
 * a side panel — or maintaining a second copy of the homepage that silently
 * drifts from the first. What the draft actually controls is order, wording
 * and what is shown at all, and that is what this shows, at the real scale
 * and in the real face.
 * ─────────────────────────────────────────────────────────────── */

export function AdminPreview({
  draft,
  projects,
  hidden,
}: {
  draft: SiteContent;
  projects: AdminProject[];
  hidden: Set<string>;
}) {
  const bySlug = React.useMemo(
    () => new Map(projects.map((p) => [p.slug, p])),
    [projects],
  );

  const featured = draft.featured
    .map((slug) => bySlug.get(slug))
    .filter((p): p is AdminProject => Boolean(p));

  const cover = bySlug.get(draft.coverSlug);

  // Named rather than silently dropped: a typo in a slug is invisible in a
  // preview that just renders fewer cards than expected.
  const missing = [draft.coverSlug, ...draft.featured].filter(
    (slug) => slug.trim() !== "" && !bySlug.has(slug),
  );
  const withheld = draft.featured.filter((slug) => hidden.has(slug));

  return (
    <div className="border border-border">
      <p className="label border-b border-border px-4 py-3 text-muted-foreground">
        Preview — the draft, not the live site
      </p>

      <div className="flex flex-col gap-10 p-4">
        {missing.length > 0 ? (
          <Warning>
            No project called {missing.map((s) => `"${s}"`).join(", ")}. It will
            be skipped.
          </Warning>
        ) : null}

        {withheld.length > 0 ? (
          <Warning>
            {withheld.map((s) => `"${s}"`).join(", ")}{" "}
            {withheld.length === 1 ? "is" : "are"} in Selected work but hidden,
            so {withheld.length === 1 ? "it" : "they"} will not appear.
          </Warning>
        ) : null}

        <Block label="Cover">
          {cover ? (
            <div className="flex items-center gap-4">
              <Thumb project={cover} className="h-28 w-[5.5rem]" />
              <div className="min-w-0">
                <p className="font-display text-2xl uppercase leading-none tracking-[0.02em]">
                  Julian Gigola
                </p>
                <p className="label mt-2 text-muted-foreground">{cover.name}</p>
              </div>
            </div>
          ) : (
            <Empty>No cover chosen.</Empty>
          )}
        </Block>

        <Block
          label={`Selected work — ${featured.filter((p) => !hidden.has(p.slug)).length}`}
        >
          {featured.length ? (
            // Three across, as the homepage lays it out.
            <ul className="grid grid-cols-3 gap-1">
              {featured
                .filter((p) => !hidden.has(p.slug))
                .map((p, i) => (
                  <li key={p.slug} className="relative">
                    <Thumb project={p} className="aspect-[4/5] w-full" />
                    <span className="label absolute left-2 top-2 tabular-nums text-foreground drop-shadow">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="label mt-1 truncate text-muted-foreground">
                      {p.name}
                    </p>
                  </li>
                ))}
            </ul>
          ) : (
            <Empty>Nothing featured.</Empty>
          )}
        </Block>

        <Block label={`Sessions — ${draft.sessions.length}`}>
          {draft.sessions.length ? (
            <ul className="flex flex-col">
              {draft.sessions.map((s) => (
                <li
                  key={s.slug}
                  className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-0"
                >
                  <span className="font-display text-lg uppercase tracking-[0.02em]">
                    {s.name}
                  </span>
                  <span className="label shrink-0 text-muted-foreground">
                    {s.from === null ? "On request" : `From $${s.from}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No session types.</Empty>
          )}
        </Block>

        <Block label={`Testimonials — ${draft.testimonials.length}`}>
          {draft.testimonials.length ? (
            <ul className="flex flex-col gap-4">
              {draft.testimonials.map((t, i) => (
                <li key={i}>
                  <p className="text-sm leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p className="label mt-2 text-muted-foreground">
                    {t.name}
                    {t.role ? ` — ${t.role}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>None. The section is left out entirely.</Empty>
          )}
        </Block>

        <Block label="Contact">
          <p className="text-sm text-muted-foreground">
            {draft.responseTime
              ? `Replies ${draft.responseTime}.`
              : "No response time set."}{" "}
            {draft.bookingUrl
              ? "Booking link shown."
              : "No booking link — those buttons stay off."}
          </p>
        </Block>
      </div>
    </div>
  );
}

function Thumb({
  project,
  className,
}: {
  project: AdminProject;
  className?: string;
}) {
  return (
    <span
      className={cn("relative block shrink-0 overflow-hidden", className)}
      style={{ backgroundColor: project.cover.color }}
    >
      <Image
        src={project.cover.src}
        alt=""
        fill
        sizes="200px"
        className="object-cover"
      />
    </span>
  );
}

function Block({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="label border-b border-border pb-2 text-muted-foreground">
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

const Warning = ({ children }: { children: React.ReactNode }) => (
  <p className="label border border-destructive px-3 py-2 text-destructive">
    {children}
  </p>
);
