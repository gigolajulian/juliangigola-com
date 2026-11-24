"use client";

import * as React from "react";
import { type SiteContent } from "@/lib/content";
import { AdminNewProject } from "@/components/admin/admin-new-project";
import { AdminProjects } from "@/components/admin/admin-projects";
import { AdminSitemap, type SitemapTarget } from "@/components/admin/admin-sitemap";
import { AdminDisciplines } from "@/components/admin/admin-disciplines";
import { AdminPreview } from "@/components/admin/admin-preview";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTrash } from "@/components/admin/admin-trash";
import { AdminInbox } from "@/components/admin/admin-inbox";
import { AdminTraffic } from "@/components/admin/admin-traffic";
import { AdminSeo } from "@/components/admin/admin-seo";
import { AdminVideos } from "@/components/admin/admin-videos";
import type { Draft } from "@/lib/admin/publish";
import { ClientFields, ContactFields, CoverArtFields, HomeFields, QuoteFields, SessionFields } from "@/components/admin/editor/fields";
import { type TrashedProject } from "@/lib/work/added";
import type { PendingUpload } from "@/lib/admin/admin-sequence";
import { CreditDesk } from "@/components/admin/admin-credits";
import { byCodeUnit, cn } from "@/lib/utils";
import { FIELD_TAB, TABS, type View } from "@/components/admin/editor/tabs";
import { remapSlugs } from "@/components/admin/editor/remap-slugs";
import { Connect, PublishStatus } from "@/components/admin/editor/connect";
import type { AdminEditorProps, ListDraft, Overrides } from "@/components/admin/editor/props";
import { useDeployWatch } from "@/components/admin/editor/use-deploy-watch";

import { changedSlugs, draftProjects, movedTabs, withListDraft, withProjectOverride, type SetListDraft, type SetOverride } from "@/components/admin/editor/draft";
import { useFoundField } from "@/components/admin/editor/use-found-field";
import { useCreditDesk } from "@/components/admin/editor/use-credit-desk";
import { EditorBar, FullSwitch } from "@/components/admin/editor/chrome";
import { useUnread } from "@/components/admin/editor/use-unread";
import { useFullView, type FullView } from "@/components/admin/editor/use-full-view";
import { useContentSession } from "@/components/admin/editor/use-content-session";
import { EditorStagingProvider, type EditorStaging } from "@/components/admin/editor/editor-context";

/* ── the editor ───────────────────────────────────────────────────
 * Edits `content/site.json` and commits it to the repo. The deploy does the
 * rest, so a save takes a couple of minutes to appear on the live site.
 *
 * Writing is authorised by a GitHub token you make yourself and paste in
 * once. Nothing here checks it — GitHub does, which is the only opinion worth
 * trusting about what a token may do to a repository.
 *
 * Reaching the page is meant to be a separate question, answered by a
 * Cloudflare Access policy rather than by anything here: no password to
 * store, no session to forge, nothing to get wrong.
 *
 * As of 2026-09-12 that policy covers the `workers.dev` hostname and not the
 * custom domain, so `juliangigola.com/admin` serves this page to anyone
 * who asks. See the warning in the README's Hosting section for the fix and
 * for what is actually exposed — which is this UI and published content, not
 * a write path: every commit is authorised by a token that lives in one
 * browser and is never served with the page.
 *
 * The session itself (token, SHA, status, baseline) is `useContentSession`.
 * ─────────────────────────────────────────────────────────────── */

/** The five per-project override maps out of a manifest. */
const overridesOf = (m: Draft): Overrides => ({ categories: m.categories, frames: m.frames, credits: m.credits, copy: m.copy, slugs: m.slugs });

