"use client";

import * as React from "react";
import { Orb } from "@/components/effects/orb";
import { type SiteContent } from "@/lib/content";
import { AdminNewProject } from "@/components/admin/admin-new-project";
import { AdminProjects } from "@/components/admin/admin-projects";
import { AdminSitemap, type SitemapTarget } from "@/components/admin/admin-sitemap";
import { AdminDisciplines } from "@/components/admin/admin-disciplines";
import { AdminPreview } from "@/components/admin/admin-preview";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTrash } from "@/components/admin/admin-trash";
import { AdminInbox, unreadCount } from "@/components/admin/admin-inbox";
import { AdminTraffic } from "@/components/admin/admin-traffic";
import { AdminSeo } from "@/components/admin/admin-seo";
import { AdminVideos } from "@/components/admin/admin-videos";
import { loadRepo, publishDraft, type Draft, type Status } from "@/lib/admin/publish";
import { ClientFields, ContactFields, CoverArtFields, HomeFields, QuoteFields, SessionFields } from "@/components/admin/admin-fields";
import { isTextRef, type TrashedProject } from "@/lib/work/added";
import { type PendingUpload } from "@/components/admin/admin-frames";
import { CreditDesk, creditBook } from "@/components/admin/admin-credits";
import { sameJson, withOverride } from "@/lib/admin/admin-payload";
import { TOKEN_STORE } from "@/lib/admin/admin-github";
import type { Bts } from "@/lib/work/work-types";
import { byCodeUnit, cn } from "@/lib/utils";
import { FIELD_TAB, TABS, type View } from "@/components/admin/admin-tabs";
import { remapSlugs } from "@/components/admin/admin-remap-slugs";
import { Connect, StatusLine } from "@/components/admin/admin-connect";
import type { AdminEditorProps, Overrides } from "@/components/admin/admin-editor-props";
import { useDeployWatch } from "@/components/admin/use-deploy-watch";

/** The per-project overrides a build applies, one map per kind. */
export type { Overrides };

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
 * ─────────────────────────────────────────────────────────────── */

/* The token is kept between visits in `localStorage` (`TOKEN_STORE`), on
 * this device only: it never reaches this site's server and is never sent
 * anywhere but api.github.com. Anyone with this browser profile can use it,
 * which is the trade for not having to paste it every time. "Forget token"
 * clears it. */


