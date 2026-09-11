"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── the sitemap ──────────────────────────────────────────────────
 * Every page the site publishes, as the draft would leave it.
 *
 * It reads from the same draft the rest of the editor is editing, so hiding a
 * project strikes its row through here before anything is committed — which
 * is the point. The question this answers is "what will the site be when I
 * press publish", and a sitemap generated from the last build cannot answer
 * that.
 * ─────────────────────────────────────────────────────────────── */

export type SitemapProject = { slug: string; name: string; category: string };

export function AdminSitemap({
  projects,
  hidden,
  categories,
  origin,
}: {
  projects: SitemapProject[];
  hidden: Set<string>;
  categories: { slug: string; name: string; href: string }[];
  /** Where to open a page. Empty until the browser is there to ask. */
  origin: string;
}) {
  const live = projects.filter((p) => !hidden.has(p.slug));

  const byCategory = new Map<string, SitemapProject[]>();
  for (const p of live) {
    byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  }

  const pages = ["/", "/work", "/sessions", "/studio", "/contact"];

  return (
    <section className="border-t border-border pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="title">Sitemap</h2>
        <p className="label text-muted-foreground">
          {pages.length + categories.length + live.length} pages
          {hidden.size > 0 ? ` · ${hidden.size} withheld` : ""}
        </p>
      </div>

      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
        As the draft would leave it — hidden projects are struck through and
        will not be published, linked, or listed in{" "}
        <code className="text-foreground">sitemap.xml</code>.
      </p>

      <Group title="Pages">
        {pages.map((href) => (
          <Row key={href} href={href} origin={origin} label={href} />
        ))}
      </Group>

      <Group title="Disciplines">
        {/* Keyed by slug, not href. `categoryHref` sends a discipline with no
            work yet to `/work`, so several of them share a destination — and
            keying on that silently collapses them into one row. */}
        {categories.map((c) => (
          <Row
            key={c.slug}
            href={c.href}
            origin={origin}
            label={c.name}
            hint={c.href}
          />
        ))}
      </Group>

      {[...byCategory.entries()].map(([category, list]) => (
        <Group key={category} title={category} count={list.length}>
          {list.map((p) => (
            <Row
              key={p.slug}
              href={`/work/${p.slug}`}
              origin={origin}
              label={p.name}
              hint={`/work/${p.slug}`}
            />
          ))}
        </Group>
      ))}

      {hidden.size > 0 ? (
        <Group title="Withheld" count={hidden.size}>
          {projects
            .filter((p) => hidden.has(p.slug))
            .map((p) => (
              <Row
                key={p.slug}
                href={`/work/${p.slug}`}
                origin={origin}
                label={p.name}
                hint={`/work/${p.slug}`}
                struck
              />
            ))}
        </Group>
      ) : null}
    </section>
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
    <div className="mt-8">
      <p className="label flex items-baseline gap-3 border-b border-border pb-2 text-muted-foreground">
        {title}
        {count !== undefined ? (
          <span className="tabular-nums">{count}</span>
        ) : null}
      </p>
      <ul className="mt-1">{children}</ul>
    </div>
  );
}

function Row({
  href,
  origin,
  label,
  hint,
  struck,
}: {
  href: string;
  origin: string;
  label: string;
  hint?: string;
  struck?: boolean;
}) {
  return (
    <li className="flex items-baseline gap-4 border-b border-border py-2">
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          struck && "line-through opacity-50",
        )}
      >
        {label}
      </span>
      {hint ? (
        <span className="label hidden shrink-0 text-muted-foreground sm:block">
          {hint}
        </span>
      ) : null}
      {/* Opens the live page, which is the last build — not the draft. Said
          plainly rather than implied, because a link that quietly shows stale
          content is worse than no link. */}
      {origin && !struck ? (
        <a
          href={`${origin}${href}`}
          target="_blank"
          rel="noreferrer"
          className="label shrink-0 text-muted-foreground underline underline-offset-4 hoverable:hover:text-foreground"
        >
          Open live
        </a>
      ) : null}
    </li>
  );
}
