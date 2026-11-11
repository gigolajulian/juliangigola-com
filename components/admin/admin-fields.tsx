"use client";

/* The editor's text panels (home, clients, cover art, sessions, quotes,
   contact), as real components. They read the draft and write through
   `set`, both passed down from AdminEditor. */

import * as React from "react";
import { AdminPicker, type PickerItem } from "@/components/admin/admin-picker";
import type { AdminProject } from "@/components/admin/admin-projects";
import type { SiteContent, Testimonial } from "@/lib/content";

export type FieldsProps = {
  draft: SiteContent;
  set: <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => void;
};

export function ClientFields(p: FieldsProps & { clients: PickerItem[] }) {
  const { draft, set, clients } = p;
  return (
    <Area title="Clients">
      <Field
        anchor="clientsHome"
        label="On the homepage, in order"
        hint="The strip of logos under the cover. Drag to reorder, or use the arrows; remove one to keep it off the homepage only."
      >
        <AdminPicker
          chosen={draft.clientsHome}
          items={clients}
          onChange={(next) => set("clientsHome", next)}
          addLabel="Add a client"
          searchLabel="Search clients"
          emptyNote="Nothing chosen, so the strip shows every client, in the order they are filed."
        />
      </Field>

      <Field
        anchor="clientsStudio"
        label="On the about page, in order"
        hint="The wall of logos on /about. Its own list, so it can differ from the homepage."
      >
        <AdminPicker
          chosen={draft.clientsStudio}
          items={clients}
          onChange={(next) => set("clientsStudio", next)}
          addLabel="Add a client"
          searchLabel="Search clients"
          emptyNote="Nothing chosen, so the wall shows every client, in the order they are filed."
        />
      </Field>
    </Area>
  );
}

/* The gallery's own running order.
 *
 * `lib/cover-art-data.ts` is generated and its order is the script's, so
 * until now the only way to move a release was to edit that script and
 * re-run it. It is an editorial decision — which sleeve the gallery opens
 * on — and it belongs here, on the same picker the homepage rack uses,
 * because it is the same decision in the same shape.
 *
 * Partial: the list names only what has been moved and everything else
 * keeps the place the script gave it, so leading with one release costs
 * one entry rather than a snapshot of all twenty-six. */
export function CoverArtFields(p: FieldsProps & { releases: PickerItem[] }) {
  const { draft, set, releases } = p;
  return (
    <Area title="Cover art">
      <Field
        anchor="coverArtOrder"
        label="The order of the gallery"
        hint={`What /work/coverart shows, from first to last. Drag, or use the arrows. ${releases.length} releases in all; anything you do not place stays where it is, after the ones you do.`}
      >
        <AdminPicker
          chosen={draft.coverArtOrder}
          items={releases}
          onChange={(next) => set("coverArtOrder", next)}
          addLabel="Place a release"
          searchLabel="Search releases"
          emptyNote="Nothing placed, so the gallery runs in the order it was generated in."
          shortfallNote="The rest follow in their own order, after these."
        />
      </Field>
    </Area>
  );
}