export function AdminEditor({
  initial,
  slugs,
  categories,
  projects,
  initialHidden,
  initialUnlisted,
  categoryLinks,
  initialTrash,
  initialOverrides,
  initialOrder,
  initialCovers,
  initialAvatars,
  initialBts,
  releases,
  releaseLimit,
  heroChoices,
  clients,
}: AdminEditorProps) {
  const [token, setToken] = React.useState("");
  const [draft, setDraft] = React.useState<SiteContent>(initial);
  /** The blob SHA of the file being edited. Absent until connected. */
  const [sha, setSha] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [view, setView] = React.useState<View>("home");
  // `?view=projects`: the One Desk's Site links land on their tab. After hydration, so the first paint matches.
  React.useEffect(() => {
    const v = new URLSearchParams(location.search).get("view");
    if (TABS.flat().some((x) => x.id === v)) queueMicrotask(() => setView(v as View));
  }, []);
  /* Unread enquiries, on the Inbox tab, so a new one is seen from whatever
     tab is open. Asked when the page opens and again whenever the window
     comes back into focus; the Inbox itself keeps it current while open.
     Julian asked. */
  const [unread, setUnread] = React.useState(0);
  React.useEffect(() => {
    const ask = () =>
      void unreadCount().then((n) => {
        if (n !== null) setUnread(n);
      });
    ask();
    window.addEventListener("focus", ask);
    return () => window.removeEventListener("focus", ask);
  }, []);
  /* One column over the whole workbench, the other two out of the way:
     Julian wanted each one full screen, to see it from above. Escape
     brings the three back. */
  const [full, setFull] = React.useState<"map" | "work" | "preview" | null>(
    null,
  );
  React.useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
  /** The switch at the head of a column. Only where there are columns. */
  const whole = (which: "map" | "work" | "preview") => (
    <div className="sticky top-0 z-10 flex justify-end bg-background pb-2 max-xl:hidden">
      <button
        type="button"
        onClick={() => setFull(full === which ? null : which)}
        aria-pressed={full === which}
        className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
      >
        {full === which ? "Close full screen" : "Full screen"}
      </button>
    </div>
  );
  /** Which discipline is expanded in the Disciplines view. */
  const [openDiscipline, setOpenDiscipline] = React.useState<string | null>(
    null,
  );

  const [hidden, setHidden] = React.useState<Set<string>>(
    () => new Set(initialHidden),
  );
  const [unlisted, setUnlisted] = React.useState<Set<string>>(
    () => new Set(initialUnlisted),
  );
  const [trash, setTrash] = React.useState<TrashedProject[]>(initialTrash);
  /** The five per-project override maps, as one state: one setter keyed by kind. */
  const [overrides, setOverrides] = React.useState<Overrides>(initialOverrides);
  const setOverride = <K extends keyof Overrides>(kind: K, next: (now: Overrides[K]) => Overrides[K]) =>
    setOverrides((o) => ({ ...o, [kind]: next(o[kind]) }));
  const { categories: recategorised, frames: reframed, credits: recredited, copy: recopied, slugs: reslugged } = overrides;
  /** The running order of the work, by slug. Partial - see `lib/work/added.ts`. */
  const [order, setOrder] = React.useState<string[]>(initialOrder);
  /** The photograph standing for each discipline, by category slug. */
  const [covers, setCovers] =
    React.useState<Record<string, string>>(initialCovers);
  /** A collaborator's profile photograph, by Instagram handle. One person,
      one picture, however many shoots they are credited on. */
  const [avatars, setAvatars] =
    React.useState<Record<string, string>>(initialAvatars);
  const [bts, setBts] = React.useState<Record<string, Bts>>(initialBts);
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

  /**
   * What the repository holds, as far as this page knows.
   *
   * Seeded from the props — all this page knows before a token is in, which
   * is the build that served it — and then advanced twice: when the token
   * reads the repo, and when a publish makes the repo match the draft.
   *
   * That advancing is the whole fix for a marker that said UNPUBLISHED for
   * ever. It used to compare against the props and nothing else, so a
   * successful publish left it lit: the commit had landed, the draft and the
   * repo agreed, and the only thing that still disagreed was the build this
   * page happened to ship with — which a publish cannot change, because the
   * deploy is minutes away. Reloading in that window did not help either;
   * the new page came from the same stale build. The only way to clear it
   * was to wait for the deploy and reload, and publishing again in the
   * meantime looked like the thing to try.
   *
   * The repo is the right baseline in any case: it is what a publish writes
   * to and what the next build is made from, and it is where a publish from
   * another browser shows up.
   */
  const [baseline, setBaseline] = React.useState<{
    content: SiteContent;
    manifest: Draft;
  }>(() => ({
    content: initial,
    manifest: {
      hidden: [...initialHidden].sort(byCodeUnit),
      unlisted: [...initialUnlisted].sort(byCodeUnit),
      ...initialOverrides,
      order: initialOrder,
      covers: initialCovers,
      avatars: initialAvatars,
      bts: initialBts,
    },
  }));

  /** Whether the project list has moved — the second file, written only if so. */
  const manifestMoved = !sameJson(manifest, baseline.manifest);

  /**
   * Whether anything is unpublished.
   *
   * Derived by comparing rather than tracked with a flag, so undoing an edit
   * by hand clears the warning instead of leaving it stuck on — a dirty
   * marker that lies is worse than none, which is exactly what this became.
   *
   * Through `same`, not `JSON.stringify`: the draft comes back from the repo
   * with the file's own key order while `lib/content.ts` builds its object
   * field by field, and comparing the two strings called that a change.
   */
  const dirty = manifestMoved || !sameJson(draft, baseline.content);

  /* Julian: which tab holds the change. `dirty` says there is a draft;
     this says where, one field at a time with the same comparison, so a
     draft can be reviewed before it is published without a tour of nine
     tabs. The manifest's fields belong to the two work tabs. */
  const moved = React.useMemo(() => {
    const tabs = new Set<View>();
    for (const key of Object.keys(draft) as (keyof SiteContent)[])
      if (!sameJson(draft[key], baseline.content[key]))
        tabs.add(FIELD_TAB[key] ?? "home");
    for (const key of Object.keys(manifest) as (keyof Draft)[])
      if (!sameJson(manifest[key], baseline.manifest[key]))
        tabs.add(key === "order" || key === "covers" ? "disciplines" : "projects");
    return tabs;
  }, [draft, manifest, baseline]);

  /** The rows with unpublished edits, for the Projects filter. */
  const changed = React.useMemo(() => {
    const out = new Set<string>();
    const maps = ["categories", "frames", "credits", "copy", "slugs", "bts"] as const;
    for (const key of maps) {
      const a = manifest[key] as Record<string, unknown>;
      const b = baseline.manifest[key] as Record<string, unknown>;
      for (const slug of new Set([...Object.keys(a), ...Object.keys(b)]))
        if (!sameJson(a[slug], b[slug])) out.add(slug);
    }
    for (const key of ["hidden", "unlisted"] as const) {
      const a = new Set(manifest[key]);
      const b = new Set(baseline.manifest[key]);
      for (const slug of [...a, ...b]) if (a.has(slug) !== b.has(slug)) out.add(slug);
    }
    return out;
  }, [manifest, baseline]);

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

  /**
   * The projects as the draft has them: refiled, and in running order.
   *
   * One derivation, because there were three and they disagreed. `projects`
   * arrives as the last build published it, and the draft can move a project
   * two ways — refiling it into another discipline, and dragging it to another
   * position — so every view that groups or orders projects has to apply both
   * or contradict the ones that do.
   *
   * They did contradict. The select said Editorial while the row beside it
   * said Unfiled; filing a project left the row stale; and the sitemap — whose
   * own job is to show "the draft as it would publish" — kept a refiled
   * project under its old discipline, because it read the server's label. Each
   * was a small lie in a different place and they were all the same bug.
   *
   * Mirrors `relabel`, `withSequence` and `byRunningOrder` in `lib/work/work.ts`:
   * the same operations the build applies, applied here so the editor shows
   * what publishing would produce rather than what the last deploy did.
   */
  const orderedProjects = React.useMemo(() => {
    const rank = new Map(order.map((slug, i) => [slug, i]));
    const named = new Map(categories.map((c) => [c.slug, c.name]));

    return [...projects]
      .map((p) => {
        const filed = recategorised[p.slug] ?? p.categorySlug;
        /* The frame the gallery now opens on.
         *
         * `withSequence` in `lib/work/work.ts` makes the first frame of a
         * resequenced gallery its cover — the card and the discipline are
         * meant to show what you actually opened on. The editor was not
         * applying that half, so dragging a frame to the front changed the
         * published cover and nothing here moved: the sitemap, the project
         * row and the discipline all kept drawing the old opener, which reads
         * as the edit not having taken. */
        const opener = reframed[p.slug]?.flatMap((f) =>
          // A passage is not a photograph, so it cannot be the opener.
          isTextRef(f) ? [] : [typeof f === "string" ? f : f.src],
        )[0];

        if (filed === p.categorySlug && (!opener || opener === p.images[0]))
          return p;

        return {
          ...p,
          categorySlug: filed,
          // "Unfiled" is the same string `app/admin/page.tsx` uses for a
          // project the manifest gives no category at all, so the sitemap can
          // group both kinds under one heading.
          category: named.get(filed) ?? "Unfiled",
          /* Dimensions and mat carried over from the old cover rather than
             looked up. The archive's numbers do not travel to the browser
             (see `app/admin/page.tsx`), every thumbnail in here sits in a
             fixed box under `object-cover`, and the mat is only what shows
             for the instant before the frame paints. The build reads the
             real frame. */
          cover:
            opener && opener !== p.images[0]
              ? { ...p.cover, src: opener }
              : p.cover,
        };
      })
      .sort(
        (a, b) =>
          (rank.get(a.slug) ?? Infinity) - (rank.get(b.slug) ?? Infinity),
      );
  }, [projects, order, recategorised, categories, reframed]);

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

  /**
   * Brings a requested Content field into view.
   *
   * DOM only — nothing here sets state, so it is the kind of work an effect is
   * actually for. After a paint, because switching to the Content view is
   * what renders the field in the first place.
   */
  React.useEffect(() => {
    if (!wanted) return;
    const id = requestAnimationFrame(() => {
      const el = document.getElementById(`field-${wanted.anchor}`);
      if (!el) return;
      // At most one field is ever the one you asked for. The listener below
      // normally clears it, but it is attached to a node React is free to
      // replace, so this is what actually guarantees it.
      document
        .querySelectorAll("[data-found]")
        .forEach((n) => n.removeAttribute("data-found"));
      el.scrollIntoView({ block: "start", behavior: "smooth" });
      // An attribute, not a class. `className` on these elements is React's —
      // it rewrites it on the next render and takes the highlight with it,
      // and arriving from the sitemap re-renders by definition because it
      // changes the tab. React leaves attributes it never set alone.
      //
      // Cleared first so it can fire twice: an animation does not restart
      // because the attribute was set again while it was already there, which
      // is exactly what clicking the same row twice does.
      el.removeAttribute("data-found");
      void el.offsetWidth;
      el.setAttribute("data-found", "");
      el.addEventListener(
        "animationend",
        () => el.removeAttribute("data-found"),
        { once: true },
      );
    });
    return () => cancelAnimationFrame(id);
  }, [wanted]);

  // Reconnect on mount if a token is already stored, so the usual visit is a
  // page that is simply ready.
  //
  // The effect body only reads the external system and hands off; every state
  // update happens inside `load`, after the request comes back. Setting state
  // here directly would be a cascading render on every mount, and the token
  // field would flash a value that may already be expired.
  React.useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_STORE);
    if (saved) void load(saved);
    // Once, on mount — `load` closes over nothing that changes what a stored
    // token should do, and in the deps it would refetch on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function load(t: string) {
    setStatus({ kind: "working", message: "Reading the current content…" });
    const r = await loadRepo(t, baseline.manifest);
    if ("error" in r) return setStatus({ kind: "error", message: r.error });
    setSha(r.sha);
    setDraft(r.content);
    if (!dirty) {
      const repo = r.repo;
      setHidden(new Set(repo.hidden));
      setUnlisted(new Set(repo.unlisted));
      setOverrides({ categories: repo.categories, frames: repo.frames, credits: repo.credits, copy: repo.copy, slugs: repo.slugs });
      setOrder(repo.order);
      setCovers(repo.covers);
      setAvatars(repo.avatars);
      setBts(repo.bts);
      setBaseline({ content: r.content, manifest: repo });
    } else {
      // The edits stay, and so does the baseline they are measured against
      // for the project list: only the content half moves.
      setBaseline((b) => ({ ...b, content: r.content }));
    }
    setToken(t);
    window.localStorage.setItem(TOKEN_STORE, t);
    setStatus({ kind: "idle" });
  }

  /** Commits the draft through `publishDraft`, then takes what was written as the baseline. */
  async function publish() {
    if (!sha) return;
    const r = await publishDraft({
      token,
      sha,
      draft,
      manifest,
      manifestMoved,
      baseline: baseline.manifest,
      reframed,
      bts,
      uploads,
      onStatus: setStatus,
    });
    if ("error" in r) return setStatus({ kind: "error", message: r.error });
    const { written } = r;
    setSha(r.sha);

    /* The repo now matches the draft, so this is the baseline. Without
       this the marker stayed on UNPUBLISHED after a successful publish,
       still comparing against the build that served the page, which the
       publish cannot have changed and which is minutes behind. */
    setBaseline({ content: draft, manifest: written });
    /* And the draft takes back what was actually written, so the tidying
       is visible rather than hiding behind a diff that will not clear. */
    setOverrides((o) => ({ ...o, frames: written.frames, credits: written.credits, copy: written.copy, slugs: written.slugs }));
    setBts(written.bts);

    // A fresh publish is not live yet by definition, whatever the last one
    // was, so the green is dropped before the wait begins.
    setCommitted(true);
    setAwaitingDeploy(built.current !== null);
    setStatus({
      kind: "saved",
      message:
        "Committed. The site rebuilds and goes live in a couple of minutes.",
    });
  }

  const set = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const unknownSlugs = draft.featured.filter(
    (s) => s.trim() !== "" && !known.has(s),
  );

  /* ── the credit desk ────────────────────────────────────────────
     Everyone ever credited, and the faces on file, handed to the credit
     rows wherever they are drawn — the project list, the page editor, the
     new project form. A context, because none of the three panels in
     between has any business carrying it. */
  const people = React.useMemo(
    () =>
      creditBook([
        ...projects.map((p) => recredited[p.slug] ?? p.credits),
        ...Object.values(recredited),
      ]),
    [projects, recredited],
  );
  /* What a circle draws: the picture staged in this session if there is
     one, and otherwise the copy the last build published. */
  const faces = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const [handle, path] of Object.entries(avatars)) {
      out[handle] = uploads[`public${path}`]?.preview ?? path;
    }
    return out;
  }, [avatars, uploads]);
  const desk = React.useMemo(
    () => ({
      people,
      faces,
      onFace: (
        handle: string,
        picture: { base64: string; preview: string; bytes: number } | null,
      ) => {
        const path = `/people/${handle}.jpg`;
        if (!picture) {
          setAvatars((a) => {
            const next = { ...a };
            delete next[handle];
            return next;
          });
          setUploads((u) => {
            const next = { ...u };
            delete next[`public${path}`];
            return next;
          });
          return;
        }
        setUploads((u) => ({
          ...u,
          [`public${path}`]: {
            path: `public${path}`,
            base64: picture.base64,
            preview: picture.preview,
            bytes: picture.bytes,
          },
        }));
        setAvatars((a) => ({ ...a, [handle]: path }));
      },
    }),
    [people, faces],
  );

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
          <div className="sticky top-0 z-20 bg-background">
            {/* The bar, on the edge of the chrome rather than in the flow.
             *
             * Absolutely positioned on the header's own bottom border, the way
             * a browser puts its loading bar on the edge of the toolbar: it
             * appears and disappears without moving a single thing on the page,
             * which a bar occupying a row cannot do — and a form that jumps two
             * pixels every time you publish is worse than no bar at all.
             *
             * Proportional while committing, because that is countable. A sweep
             * while the deploy runs, because it is not: Cloudflare cannot be
             * asked how far along it is, and a bar creeping to 80% of nothing
             * is a lie in the shape of the truth. */}
            {status.kind === "working" || awaitingDeploy ? (
              <div
                role="progressbar"
                aria-label={
                  awaitingDeploy ? "Waiting for the deploy" : "Publishing"
                }
                aria-valuenow={
                  status.kind === "working" && status.total
                    ? status.done
                    : undefined
                }
                aria-valuemax={
                  status.kind === "working" && status.total
                    ? status.total
                    : undefined
                }
                className="pointer-events-none absolute inset-x-0 -bottom-px z-30 h-px overflow-hidden bg-border"
              >
                {status.kind === "working" && status.total ? (
                  <span
                    // `scaleX` from the left rather than `width`: a width
                    // change lays the row out again on every tick, a scale is
                    // a compositor-only move. Linear, because progress is a
                    // constant rate and an ease on it reads as stalling.
                    className="block h-full w-full origin-left bg-foreground transition-transform duration-300 ease-linear"
                    style={{
                      transform: `scaleX(${(status.done ?? 0) / status.total})`,
                    }}
                  />
                ) : (
                  <span className="sweep block h-full w-1/4 bg-foreground" />
                )}
              </div>
            ) : null}
            {/* Wraps, and the publish group never shrinks.
             *
             * This row was one unwrapping line of six shrink-0 tab groups
             * followed by Publish, and Publish is the thing that gave. In the
             * three-column workbench the middle column is 609px at 1440x900
             * and this row wants 691, so the button sat from x=953 to x=1043
             * against a column ending at 961: eighty-two pixels of it outside
             * its own box, clipped, with no scrollbar to reach it. "I make a
             * change and Publish doesn't show up" was exactly that, and the
             * flag beside it was fine all along.
             *
             * Wrapping rather than scrolling the tabs. A scroller hides tabs
             * behind a gesture nobody knows is available; a second line costs
             * 36px on a tool that has the room, and everything stays visible
             * and in the same place. */}
            <nav
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-2"
              aria-label="Editor sections"
            >
              {/* A segmented control rather than three underlined words.
               *
               * These are the three halves of the tool and the one thing you
               * press most, so they get a surface: an underline on a lowercase
               * word reads as a link among links, and at this size the selected
               * one was legible only by a 2px rule. Filled, the current view is
               * obvious from across the desk — which is the same argument the
               * hero index makes for `bg-secondary` on its current row. */}
              {TABS.map((group, g) => (
                <span
                  key={g}
                  className="flex max-w-full flex-wrap border border-border p-0.5"
                >
                  {group.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setView(t.id)}
                      aria-current={view === t.id ? "true" : undefined}
                      className={cn(
                        "label px-3 py-1.5 transition-colors duration-200",
                        view === t.id
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hoverable:hover:bg-card hoverable:hover:text-foreground",
                      )}
                    >
                      {t.label}
                      {t.id === "inbox" && unread > 0 ? (
                        <span className="ml-1.5 inline-block bg-live px-1 tabular-nums text-background">
                          {unread}
                          <span className="sr-only"> unread</span>
                        </span>
                      ) : null}
                      {moved.has(t.id) ? (
                        <span
                          aria-label=", unpublished edits"
                          className="ml-1.5 inline-block h-1 w-1 bg-current align-middle"
                        />
                      ) : null}
                    </button>
                  ))}
                </span>
              ))}
              {/* Publish, where the work is.
               *
               * There is a second one at the foot of the column, and that is the
               * point: the middle column is its own scroller now, so the bottom
               * bar is only sticky to the bottom of a panel you may be nowhere
               * near. An edit made near the top — dragging a frame, refiling a
               * shoot — had no way to be committed without scrolling back down
               * to look for the button.
               *
               * Always present and disabled rather than appearing when it has
               * something to do: a control that materialises shifts the row it is
               * in and has to be noticed before it can be used, whereas a greyed
               * one is a permanent answer to "where do I publish this". The
               * `title` says which of the two reasons it is grey. */}
              {/* `shrink-0`, so if anything in this row has to give it is not
              the one control the row exists for. */}
              <span className="ml-auto flex shrink-0 items-center gap-3 self-center">
                {/* Three states, because there are three.
                 *
                 * "Unpublished" and "live" are not opposites with nothing in
                 * between: committing to GitHub and the change reaching the
                 * public site are a couple of minutes apart, and that gap is
                 * the one the editor used to say nothing about. So the middle
                 * state is its own — published, not yet live — and it is the
                 * one carrying the sweep.
                 *
                 * A dot as well as the words. The state that decides whether
                 * Publish does anything should be readable without reading, and
                 * at `label` size six words of grey text beside a grey button
                 * is not. Green only for live, never for committed: "your work
                 * is safe" and "the world can see it" are different promises
                 * and only one of them is what green means here.
                 *
                 * `aria-live` so the change is announced rather than only
                 * coloured — the whole point of this label is a state change you
                 * are not necessarily watching for. */}
                <span
                  aria-live="polite"
                  className="label flex items-center gap-2"
                >
                  {/* Julian: a thinking orb while it works, and while
                      the deploy is watched for; the dot otherwise. */}
                  {status.kind === "working" || awaitingDeploy ? (
                    <Orb
                      state={awaitingDeploy ? "searching" : "working"}
                      size={20}
                    />
                  ) : (
                    <span
                      aria-hidden
                      className={cn(
                        "block size-1.5 rounded-full",
                        dirty || committed ? "bg-foreground" : "bg-live",
                      )}
                    />
                  )}
                  {/* Each word is a new node when the state changes, so
                    `emerge` fades it in — "published" is the one completion
                    moment the workbench has, and it used to swap in as text. */}
                  {dirty ? (
                    <span className="emerge text-foreground">unpublished</span>
                  ) : awaitingDeploy ? (
                    <span className="emerge text-muted-foreground">
                      published &middot; going live
                    </span>
                  ) : committed ? (
                    // The watch gave up, or there was no `/BUILD_ID` to watch.
                    // The commit happened; whether it landed is unknown, and
                    // green would claim otherwise.
                    <span className="emerge text-muted-foreground">
                      published
                    </span>
                  ) : (
                    // Nothing pending. Either a deploy was seen landing, or this
                    // page has published nothing — and it was itself served by
                    // the current build, so what is on screen is what the public
                    // site has.
                    <span className="emerge text-live">live</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={publish}
                  disabled={!sha || !dirty || status.kind === "working"}
                  title={
                    !sha
                      ? "Connect the GitHub token at the foot of this column first"
                      : !dirty
                        ? "Nothing to publish: the draft matches the live site"
                        : undefined
                  }
                  className="label border border-foreground bg-foreground px-4 py-2 text-background press hoverable:hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-50"
                >
                  {status.kind === "working" ? "Publishing…" : "Publish"}
                </button>
              </span>
            </nav>
          </div>

          {page
            ? (() => {
                const p = orderedProjects.find((x) => x.slug === page);
                if (!p) return null;
                return (
                  <AdminPage
                    project={p}
                    disciplines={categories}
                    filedAs={recategorised[p.slug] ?? p.categorySlug}
                    onRecategorise={(categorySlug) =>
                      setOverride("categories", (r) => ({
                        ...r,
                        [p.slug]: categorySlug,
                      }))
                    }
                    frames={reframed[p.slug] ?? null}
                    uploads={uploads}
                    onReframe={(next) =>
                      setOverride("frames", (r) =>
                        withOverride(r, p.slug, next, baseline.manifest.frames),
                      )
                    }
                    onUpload={(added) =>
                      setUploads((u) => ({
                        ...u,
                        ...Object.fromEntries(added.map((a) => [a.path, a])),
                      }))
                    }
                    credits={recredited[p.slug] ?? p.credits}
                    onCredits={(next) =>
                      setOverride("credits", (c) =>
                        withOverride(
                          c,
                          p.slug,
                          next,
                          baseline.manifest.credits,
                        ),
                      )
                    }
                    copy={recopied[p.slug] ?? null}
                    onCopy={(next) =>
                      setOverride("copy", (c) =>
                        withOverride(c, p.slug, next, baseline.manifest.copy),
                      )
                    }
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
                hidden={hidden}
                onHiddenChange={setHidden}
                unlisted={unlisted}
                onUnlistedChange={setUnlisted}
                slugs={reslugged}
                changed={changed}
                onSlug={(origin, next) =>
                  setOverride("slugs", (m) => {
                    const out = { ...m };
                    // Back to the original is no rename at all, and leaves
                    // no entry behind to publish.
                    if (next === origin) delete out[origin];
                    else out[origin] = next;
                    return out;
                  })
                }
                onRemoved={setTrash}
                disciplines={categories}
                recategorised={recategorised}
                onRecategorise={(slug, categorySlug) =>
                  setOverride("categories", (r) => ({ ...r, [slug]: categorySlug }))
                }
                reframed={reframed}
                bts={bts}
                publishedBts={baseline.manifest.bts}
                onBts={(slug, next) =>
                  setBts((b) => {
                    const copy = { ...b };
                    // Nothing left to say: no entry, rather than an empty one.
                    if (!next.frames.length && !next.by) delete copy[slug];
                    else copy[slug] = next;
                    return copy;
                  })
                }
                /* `null` is the sequence editor saying the frames are back in
                 the order it found them — which is the published order, and
                 that may itself be an override. `withOverride` puts that
                 back rather than dropping it; see the note there. */
                onReframe={(slug, frames) =>
                  setOverride("frames", (r) =>
                    withOverride(r, slug, frames, baseline.manifest.frames),
                  )
                }
                uploads={uploads}
                onUpload={(added) =>
                  setUploads((u) => ({
                    ...u,
                    ...Object.fromEntries(added.map((a) => [a.path, a])),
                  }))
                }
                credits={recredited}
                /* Same as the sequences: "Undo changes" means back to what is
                 published, and an intentionally empty list is a different
                 thing which `withOverride` keeps. */
                onCredits={(slug, next) =>
                  setOverride("credits", (c) =>
                    withOverride(c, slug, next, baseline.manifest.credits),
                  )
                }
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
            top-level components (components/admin/admin-fields.tsx), so their type
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
                <StatusLine status={status} />
                <button
                  type="button"
                  onClick={() => {
                    window.localStorage.removeItem(TOKEN_STORE);
                    setToken("");
                    setSha(null);
                    setStatus({ kind: "idle" });
                  }}
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
  );

}