export function AdminEditor({
  initial,
  slugs,
  categories,
  projects,
  categoryLinks,
  initialTrash,
  published,
  releases,
  releaseLimit,
  heroChoices,
  clients,
}: AdminEditorProps) {
  const [draft, setDraft] = React.useState<SiteContent>(initial);
  const [view, setView] = React.useState<View>("home");
  // `?view=projects`: the One Desk's Site links land on their tab. After hydration, so the first paint matches.
  React.useEffect(() => {
    const v = new URLSearchParams(location.search).get("view");
    if (TABS.flat().some((x) => x.id === v)) queueMicrotask(() => setView(v as View));
  }, []);
  const [unread, setUnread] = useUnread();
  const [full, setFull] = useFullView();
  const whole = (which: FullView) => <FullSwitch which={which} full={full} setFull={setFull} />;
  /** Which discipline is expanded in the Disciplines view. */
  const [openDiscipline, setOpenDiscipline] = React.useState<string | null>(
    null,
  );

  /** Hidden and unlisted slugs and BTS, as one draft with one setter (`withListDraft`). */
  const [listDraft, setListDraft] = React.useState<ListDraft>(() => ({
    hidden: new Set(published.hidden),
    unlisted: new Set(published.unlisted),
    bts: published.bts,
  }));
  const { hidden, unlisted, bts } = listDraft;
  const [trash, setTrash] = React.useState<TrashedProject[]>(initialTrash);
  /** The five per-project override maps, as one draft with one setter (`withProjectOverride`). */
  const [overrides, setOverrides] = React.useState<Overrides>(() => overridesOf(published));
  const { categories: recategorised, frames: reframed, credits: recredited, copy: recopied, slugs: reslugged } = overrides;
  /** The running order of the work, by slug. Partial - see `lib/work/added.ts`. */
  const [order, setOrder] = React.useState<string[]>(published.order);
  /** The photograph standing for each discipline, by category slug. */
  const [covers, setCovers] =
    React.useState<Record<string, string>>(published.covers);
  /** A collaborator's profile photograph, by Instagram handle. One person,
      one picture, however many shoots they are credited on. */
  const [avatars, setAvatars] =
    React.useState<Record<string, string>>(published.avatars);
  /**
   * The project whose row is expanded, if any.
   *
   * Held here rather than in `AdminProjects` so the sitemap can open one. The
   * sitemap is the index of the site and is on screen at all times, which
   * makes it the natural way in to a project — clicking a cover there opens
   * that project's row instead of sending you to the published page and
   * abandoning the draft.
   */
  const [opened, setOpened] = React.useState<string | null>(null);
  /** The project open in the page-shaped editor, which replaces the tabs
      and the preview while it is up. */
  const [page, setPage] = React.useState<string | null>(null);
  /** The project list's filter, held here so a discipline row can set it. */
  const [filter, setFilter] = React.useState("");

  /**
   * A Content field the sitemap has asked for, cleared once it is reached.
   *
   * Held as a counter alongside the anchor so clicking the same row twice
   * scrolls twice — an anchor compared by value would look unchanged the
   * second time and do nothing.
   */
  const [wanted, setWanted] = React.useState<{
    anchor: string;
    nonce: number;
  } | null>(null);
  /**
   * Photographs added to a gallery, processed and waiting, by repo path.
   *
   * Held rather than committed, so they land in the same commit as the
   * sequence that refers to them. Two commits would mean a build in between
   * with a manifest naming files the repo does not have — a project rendering
   * holes — and an abandoned draft would leave the files behind for good.
   */
  const [uploads, setUploads] = React.useState<Record<string, PendingUpload>>(
    {},
  );

  /**
   * Whether anything is unpublished.
   *
   * The manifest half of the draft, in the shape the file is written in.
   *
   * One object rather than six loose states, because three separate places
   * need to ask the same question of all six — has the project list moved —
   * and `projectsFile` takes exactly this shape.
   */
  const manifest: Draft = React.useMemo(
    () =>
      remapSlugs(
        {
          // Sorted, so a set's iteration order is not mistaken for an edit.
          hidden: [...hidden].sort(byCodeUnit),
          unlisted: [...unlisted].sort(byCodeUnit),
          categories: recategorised,
          frames: reframed,
          credits: recredited,
          copy: recopied,
          order,
          covers,
          avatars,
          slugs: reslugged,
          bts,
        },
        reslugged,
      ),
    [
      hidden,
      unlisted,
      recategorised,
      reframed,
      recredited,
      recopied,
      reslugged,
      order,
      covers,
      avatars,
      bts,
    ],
  );

  /** One project's hidden, unlisted or BTS entry changed, from the project list. */
  const listEdit: SetListDraft = (kind, slug, next) => setListDraft((d) => withListDraft(d, kind, slug, next));
  /** Photographs processed for a gallery, staged for this publish. */
  const stage = (added: PendingUpload[]) => setUploads((u) => ({ ...u, ...Object.fromEntries(added.map((a) => [a.path, a])) }));

  /**
   * Where "Open live" points. Read after mount, because the server has no
   * window and guessing the origin would send every link to the wrong host on
   * a preview deployment.
   */
  const [origin, setOrigin] = React.useState("");
  // Reading one value off `window` once is what an effect is for, and the
  // alternative — seeding the state from `window` during render — is a
  // hydration mismatch, because the server has no origin to render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setOrigin(window.location.origin), []);

  const { built, awaitingDeploy, setAwaitingDeploy, committed, setCommitted } = useDeployWatch();

  const known = React.useMemo(() => new Set(slugs), [slugs]);

  /** The projects as the draft has them: refiled, and in running order (see `draftProjects`). */
  const orderedProjects = React.useMemo(
    () => draftProjects(projects, order, recategorised, categories, reframed),
    [projects, order, recategorised, categories, reframed],
  );


  /**
   * Sends the editor to a project, from anywhere that can name one.
   *
   * Switches to the Projects view first, because the sitemap is on screen in
   * both and clicking a cover while the content form is showing would open a
   * row nobody can see.
   */
  const go = React.useCallback((target: SitemapTarget) => {
    if (target.kind === "project") {
      setView("projects");
      setFilter("");
      setOpened(target.slug);
      return;
    }
    if (target.kind === "projects") {
      setView("projects");
      setOpened(null);
      // The list already filters on name, slug and discipline, so the
      // discipline's own label is the filter — no second mechanism needed.
      setFilter(target.discipline ?? "");
      return;
    }
    // A field is behind a tab now, so a jump is two moves: switch to the tab
    // that holds it, then scroll to it. Unmapped anchors fall back to Home
    // rather than leaving you on whatever tab you were on, which would look
    // like the click did nothing.
    setView(FIELD_TAB[target.anchor] ?? "home");
    setWanted((w) => ({ anchor: target.anchor, nonce: (w?.nonce ?? 0) + 1 }));
  }, []);

  useFoundField(wanted);

  const { token, setToken, sha, status, baseline, dirty, load, publish, forget } = useContentSession({
    // Sorted, as the manifest is, so a set's iteration order is not mistaken for an edit.
    published: () => ({
      content: initial,
      manifest: { ...published, hidden: [...published.hidden].sort(byCodeUnit), unlisted: [...published.unlisted].sort(byCodeUnit) },
    }),
    draft,
    manifest,
    reframed,
    bts,
    uploads,
    onRepo: (content, repo) => {
      setDraft(content);
      if (!repo) return;
      setListDraft({ hidden: new Set(repo.hidden), unlisted: new Set(repo.unlisted), bts: repo.bts });
      setOverrides(overridesOf(repo));
      setOrder(repo.order);
      setCovers(repo.covers);
      setAvatars(repo.avatars);
    },
    onPublished: (written) => {
      /* The draft takes back what was actually written, so the tidying
         is visible rather than hiding behind a diff that will not clear. */
      setOverrides((o) => ({ ...o, frames: written.frames, credits: written.credits, copy: written.copy, slugs: written.slugs }));
      setListDraft((d) => ({ ...d, bts: written.bts }));
      // A fresh publish is not live yet by definition, whatever the last one
      // was, so the green is dropped before the wait begins.
      setCommitted(true);
      setAwaitingDeploy(built.current !== null);
    },
  });

  /** One project's override changed, from the project list or the page editor. Null from a panel is its draft
      back the way it found it: `withProjectOverride` puts the published override back rather than dropping it,
      so Undo never discards an earlier publish. */
  const override: SetOverride = (kind, slug, next) => setOverrides((o) => withProjectOverride(o, kind, slug, next, baseline.manifest));
  /** The staged photographs and the override setter, for the panels that use them (`useEditorStaging`). */
  const staging: EditorStaging = { uploads, onUpload: stage, onOverride: override };

  /* Julian: which tab holds the change. `dirty` says there is a draft;
     this says where, one field at a time with the same comparison, so a
     draft can be reviewed before it is published without a tour of nine
     tabs. The manifest's fields belong to the two work tabs. */
  const moved = React.useMemo(() => movedTabs(draft, manifest, baseline), [draft, manifest, baseline]);

  /** The rows with unpublished edits, for the Projects filter. */
  const changed = React.useMemo(() => changedSlugs(manifest, baseline), [manifest, baseline]);

  /* A drop in the sitemap: put `from` where `to` is, in the running order.
     The same arithmetic the Disciplines tab does, on the same list — the
     projects as currently displayed, since `order` may name only some of
     them — and written back whole for the same reason it is there. */
  const reorderSlugs = (from: string, to: string) => {
    if (from === to) return;
    const full = orderedProjects.map((p) => p.slug);
    const at = full.indexOf(from);
    const onto = full.indexOf(to);
    if (at === -1 || onto === -1) return;
    full.splice(at, 1);
    full.splice(full.indexOf(to) + (onto > at ? 1 : 0), 0, from);
    setOrder(full);
  };

  const set = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const unknownSlugs = draft.featured.filter(
    (s) => s.trim() !== "" && !known.has(s),
  );

  const desk = useCreditDesk(projects, recredited, avatars, uploads, setAvatars, setUploads);


  /* Three columns from `xl`: the site on the left, the work in the middle,
  the result on the right. Below that they stack in the same order. At `2xl`
  the sitemap shares the slack instead of the middle taking all of it. A
  fixed rail beside a `1fr` centre means every pixel past the breakpoint
  goes to the form — measured at 2000px that was a 1041px column of fields
  next to a sitemap still four thumbnails wide, which is the opposite of
  what the extra width is for. Two flex tracks in a 1:1.6 ratio grow
  together, so the map gets wider as the display does; the 34rem floor is
  what the fields need before the ratio takes over, and the preview stays
  fixed because it is a picture of a page at a plausible width rather than a
  panel to fill. */
  const leadsWide = !page && view === "leads";
  return (
    <EditorStagingProvider value={staging}>
    <CreditDesk value={desk}>
      <div
        className={cn(
          "mt-10 grid gap-10 xl:min-h-0 xl:flex-1 2xl:gap-12",
          // The page editor takes the preview's column as well: it is the
          // preview, of one page, and it wants the width.
          full
            ? // Seen from above: the sitemap and the preview as many covers
              // across as fit. Over the whole window, the site's bar and the
              // page margins included (Julian: see everything).
              "xl:fixed xl:inset-0 xl:z-50 xl:m-0 xl:grid-rows-[minmax(0,1fr)] xl:bg-background xl:px-10 xl:pt-6 xl:grid-cols-1 2xl:grid-cols-1 [&_[data-map-grid]]:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] [&_[data-preview-grid]]:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]"
            : leadsWide
              ? "xl:grid-cols-1 2xl:grid-cols-1"
              : page
              ? "xl:grid-cols-[17rem_1fr] 2xl:grid-cols-[1fr_5fr]"
              : "xl:grid-cols-[17rem_1fr_23rem] 2xl:grid-cols-[1fr_minmax(34rem,1.6fr)_26rem]",
        )}
      >
        {/* Not a tab any more. The sitemap is what the site currently is, which
          is context for every edit rather than a place to go — and it redraws
          as the draft changes, so it doubles as a readout of what hiding
          something will actually do. */}
        {/* Each column its own scroller. Sticky positioning did this job while
          the page scrolled as one document; now the grid is exactly one
          screen tall, so `min-h-0` is what lets a track shrink below its
          content and `overflow-y-auto` is what gives that content somewhere
          to go. Without `min-h-0` a grid track floors at its content height
          and the whole page grows again. */}
        <aside
          aria-label="Site map"
          className={cn(
            "min-w-0 xl:min-h-0 xl:overflow-y-auto xl:pb-10",
            full && full !== "map" && "xl:hidden",
            // The lead desk wants the whole width, and the site map is no context for it.
            leadsWide && "hidden",
          )}
        >
          {whole("map")}
          <AdminSitemap
            projects={orderedProjects.map((p) => ({
              slug: p.slug,
              name: p.name,
              category: p.category,
              cover: p.cover,
            }))}
            hidden={hidden}
            categories={categoryLinks}
            origin={origin}
            onGo={go}
            onReorder={reorderSlugs}
            compact
          />
        </aside>

        <div
          className={cn(
            "min-w-0 xl:min-h-0 xl:overflow-y-auto",
            !leadsWide && "xl:pb-10",
            full && full !== "work" && "xl:hidden",
          )}
        >
          {whole("work")}
          {/* Not a gate any more. The editor used to be hidden entirely until a
            token proved itself, which meant arriving at /admin — or clicking
            a project in the sitemap — showed a read-only index and a password
            box. Everything on this page can be worked out from what the last
            build published, so the form is the page and the token is only
            asked for at the point it is actually needed: the commit. The
            usual visit does not see this at all, because a stored token
            reconnects on mount. */}
          {/* Not on the lead desk: it publishes nothing, and above it the box
            pushed the desk off the screen. */}
          {!sha && !leadsWide ? (
            <Connect
              token={token}
              setToken={setToken}
              onConnect={() => load(token.trim())}
              status={status}
            />
          ) : null}

          {/* Three views over one draft, rather than three pages. Everything the
            tabs switch between edits the same object, and the preview beside
            them reflects all of it — so moving between them never loses work
            and never needs saving first. */}
          {/* Sticky to the top of its own column.
           *
           * The column is a scroller now and the form inside it is long — four
           * sections, a picker, seventy projects — so a tab row that scrolls
           * away takes the only way between views with it, and Publish along
           * with it. Pinned, the two things you always want are always there.
           * `bg-background` is not decoration: without it the form scrolls
           * through the row. */}
          {/* One sticky block, not two stacked ones. Pinning the tabs and the
            index separately means the second has to be offset by the height
            of the first, and that number is a guess about a font — it was 13px
            short, which is 13px of form scrolling through the gap between
            them. Nested inside one pinned container they simply sit together
            and nothing has to be measured. */}
          <EditorBar
            status={status}
            awaitingDeploy={awaitingDeploy}
            view={view}
            setView={setView}
            unread={unread}
            moved={moved}
            dirty={dirty}
            committed={committed}
            sha={sha}
            publish={publish}
          />

          {page
            ? (() => {
                const p = orderedProjects.find((x) => x.slug === page);
                if (!p) return null;
                return (
                  <AdminPage
                    project={p}
                    disciplines={categories}
                    overrides={overrides}
                    onClose={() => {
                      setPage(null);
                      setView("projects");
                      setOpened(p.slug);
                    }}
                  />
                );
              })()
            : null}
          {/* The lead and proofs desks are their own pages since 2026-11-11: Astryx stays out of the editor. */}
          {!page && view === "leads" ? (
            <ul className="grid max-w-md gap-1 py-6">
              {([["Leads", "/admin/leads"], ["Proofs", "/admin/proofs"]] as const).map(([t, href]) => (
                <li key={t}><a href={href} className="flex min-h-[52px] items-center justify-between border-b border-border text-[17px] hoverable:hover:text-accent">{t}<span aria-hidden="true" className="font-mono text-[13px] text-muted-foreground">↗</span></a></li>
              ))}
            </ul>
          ) : null}
          {!page && view === "inbox" ? <AdminInbox onUnread={setUnread} /> : null}
          {!page && view === "traffic" ? <AdminTraffic /> : null}
          {!page && view === "seo" ? <AdminSeo /> : null}

          {!page && view === "coverart" ? <CoverArtFields draft={draft} set={set} releases={releases} /> : null}

          {!page && view === "video" ? (
            <AdminVideos
              videos={draft.videos}
              onChange={(next) => set("videos", next)}
            />
          ) : null}

          {!page && view === "disciplines" ? (
            <AdminDisciplines
              disciplines={categories}
              /* In the draft's running order, so the list this view drags is
               the list the site will publish — including the projects added
               in this session, which the manifest has never seen. */
              projects={orderedProjects}
              hidden={hidden}
              onOrder={setOrder}
              covers={covers}
              onCover={(category, src) =>
                setCovers((c) => {
                  const next = { ...c };
                  // Removed rather than stored as null, so going back to the
                  // derived cover leaves no entry behind to publish.
                  if (src) next[category] = src;
                  else delete next[category];
                  return next;
                })
              }
              opened={openDiscipline}
              onOpened={setOpenDiscipline}
            />
          ) : null}

          {!page && view === "projects" ? (
            <>
              <AdminProjects
                token={token}
                /* The draft's running order, not the build's. The list here
                 and the list in Disciplines are the same list, and showing
                 one in an order the other has already changed is how you
                 stop trusting either. */
                projects={orderedProjects}
                listDraft={listDraft}
                onListDraft={listEdit}
                changed={changed}
                onRemoved={setTrash}
                disciplines={categories}
                overrides={overrides}
                publishedBts={baseline.manifest.bts}
                opened={opened}
                onOpened={setOpened}
                onOpenPage={(slug) => {
                  setOpened(slug);
                  setPage(slug);
                }}
                query={filter}
                onQuery={setFilter}
              />
              <AdminTrash token={token} trash={trash} onChanged={setTrash} />

              {/* Adding a project belongs with the projects, not on every tab.
                Reached only once the token has proved itself against the repo:
                the form commits several files at once, and a rejected token
                halfway through would leave photographs in the branch with no
                manifest pointing at them. */}
              <AdminNewProject
                token={token}
                categories={categories}
                existingSlugs={known}
              />
            </>
          ) : null}

          {/* One area at a time, so switching tabs is not a scroll and the
            widest column holds only the fields you came for. The panels are
            top-level components (components/admin/editor/fields.tsx), so their type
            is stable across renders and the pickers inside keep their state. */}
          {!page && view === "home" ? <HomeFields draft={draft} set={set} releases={releases} releaseLimit={releaseLimit} slugs={slugs} unknownSlugs={unknownSlugs} projects={projects} hidden={hidden} heroChoices={heroChoices} /> : null}
          {!page && view === "clients" ? <ClientFields draft={draft} set={set} clients={clients} /> : null}
          {!page && view === "sessions" ? <SessionFields draft={draft} set={set} /> : null}
          {!page && view === "testimonials" ? <QuoteFields draft={draft} set={set} /> : null}
          {!page && view === "contact" ? <ContactFields draft={draft} set={set} /> : null}

          {/* The slug list, shared by every field that takes one, so it has to
            outlive the tab that uses it. */}
          <datalist id="project-slugs">
            {slugs.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          {/* The token and the status line, under every tab. Publish itself is
            up in the app bar; what stays down here is the thing you set once
            and the thing you read after pressing it. Not on the lead desk:
            nothing there is published, and pinned it covered the open lead. */}
          {leadsWide ? null : (
          <div className="sticky bottom-0 mt-12 flex flex-wrap items-center gap-4 border-t border-border bg-background py-6">
            {sha ? (
              <>
                <PublishStatus status={status} />
                <button
                  type="button"
                  onClick={forget}
                  className="label ml-auto border border-border px-4 py-2 press hoverable:hover:bg-card active:scale-[0.98]"
                >
                  Forget token
                </button>
              </>
            ) : (
              <p className="label max-w-prose text-muted-foreground">
                Arrange anything you like. Publishing needs the GitHub token at
                the top of this column, and nothing is committed until then.
              </p>
            )}
          </div>
          )}
        </div>

        {/* Sticky, so it stays beside the field being edited on a long form.
          Below `xl` it drops under the form rather than squeezing both. */}
        {page || leadsWide ? null : (
          <aside
            aria-label="Preview"
            className={cn(
              "min-w-0 xl:min-h-0 xl:overflow-y-auto xl:pb-10",
              full && full !== "preview" && "xl:hidden",
            )}
          >
            {whole("preview")}
            {/* Ordered too: the preview's whole job is to be what publishing
            would produce, and the homepage band it draws is in running
            order. */}
            <AdminPreview
              draft={draft}
              projects={orderedProjects}
              hidden={hidden}
            />
          </aside>
        )}
      </div>
    </CreditDesk>
    </EditorStagingProvider>
  );

}