export function HomeFields(p: FieldsProps & { releases: PickerItem[]; releaseLimit: number; slugs: string[]; unknownSlugs: string[]; projects: AdminProject[]; hidden: Set<string>; heroChoices: PickerItem[] }) {
  const { draft, set, releases, releaseLimit, slugs, unknownSlugs, projects, hidden, heroChoices } = p;
  return (
    <Area title="Homepage">
      <Field
        anchor="featured"
        label="Selected work, in order"
        hint="The cards under the cover, three across. Drag to reorder, or use the arrows."
      >
        <AdminPicker
          chosen={draft.featured}
          items={projects.map((p) => ({
            slug: p.slug,
            name: p.name,
            detail: p.category,
            cover: { src: p.cover.src, color: p.cover.color },
          }))}
          unavailable={hidden}
          onChange={(next) => set("featured", next)}
          addLabel="Add a project"
          searchLabel="Search projects"
          emptyNote="Nothing selected, so the section is left out of the homepage entirely."
        />
      </Field>

      <Field
        anchor="heroDisciplines"
        label="Disciplines on the cover"
        hint="Which disciplines the cover cycles through, and in what order. Every discipline has a page and a row on /work whether or not it is here. This is only the cover. Pick none and it runs the six it always has."
      >
        <AdminPicker
          chosen={draft.heroDisciplines}
          items={heroChoices}
          onChange={(next) => set("heroDisciplines", next)}
          addLabel="Add a discipline"
          searchLabel="Search disciplines"
          emptyNote="Nothing picked, so the cover runs Editorial, Brand campaigns, Portraits, Mixed media, Artist presskit and Cover art, as it always has."
          /* A warning, not a cap. A seventh row renders perfectly well and
             makes the cover taller than the screen — measured at 1280x700,
             six rows already put both buttons 198px under the fold — which
             is a cost to state rather than a decision to take away. */
          warnAfter={6}
          warnNote="Past six the cover is taller than a 1280x700 screen and the two buttons fall below the fold."
        />
      </Field>

      <Field
        anchor="coverArt"
        label="Cover art on the homepage"
        hint={`Exactly what the homepage rack shows, in this order. Nothing fills in. Up to ${releaseLimit}. The rack runs two across on a phone and, on a wide screen, however many divide your count (five, four or three), so eight, nine and ten all sit in full rows.`}
      >
        <AdminPicker
          chosen={draft.coverArt}
          items={releases}
          onChange={(next) => set("coverArt", next)}
          limit={releaseLimit}
          addLabel="Add a release"
          searchLabel="Search releases"
          emptyNote={`Nothing picked, so the first ${releaseLimit} releases show, as they always have.`}
          shortfallNote="The rest of the rack fills from the remaining releases in order."
        />
      </Field>

      {unknownSlugs.length ? (
        <p className="text-sm text-accent">
          No project with{" "}
          {unknownSlugs.length === 1 ? "this slug" : "these slugs"}:{" "}
          {unknownSlugs.join(", ")}. Anything unmatched is skipped on the
          page.
        </p>
      ) : null}

      <details className="text-sm text-muted-foreground">
        <summary className="label cursor-pointer">
          Every project slug ({slugs.length})
        </summary>
        <p className="mt-3 font-mono text-xs leading-relaxed">
          {slugs.join(" · ")}
        </p>
      </details>
    </Area>
  );
}

