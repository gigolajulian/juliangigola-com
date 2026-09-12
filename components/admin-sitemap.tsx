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
  /** Disciplines, each naming the page it hangs off. */
  categories: { slug: string; name: string; href: string; branch: string }[];
  origin: string;
  /** Given, rows become controls into the editor rather than links out. */
  onGo?: (target: SitemapTarget) => void;
  /** For the narrow left rail: smaller tiles, no per-row link. */
  compact?: boolean;
}) {
  /**
   * Narrows the whole map, not one group of it.
   *
   * Eighty-seven rows is a scroll, and a scroll is the wrong instrument for
   * "take me to L3NA" — you already know the name, so typing it should be the
   * whole gesture. Held here rather than lifted to the editor because nothing
   * else needs it: unlike the project list's filter, which a discipline row
   * sets, this one is only ever driven by the person typing in it.
   */
  const [find, setFind] = React.useState("");
  const needle = find.trim().toLowerCase();
  const hit = (...fields: string[]) =>
    needle === "" || fields.some((f) => f.toLowerCase().includes(needle));

  const live = projects.filter((p) => !hidden.has(p.slug));

  /**
   * The tree, filtered.
   *
   * Built as a tree rather than as three filtered lists, because the shape is
   * what makes the filter correct. Drawn flat, a discipline could be kept on
   * its own; nested, it renders inside its page — so filtering the pages
   * independently meant searching "weddings" emptied the whole thing, since
   * no page is called that and the branch it lives on was dropped before its
   * children were ever considered.
   *
   * So a match keeps its ancestors, and it keeps its descendants:
   *
   *   - a page matching by name shows all of its disciplines and their work,
   *     because "sessions" means the sessions, not the word;
   *   - a discipline matching shows all of its work, for the same reason;
   *   - a project matching keeps the discipline and the page above it, or it
   *     would have nowhere to be drawn.
   */
  /** Every discipline name the tree can file something under. */
  const named = new Set(categories.map((c) => c.name));

  const tree = PAGES.map((page) => {
    const pageHit = hit(page.label, page.href);

    const kids = categories
      .filter((c) => c.branch === page.href)
      .map((c) => {
        const catHit = pageHit || hit(c.name, c.slug);
        const work = live.filter(
          (p) => p.category === c.name && (catHit || hit(p.name, p.slug)),
        );
        return { c, work, keep: catHit || work.length > 0 };
      })
      .filter((k) => k.keep);

    /* Work filed under no discipline at all - twenty-one of seventy-three as
       this is written.

       They are not a rounding error and they are not invisible on the site:
       /work lists every project regardless, so these are published, reachable
       and real. What they lack is a discipline, which means they appear on no
       discipline page and in none of the counts the cover index shows.

       The flat sitemap gave them a group of their own because it grouped by
       whatever string it found. A tree drawn only from the known disciplines
       has nowhere to put them, and the first version of this dropped all
       twenty-one without a word - a sitemap that quietly omits a quarter of
       the work is worse than no sitemap. So they get a branch, named for what
       is wrong with them. */
    const orphans =
      page.href === "/work"
        ? live.filter(
            (p) => !named.has(p.category) && (pageHit || hit(p.name, p.slug)),
          )
        : [];

    return {
      page,
      kids,
      orphans,
      keep: pageHit || kids.length > 0 || orphans.length > 0,
    };
  }).filter((n) => n.keep);

  const withheld = projects.filter(
    (p) => hidden.has(p.slug) && hit(p.name, p.slug, p.category),
  );

  const total = PAGES.length + categories.length + live.length;
  const showing =
    tree.length +
    tree.reduce((n, t) => n + t.kids.length, 0) +
    tree.reduce(
      (n, t) =>
        n + t.orphans.length + t.kids.reduce((m, k) => m + k.work.length, 0),
      0,
    ) +
    withheld.length;

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

      <input
        type="search"
        value={find}
        onChange={(e) => setFind(e.target.value)}
        placeholder="Find a page, discipline or project"
        aria-label="Filter the sitemap"
        className="mt-3 w-full border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-foreground"
      />

      {needle !== "" ? (
        <p className="label mt-2 flex items-baseline justify-between gap-3 text-muted-foreground">
          <span>
            {showing} of {total}
          </span>
          <button
            type="button"
            onClick={() => setFind("")}
            className="hoverable:hover:text-foreground"
          >
            Clear
          </button>
        </p>
      ) : null}

      {!compact ? (
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
          As the draft would leave it. Dimmed projects are hidden and will not
          be published, linked, or listed in{" "}
          <code className="text-foreground">sitemap.xml</code>.
        </p>
      ) : null}

      {/* Drawn as a tree, because the site is one.
       *
       * This was three flat lists — Pages, then Disciplines, then a grid per
       * discipline — which is accurate and tells you nothing about shape. A
       * discipline is not a sibling of the homepage; it hangs off /work, and
       * the eighteen editorial projects hang off that. Reading it as columns
       * you had to already know the structure to see it.
       *
       * Indentation plus a rule down the left of each nested level, with a
       * tick out to every row. Same device a file browser uses, for the same
       * reason: it is the cheapest way to show containment, and nobody has to
       * be taught it.
       */}
      <div className="mt-6">
        <p className="label pb-2 text-muted-foreground">The site</p>

        <Branch>
          {tree.map(({ page: p, kids, orphans }) => {
            const body = (
              <>
                <span className="flex-1 truncate text-sm">{p.label}</span>
                <span className="label shrink-0 text-muted-foreground">
                  {p.note ?? p.href}
                </span>
              </>
            );

            return (
              <Twig key={p.href}>
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

                {/* The disciplines that live under this page, and the work
                    under each of them. Only rendered where there is
                    something: /studio and /contact have no children, and an
                    empty rule hanging below them would suggest otherwise. */}
                {kids.length || orphans.length ? (
                  <Branch>
                    {kids.map(({ c, work }) => {
                      return (
                        <Twig key={c.slug}>
                          {onGo ? (
                            <button
                              type="button"
                              onClick={() =>
                                onGo(
                                  // Cover art is the exception, and for a
                                  // reason rather than as a special case: it
                                  // is one project holding every release, so
                                  // filtering the list to it lands on a
                                  // single row that tells you nothing. What
                                  // is curated about cover art is which
                                  // releases lead the homepage rack.
                                  c.slug === "coverart" ||
                                    c.slug === "cover-art"
                                    ? { kind: "field", anchor: "coverArt" }
                                    : { kind: "projects", discipline: c.name },
                                )
                              }
                              className={cn(row, "w-full text-left")}
                            >
                              <span className="flex-1 truncate text-sm">
                                {c.name}
                              </span>
                              <span className="label shrink-0 tabular-nums text-muted-foreground">
                                {work.length || "—"}
                              </span>
                            </button>
                          ) : (
                            <Open href={c.href} origin={origin} className={row}>
                              <span className="flex-1 truncate text-sm">
                                {c.name}
                              </span>
                              <span className="label shrink-0 tabular-nums text-muted-foreground">
                                {work.length || "—"}
                              </span>
                            </Open>
                          )}

                          {work.length ? (
                            <div className="border-l border-border pl-4">
                              <Tiles
                                projects={work}
                                origin={origin}
                                onGo={onGo}
                                compact={compact}
                              />
                            </div>
                          ) : null}
                        </Twig>
                      );
                    })}
                    {orphans.length ? (
                      <Twig>
                        {onGo ? (
                          <button
                            type="button"
                            onClick={() =>
                              onGo({ kind: "projects", discipline: "Unfiled" })
                            }
                            className={cn(row, "w-full text-left")}
                          >
                            <span className="flex-1 truncate text-sm text-muted-foreground">
                              Unfiled
                            </span>
                            <span className="label shrink-0 tabular-nums text-muted-foreground">
                              {orphans.length}
                            </span>
                          </button>
                        ) : (
                          <span className={cn(row, "text-muted-foreground")}>
                            <span className="flex-1 truncate text-sm">
                              Unfiled
                            </span>
                            <span className="label shrink-0 tabular-nums">
                              {orphans.length}
                            </span>
                          </span>
                        )}
                        <div className="border-l border-border pl-4">
                          <Tiles
                            projects={orphans}
                            origin={origin}
                            onGo={onGo}
                            compact={compact}
                            dim
                          />
                        </div>
                      </Twig>
                    ) : null}
                  </Branch>
                ) : null}
              </Twig>
            );
          })}
        </Branch>
      </div>

      {needle !== "" && showing === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing matches &ldquo;{find.trim()}&rdquo;.
        </p>
      ) : null}

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

/**
 * One level of nesting: a rule down the left, everything indented past it.
 *
 * The rule is on the container rather than on each row, so it is one
 * continuous line rather than a stack of segments that can disagree by a
 * pixel — and it stops naturally at the last child instead of needing to
 * know which one that is.
 */
function Branch({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col border-l border-border">{children}</ul>;
}

/**
 * A row on a branch, with the tick that joins it to the rule.
 *
 * The tick is a pseudo-element on the list item, drawn at the height of the
 * first line of text rather than at the middle of the item — an item
 * containing a nested branch is tall, and centring the tick on it would put
 * the join halfway down a group instead of beside the row it belongs to.
 */
function Twig({ children }: { children: React.ReactNode }) {
  return (
    <li className="relative pl-4 before:absolute before:left-0 before:top-[0.95rem] before:h-px before:w-3 before:bg-border">
      {children}
    </li>
  );
}

/** One row of the tree, control or link alike. */
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
