"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/* ── the sitemap ──────────────────────────────────────────────────
 * Every page the site publishes, as the draft would leave it.
 *
 * Drawn rather than listed. A column of URLs is a thing to read; a grid of
 * the actual covers is a thing to recognise, and recognising a photograph is
 * how Julian knows which project a row is without decoding a slug. The
 * disciplines keep their own colour-free grouping, so the shape of the site —
 * five sections, wildly uneven in size — is visible at a glance rather than
 * inferred from counting.
 *
 * It reads the draft, not the last build, so hiding a project dims it here
 * before anything is committed. The question this answers is "what will the
 * site be when I press publish", and a sitemap generated from the last deploy
 * cannot answer that.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Somewhere in the editor a sitemap row can send you.
 *
 * The sitemap is the index of the site and is on screen at all times, which
 * makes it the natural way to get anywhere — so a row is a control rather
 * than a link out. A project opens its own photographs and credits; a page
 * goes to whichever fields actually drive it; a discipline narrows the list
 * to the work filed under it.
 */
export type SitemapTarget =
  | { kind: "project"; slug: string }
  | { kind: "field"; anchor: string }
  | { kind: "projects"; discipline?: string };

export type SitemapProject = {
  slug: string;
  name: string;
  category: string;
  cover?: { src: string; color: string };
};

/**
 * The fixed pages, and what editing each one actually means.
 *
 * `target` is absent for Studio on purpose: its copy — the biography, the
 * vision, how a commission runs — lives in `app/studio/page.tsx` and not in
 * `content/site.json`, so there is no field to send anybody to. A row that
 * claimed to be editable and then went nowhere would be worse than one that
 * honestly just opens the published page.
 */
const PAGES: {
  href: string;
  label: string;
  target?: SitemapTarget;
  note?: string;
}[] = [
  { href: "/", label: "Home", target: { kind: "field", anchor: "featured" } },
  { href: "/work", label: "Work", target: { kind: "projects" } },
  {
    href: "/sessions",
    label: "Sessions",
    target: { kind: "field", anchor: "sessions" },
  },
  { href: "/studio", label: "Studio", note: "copy lives in the page itself" },
  {
    href: "/contact",
    label: "Contact",
    target: { kind: "field", anchor: "responseTime" },
  },
];