export function SessionFields(p: FieldsProps) {
  const { draft, set } = p;
  function updateSession(
    i: number,
    patch: Partial<SiteContent["sessions"][number]>,
  ) {
    set(
      "sessions",
      draft.sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );
  }

  return (
    <Area title="Sessions" anchor="sessions">
      <p className="max-w-prose text-sm text-muted-foreground">
        A price left empty reads as &ldquo;On request&rdquo;, which is honest,
        but a visible number is the single biggest thing that stops a session
        client leaving without inquiring.
      </p>

      {draft.sessions.map((session, i) => (
        <div
          key={session.slug}
          className="flex flex-col gap-4 border-t border-border pt-6"
        >
          <h3 className="font-display text-xl uppercase tracking-[0]">
            {session.name}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Starting price (USD)"
              hint="Empty means “On request”."
            >
              <input
                type="number"
                min={0}
                step={50}
                value={session.from ?? ""}
                onChange={(e) =>
                  updateSession(i, {
                    from:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="On request"
                className={inputClass}
              />
            </Field>
            <Field label="Turnaround">
              <input
                type="text"
                value={session.turnaround}
                onChange={(e) =>
                  updateSession(i, { turnaround: e.target.value })
                }
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Blurb">
            <textarea
              rows={2}
              value={session.blurb}
              onChange={(e) => updateSession(i, { blurb: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="What's included" hint="One per line.">
            <textarea
              rows={4}
              value={session.includes.join("\n")}
              onChange={(e) =>
                updateSession(i, { includes: splitLines(e.target.value) })
              }
              className={inputClass}
            />
          </Field>
        </div>
      ))}
    </Area>
  );
}

export function QuoteFields(p: FieldsProps) {
  const { draft, set } = p;
  function updateTestimonial(i: number, patch: Partial<Testimonial>) {
    set(
      "testimonials",
      draft.testimonials.map((t, j) => (j === i ? { ...t, ...patch } : t)),
    );
  }

  return (
    <Area title="Quotes" anchor="testimonials">
      <p className="max-w-prose text-sm text-muted-foreground">
        The section does not render at all while this is empty, so there is
        never invented praise on the site. A specific detail beats an
        adjective: &ldquo;turned a two-hour window into eighteen usable
        frames&rdquo; earns trust, &ldquo;great to work with&rdquo; does not.
        Three to five is the useful range.
      </p>

      {draft.testimonials.map((t, i) => (
        <div
          key={i}
          className="flex flex-col gap-4 border-t border-border pt-6"
        >
          <div className="flex items-baseline justify-between gap-4">
            <span className="label text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() =>
                set(
                  "testimonials",
                  draft.testimonials.filter((_, j) => j !== i),
                )
              }
              className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-accent"
            >
              Remove
            </button>
          </div>

          <textarea
            rows={3}
            value={t.quote}
            onChange={(e) => updateTestimonial(i, { quote: e.target.value })}
            placeholder="What they said"
            className={inputClass}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <input
              type="text"
              value={t.name}
              onChange={(e) => updateTestimonial(i, { name: e.target.value })}
              placeholder="Name"
              className={inputClass}
            />
            <input
              type="text"
              value={t.role ?? ""}
              onChange={(e) =>
                updateTestimonial(i, { role: e.target.value || undefined })
              }
              placeholder="Art Director, WIRED"
              className={inputClass}
            />
            <input
              type="text"
              list="project-slugs"
              value={t.project ?? ""}
              onChange={(e) =>
                updateTestimonial(i, {
                  project: e.target.value || undefined,
                })
              }
              placeholder="project slug (optional)"
              className={inputClass}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          set("testimonials", [
            ...draft.testimonials,
            { quote: "", name: "" },
          ])
        }
        className="label self-start border border-border px-5 py-3 press hoverable:hover:bg-card active:scale-[0.98]"
      >
        Add a quote
      </button>
    </Area>
  );
}

export function ContactFields(p: FieldsProps) {
  const { draft, set } = p;
  return (
    <Area title="Contact">
      <Field
        anchor="responseTime"
        label="Reply-time promise"
        hint='Shown beside the contact form as "Replies …". Leave empty to say nothing rather than to promise something you will miss.'
      >
        <input
          type="text"
          value={draft.responseTime ?? ""}
          onChange={(e) => set("responseTime", e.target.value || null)}
          placeholder="within 24 hours"
          className={inputClass}
        />
      </Field>

      <Field
        anchor="bookingUrl"
        label="Booking link"
        hint="The public Google Calendar booking page (calendar.app.google/…), not a share or edit link. Set it and a 'Check availability' button appears across the site; leave it empty and everything falls back to the enquiry form."
      >
        <input
          type="url"
          value={draft.bookingUrl ?? ""}
          onChange={(e) => set("bookingUrl", e.target.value || null)}
          placeholder="https://calendar.app.google/…"
          className={inputClass}
        />
      </Field>
    </Area>
  );
}

/** Blank lines dropped, so a stray return does not become an empty bullet. */
const splitLines = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export const inputClass =
  "w-full border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground focus-visible:border-foreground";

/**
 * One tab's worth of fields, under its own heading.
 *
 * Replaces the numbered `Section` the single Content form used. The numbers
 * were there to be read against an index — "03 Testimonials" told you where
 * you were in a scroll of four — and with a tab per area there is no scroll to
 * be lost in and nothing for a number to count against. The tab is lit; the
 * heading repeats it at reading size, which is how you know the panel
 * switched rather than emptied.
 */
export function Area({
  title,
  children,
  /**
   * Anchor, where the area itself is what a sitemap row points at.
   *
   * Sessions and Quotes have no single field to land on — they are a list of
   * four prices and a list of quotes — so the row points at the area. Home
   * and Contact do not need one: their own fields carry anchors, and landing
   * on the specific field you asked for beats landing on the heading above it.
   */
  anchor,
}: {
  title: string;
  children: React.ReactNode;
  anchor?: string;
}) {
  return (
    <section
      id={anchor ? `field-${anchor}` : undefined}
      className="mt-8 flex scroll-mt-28 flex-col gap-6"
    >
      <h2 className="font-display border-b border-border pb-3 text-xl uppercase tracking-[0]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  /** Anchor, so a sitemap row can send the page to this field. */
  anchor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  anchor?: string;
}) {
  return (
    <label
      id={anchor ? `field-${anchor}` : undefined}
      className="flex scroll-mt-28 flex-col gap-2"
    >
      <span className="label text-muted-foreground">{label}</span>
      {hint ? (
        <span className="max-w-prose text-sm text-muted-foreground">
          {hint}
        </span>
      ) : null}
      {children}
    </label>
  );
}