export function AdminSitemap({
  projects,
  hidden,
  categories,
  origin,
  onGo,
  compact,
}: {
  projects: SitemapProject[];
  hidden: Set<string>;
  categories: { slug: string; name: string; href: string }[];
  origin: string;
  /** Given, rows become controls into the editor rather than links out. */
  onGo?: (target: SitemapTarget) => void;
  /** For the narrow left rail: smaller tiles, no per-row link. */
  compact?: boolean;
}) {
  const live = projects.filter((p) => !hidden.has(p.slug));

  const byCategory = new Map<string, SitemapProject[]>();
  for (const p of live) {
    byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  }

  const withheld = projects.filter((p) => hidden.has(p.slug));
  const total = PAGES.length + categories.length + live.length;

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
        <h2
          className={cn(
            "font-display uppercase tracking-[0.02em]",
            compact ? "text-lg" : "text-2xl",
          )}
        >
          Sitemap
        </h2>
        <span className="label tabular-nums text-muted-foreground">
          {total}
        </span>
      </div>

      {!compact ? (
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
          As the draft would leave it. Dimmed projects are hidden and will not
          be published, linked, or listed in{" "}
          <code className="text-foreground">sitemap.xml</code>.
        </p>
      ) : null}

      {/* The fixed pages, as a plain column — there are five and they never
          change, so a grid of identical rectangles would be decoration. */}
      <Group title="Pages">
        <ul className="flex flex-col">
          {PAGES.map((p) => {
            const body = (
              <>
                <span className="flex-1 truncate text-sm">{p.label}</span>
                <span className="label shrink-0 text-muted-foreground">
                  {p.note ?? p.href}
                </span>
              </>
            );
            return (
              <li key={p.href} className="border-b border-border last:border-0">
                {onGo && p.target ? (
                  <button
                    type="button"
                    onClick={() => onGo(p.target!)}
                    className={cn(row, "w-full text-left")}
                  >
                    {body}
                  </button>
                ) : (
                  <Open href={p.href} origin={origin} className={row}>
                    {body}
                  </Open>
                )}
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title="Disciplines" count={categories.length}>
        <ul className="flex flex-col">
          {/* Keyed by slug, not href: `categoryHref` sends a discipline with
              no work yet to `/work`, so several share a destination and
              keying on that collapses them into one row. */}
          {categories.map((c) => {
            const n = byCategory.get(c.name)?.length ?? 0;
            const body = (
              <>
                <span className="flex-1 truncate text-sm">{c.name}</span>
                <span className="label shrink-0 tabular-nums text-muted-foreground">
                  {n || "—"}
                </span>
              </>
            );
            return (
              <li key={c.slug} className="border-b border-border last:border-0">
                {onGo ? (
                  <button
                    type="button"
                    onClick={() =>
                      onGo({ kind: "projects", discipline: c.name })
                    }
                    className={cn(row, "w-full text-left")}
                  >
                    {body}
                  </button>
                ) : (
                  <Open href={c.href} origin={origin} className={row}>
                    {body}
                  </Open>
                )}
              </li>
            );
          })}
        </ul>
      </Group>

      {[...byCategory.entries()].map(([category, list]) => (
        <Group key={category} title={category} count={list.length}>
          <Tiles
            projects={list}
            origin={origin}
            onGo={onGo}
            compact={compact}
          />
        </Group>
      ))}

      {withheld.length > 0 ? (
        <Group title="Hidden" count={withheld.length}>
          {/* Shown, not omitted. A project you have taken down is exactly the
              one you will want to find again. */}
          <Tiles
            projects={withheld}
            origin={origin}
            onGo={onGo}
            compact={compact}
            dim
          />
        </Group>
      ) : null}
    </section>
  );
}

/** One row of the two plain lists, control or link alike. */
const row =
  "flex items-baseline gap-3 py-1.5 transition-colors duration-200 hoverable:hover:text-foreground";

function Tiles({
  projects,
  origin,
  onGo,
  compact,
  dim,
}: {
  projects: SitemapProject[];
  origin: string;
  onGo?: (target: SitemapTarget) => void;
  compact?: boolean;
  dim?: boolean;
}) {
  return (
    <ul
      className={cn(
        "grid gap-1",
        // Wider rails on a big display mean more of the site visible without
        // scrolling the panel, which is the whole point of it being a map.
        compact ? "grid-cols-4 2xl:grid-cols-5" : "grid-cols-6 2xl:grid-cols-8",
      )}
    >
      {projects.map((p) => {
        const cover = (
          <>
            <span
              className="relative block aspect-[4/5] overflow-hidden"
              style={{ backgroundColor: p.cover?.color ?? "transparent" }}
            >
              {p.cover ? (
                <Image
                  src={p.cover.src}
                  alt=""
                  fill
                  sizes="120px"
                  loading="lazy"
                  className="object-cover transition-opacity duration-200 hoverable:group-hover:opacity-75"
                />
              ) : null}
            </span>
            {!compact ? (
              <span className="label mt-1 block truncate text-muted-foreground">
                {p.name}
              </span>
            ) : null}
          </>
        );

        return (
          <li key={p.slug}>
            {onGo ? (
              /* A button, not a link. The draft lives in this page's memory
                 and navigating away loses it, so the sitemap's job while
                 editing is to move you around the editor rather than off it.
                 The live page is still one click away, on the row's own
                 link in the groups above. */
              <button
                type="button"
                onClick={() => onGo({ kind: "project", slug: p.slug })}
                title={`Edit ${p.name} — /work/${p.slug}`}
                className={cn(
                  "group block w-full cursor-pointer text-left press",
                  dim && "opacity-40",
                )}
              >
                {cover}
              </button>
            ) : (
              <Open
                href={`/work/${p.slug}`}
                origin={origin}
                className={cn("group block", dim && "opacity-40")}
              >
                <span title={`${p.name} — /work/${p.slug}`}>{cover}</span>
              </Open>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A link to the live page — which is the last build, not the draft.
 *
 * Falls back to a plain span before the origin is known, rather than
 * rendering a relative link that would navigate away from the editor and
 * lose an unpublished draft.
 */
function Open({
  href,
  origin,
  className,
  children,
}: {
  href: string;
  origin: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!origin) return <span className={className}>{children}</span>;
  return (
    <a
      href={`${origin}${href}`}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "transition-colors duration-200 hoverable:hover:text-foreground",
        className,
      )}
    >
      {children}
    </a>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <p className="label flex items-baseline justify-between gap-3 pb-2 text-muted-foreground">
        <span className="truncate">{title}</span>
        {count !== undefined ? (
          <span className="tabular-nums">{count}</span>
        ) : null}
      </p>
      {children}
    </div>
  );
}
