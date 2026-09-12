"use client";

import * as React from "react";
import {
  CONTENT_PATH,
  type SiteContent,
  type Testimonial,
} from "@/lib/content";
import { AdminNewProject } from "@/components/admin-new-project";
import { AdminProjects, type AdminProject } from "@/components/admin-projects";
import { AdminSitemap, type SitemapTarget } from "@/components/admin-sitemap";
import { AdminDisciplines } from "@/components/admin-disciplines";
import { AdminPreview } from "@/components/admin-preview";
import { AdminPicker, type PickerItem } from "@/components/admin-picker";
import { AdminTrash } from "@/components/admin-trash";
import { isTextRef, type FrameRef, type TrashedProject } from "@/lib/added";
import { ADDED_PATH } from "@/lib/added";
import { type PendingUpload } from "@/components/admin-frames";
import { projectsFile, type ProjectsFile } from "@/lib/admin-payload";
import { commitFiles, readFile, type CommitFile } from "@/lib/admin-github";
import type { Credit } from "@/lib/work-types";
import { cn } from "@/lib/utils";

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
 * custom domain, so `www.juliangigola.com/admin` serves this page to anyone
 * who asks. See the warning in the README's Hosting section for the fix and
 * for what is actually exposed — which is this UI and published content, not
 * a write path: every commit is authorised by a token that lives in one
 * browser and is never served with the page.
 * ─────────────────────────────────────────────────────────────── */

const REPO = {
  owner: "gigolajulian",
  repo: "juliangigola-com",
  branch: "main",
};
const API = "https://api.github.com";

/**
 * Where the token is kept between visits.
 *
 * `localStorage`, on this device only — it never reaches this site's server
 * (there isn't one) and it is never sent anywhere but api.github.com. Anyone
 * with this browser profile can use it, which is the trade for not having to
 * paste it every time. "Forget token" clears it.
 */
const TOKEN_KEY = "jg-admin-token";

/**
 * The Content form's own sections, in the order they are set.
 *
 * Declared here rather than read off the DOM so the index can be rendered
 * before the form is, and so the numbers in the index and the numbers on the
 * headings cannot drift apart — they come from the same list.
 */
/**
 * The tabs, in two groups.
 *
 * Content used to be one tab holding four sections, with an index above it to
 * get between them. That is two mechanisms doing one job — a tab strip and a
 * section strip, stacked — and it left the widest part of the tool as a long
 * scroll of unrelated forms: the reply-time promise and the session prices
 * have nothing to do with each other and were two screens apart.
 *
 * One tab per area instead, and the index goes: the tabs *are* the index.
 *
 * Grouped because the two halves are different kinds of thing. The first four
 * are pages — a fixed set of fields, edited a few times a year. The last two
 * are the work — seventy-three projects that change constantly. Running all
 * six together would suggest they are the same kind of visit.
 */
const TABS = [
  [
    { id: "home", label: "Home" },
    { id: "sessions", label: "Sessions" },
    { id: "testimonials", label: "Quotes" },
    { id: "contact", label: "Contact" },
  ],
  [
    { id: "disciplines", label: "Disciplines" },
    { id: "projects", label: "Projects" },
  ],
] as const;

type View = (typeof TABS)[number][number]["id"];

/**
 * Which tab a field lives on, so a sitemap row can still reach it.
 *
 * The sitemap sends you to a *field* — "Home" means the selected-work list,
 * not the top of a page — and that field is now behind a tab. So a jump is
 * two moves: switch to the tab that holds it, then scroll to it.
 */
const FIELD_TAB: Record<string, View> = {
  responseTime: "contact",
  bookingUrl: "contact",
  coverSlug: "home",
  featured: "home",
  coverArt: "home",
  sessions: "sessions",
  testimonials: "testimonials",
};

const fromBase64 = (b64: string): string => {
  // The contents API wraps its base64 at 60 characters.
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

type Status =
  | { kind: "idle" }
  /**
   * `done`/`total` where the work is countable, absent where it is not.
   *
   * Committing is measurable — the editor knows how many files it is sending.
   * Reading the repo first, and waiting for Cloudflare afterwards, are not:
   * neither can be asked how far along it is, and inventing a proportion for
   * them would be a lie shaped exactly like the truth.
   */
  | { kind: "working"; message: string; done?: number; total?: number }
  | { kind: "error"; message: string }
  | { kind: "saved"; message: string };

export function AdminEditor({
  initial,
  slugs,
  categories,
  projects,
  initialHidden,
  categoryLinks,
  initialTrash,
  initialRecategorised,
  initialReframed,
  initialRecredited,
  initialOrder,
  initialCovers,
  releases,
  releaseLimit,
}: {
  /** The content as it was at build time — what the live site is serving. */
  initial: SiteContent;
  /** Every project slug, so the cover and featured fields can be checked. */
  slugs: string[];
  /** Disciplines a project can be filed under, sessions included. */
  categories: { slug: string; name: string; group: string }[];
  /** Every project, hidden ones included, for the list and the preview. */
  projects: AdminProject[];
  /** Which slugs the last build was hiding. */
  initialHidden: string[];
  /** Discipline pages, for the sitemap. */
  /** Disciplines for the sitemap, each under the page it hangs off. */
  categoryLinks: {
    slug: string;
    name: string;
    href: string;
    branch: string;
  }[];
  /** Removed projects awaiting their week. */
  initialTrash: TrashedProject[];
  /** Refilings the last build applied, slug → category slug. */
  initialRecategorised: Record<string, string>;
  /** Re-sequenced galleries the last build applied, slug → frames. */
  initialReframed: Record<string, FrameRef[]>;
  /** Rewritten credits the last build applied, slug → list. */
  initialRecredited: Record<string, Credit[]>;
  /** The running order the last build applied, by slug. */
  initialOrder: string[];
  /** Discipline covers the last build applied, category slug to frame path. */
  initialCovers: Record<string, string>;
  /** Every cover-art release, for the homepage rack picker. */
  releases: PickerItem[];
  /** How many of them the homepage rack actually shows. */
  releaseLimit: number;
}) {
  const [token, setToken] = React.useState("");
  const [draft, setDraft] = React.useState<SiteContent>(initial);
  /** The blob SHA of the file being edited. Absent until connected. */
  const [sha, setSha] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [view, setView] = React.useState<View>("home");
  /** Which discipline is expanded in the Disciplines view. */
  const [openDiscipline, setOpenDiscipline] = React.useState<string | null>(
    null,
  );

  const [hidden, setHidden] = React.useState<Set<string>>(
    () => new Set(initialHidden),
  );
  const [trash, setTrash] = React.useState<TrashedProject[]>(initialTrash);
  const [recategorised, setRecategorised] =
    React.useState<Record<string, string>>(initialRecategorised);
  const [reframed, setReframed] =
    React.useState<Record<string, FrameRef[]>>(initialReframed);
  const [recredited, setRecredited] =
    React.useState<Record<string, Credit[]>>(initialRecredited);
  /** The running order of the work, by slug. Partial - see `lib/added.ts`. */
  const [order, setOrder] = React.useState<string[]>(initialOrder);
  /** The photograph standing for each discipline, by category slug. */
  const [covers, setCovers] =
    React.useState<Record<string, string>>(initialCovers);
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
   * Compared against what the page was built with rather than tracked with a
   * flag, so undoing an edit by hand clears the warning instead of leaving it
   * stuck on — a dirty marker that lies is worse than none.
   */
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initial) ||
    [...hidden].sort().join() !== [...initialHidden].sort().join() ||
    JSON.stringify(recategorised) !== JSON.stringify(initialRecategorised) ||
    JSON.stringify(reframed) !== JSON.stringify(initialReframed) ||
    JSON.stringify(recredited) !== JSON.stringify(initialRecredited) ||
    JSON.stringify(order) !== JSON.stringify(initialOrder) ||
    JSON.stringify(covers) !== JSON.stringify(initialCovers);

  /**
   * Where "Open live" points. Read after mount, because the server has no
   * window and guessing the origin would send every link to the wrong host on
   * a preview deployment.
   */
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);

  /**
   * Whether the deploy carrying the last publish has landed.
   *
   * Committing to GitHub and the change being on the site are a couple of
   * minutes apart, and until now the editor said nothing about that gap —
   * "Committed" was the last word, and whether the public site had caught up
   * was something to go and check by hand.
   *
   * `/BUILD_ID` is a file Next emits and the Worker serves as a static asset,
   * so the build the site is running has a name this page can read. Recorded
   * on mount, polled after a publish, and when it differs the deploy has
   * landed. Strictly it means *a* new build is live rather than specifically
   * yours — but the only thing that triggers a build is a commit to `main`,
   * and you just made one.
   *
   * Null where it cannot be read at all. `next dev` does not serve the file,
   * so locally this stays null and the indicator simply never claims to be
   * live, which is better than claiming it wrongly.
   */
  const built = React.useRef<string | null>(null);
  const [live, setLive] = React.useState(false);
  /** Set the moment a publish succeeds, so the wait has something to watch. */
  const [awaitingDeploy, setAwaitingDeploy] = React.useState(false);
  /**
   * Whether this session committed something whose deploy is unconfirmed.
   *
   * Distinct from `live` so the label can stop short of claiming green. If the
   * watch times out, or `/BUILD_ID` cannot be read at all, the honest answer
   * is "committed, and I do not know whether it has landed" — which is what
   * "published" says and what "live" would not.
   */
  const [committed, setCommitted] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    // The effect body only reads; state is set in the callback, after the
    // request comes back, rather than synchronously during the effect.
    void fetch("/BUILD_ID", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .then((id) => {
        if (!cancelled) built.current = id?.trim() ?? null;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Polls for the deploy, and stops as soon as it lands.
   *
   * Ten seconds, because a Cloudflare build is minutes: a tighter loop would
   * be dozens of requests to learn nothing. It gives up after five minutes —
   * a build that has not landed by then has failed or queued, and a bar that
   * sweeps for ever is worse than one that stops and lets you look.
   */
  React.useEffect(() => {
    if (!awaitingDeploy || built.current === null) return;

    const started = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - started > 5 * 60_000) {
        setAwaitingDeploy(false);
        return;
      }
      void fetch("/BUILD_ID", { cache: "no-store" })
        .then((r) => (r.ok ? r.text() : null))
        .then((next) => {
          if (!next || next.trim() === built.current) return;
          built.current = next.trim();
          setLive(true);
          setCommitted(false);
          setAwaitingDeploy(false);
        })
        .catch(() => {});
    }, 10_000);
    return () => window.clearInterval(id);
  }, [awaitingDeploy]);

  const known = React.useMemo(() => new Set(slugs), [slugs]);

  /**
   * The projects in the draft's running order.
   *
   * `projects` arrives in the order the last build published. Dragging one
   * changes `order` in memory, and the view has to redraw from that
   * immediately rather than waiting for a deploy — so the sort happens here,
   * mirroring `byRunningOrder` in `lib/work.ts`.
   *
   * `Infinity` for anything the order does not name, and a stable sort, so
   * the undragged keep the position the manifest gave them.
   */
  const orderedProjects = React.useMemo(() => {
    const rank = new Map(order.map((slug, i) => [slug, i]));
    return [...projects].sort(
      (a, b) => (rank.get(a.slug) ?? Infinity) - (rank.get(b.slug) ?? Infinity),
    );
  }, [projects, order]);

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
    const saved = window.localStorage.getItem(TOKEN_KEY);
    if (saved) void load(saved);
    // Once, on mount — `load` closes over nothing that changes what a stored
    // token should do, and in the deps it would refetch on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headers = (t: string) => ({
    Authorization: `Bearer ${t}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  });

  /** Reads the file as it is in the repo right now, and proves the token works. */
  async function load(t: string) {
    setStatus({ kind: "working", message: "Reading the current content…" });
    try {
      const res = await fetch(
        `${API}/repos/${REPO.owner}/${REPO.repo}/contents/${CONTENT_PATH}?ref=${REPO.branch}`,
        { headers: headers(t), cache: "no-store" },
      );
      const body = await res.json();
      if (!res.ok) {
        // A rejected token is not worth keeping — otherwise every visit
        // retries it and the page looks broken rather than logged out.
        if (res.status === 401) window.localStorage.removeItem(TOKEN_KEY);
        setStatus({
          kind: "error",
          message:
            res.status === 401
              ? "GitHub rejected that token — it has probably expired. Make a new one and paste it in."
              : res.status === 404
                ? "Token is valid but cannot see this repo's contents. It needs Contents: read and write on juliangigola-com."
                : `GitHub said ${res.status}: ${body?.message ?? "unknown error"}`,
        });
        return;
      }

      setSha(body.sha);
      // The repo is the truth, not the build this page shipped with: someone
      // may have published since, and editing the stale copy would revert it.
      setDraft(JSON.parse(fromBase64(body.content)) as SiteContent);
      setToken(t);
      window.localStorage.setItem(TOKEN_KEY, t);
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({
        kind: "error",
        message: `Could not reach GitHub: ${String(e)}`,
      });
    }
  }

  /**
   * Commits the draft — the content, and the hide list if it moved.
   *
   * Both files in one commit, through the Git Data API rather than two
   * Contents-API writes. Hiding a project lives in `projects.json` while
   * everything else lives in `site.json`, and as two commits there is a build
   * in between serving a half-applied draft: the project taken down but still
   * featured on the homepage, or the reverse.
   *
   * The staleness check that the Contents API gave for free is kept by hand —
   * the blob SHA is re-read first, and a publish is refused if the file moved
   * since this page loaded rather than overwriting whatever arrived.
   */
  async function publish() {
    if (!sha) return;
    setStatus({ kind: "working", message: "Checking for newer content…" });
    try {
      const check = await fetch(
        `${API}/repos/${REPO.owner}/${REPO.repo}/contents/${CONTENT_PATH}?ref=${REPO.branch}`,
        { headers: headers(token), cache: "no-store" },
      );
      const checkBody = await check.json();
      if (!check.ok) {
        setStatus({
          kind: "error",
          message: `GitHub said ${check.status}: ${checkBody?.message ?? "unknown error"}`,
        });
        return;
      }
      if (checkBody.sha !== sha) {
        setStatus({
          kind: "error",
          message:
            "The content changed in the repo since this page loaded. Reload to pick up the new version, then redo the edit.",
        });
        return;
      }

      const files: CommitFile[] = [
        {
          path: CONTENT_PATH,
          content: `${JSON.stringify(draft, null, 2)}\n`,
          encoding: "utf-8" as const,
        },
      ];

      const manifestMoved =
        [...hidden].sort().join() !== [...initialHidden].sort().join() ||
        JSON.stringify(recategorised) !==
          JSON.stringify(initialRecategorised) ||
        JSON.stringify(reframed) !== JSON.stringify(initialReframed) ||
        JSON.stringify(recredited) !== JSON.stringify(initialRecredited) ||
        JSON.stringify(order) !== JSON.stringify(initialOrder) ||
        JSON.stringify(covers) !== JSON.stringify(initialCovers);

      if (manifestMoved) {
        setStatus({ kind: "working", message: "Reading the project list…" });
        // Read fresh: a project may have been added or deleted since this page
        // loaded, and writing back a stale list would undo it.
        const current = await readFile(token, ADDED_PATH);
        // Built by `lib/admin-payload.ts`, covered by
        // `scripts/check-payload.mjs`. That is the one part of publishing
        // testable without a token, and the part where a dropped field
        // publishes as "you never made that edit".
        const parsed = projectsFile(
          current ? (JSON.parse(current) as ProjectsFile) : null,
          {
            hidden,
            categories: recategorised,
            frames: reframed,
            credits: recredited,
            order,
            covers,
          },
        );
        files.push({
          path: ADDED_PATH,
          content: `${JSON.stringify(parsed, null, 2)}\n`,
          encoding: "utf-8" as const,
        });
      }

      // The photographs the sequences refer to, in the same commit as the
      // sequences. Only the ones still in a gallery: staging a frame and then
      // taking it out again should not leave the file in the repository.
      const referenced = new Set(
        Object.values(reframed)
          .flat()
          // A passage names no file, so it contributes nothing here.
          .flatMap((f) =>
            isTextRef(f) ? [] : [`public${typeof f === "string" ? f : f.src}`],
          ),
      );
      for (const [path, upload] of Object.entries(uploads)) {
        if (!referenced.has(path)) continue;
        files.push({ path, content: upload.base64, encoding: "base64" });
      }

      setStatus({ kind: "working", message: "Committing…" });
      await commitFiles({
        token,
        message: manifestMoved
          ? "Update site content and projects from /admin"
          : "Update site content from /admin",
        files,
        onProgress: (done, total) =>
          setStatus({
            kind: "working",
            message: `Uploading ${done} of ${total}`,
            done,
            total,
          }),
      });

      // Re-read so a second publish in the same session compares against what
      // is now in the repo rather than against the SHA we just replaced.
      const after = await fetch(
        `${API}/repos/${REPO.owner}/${REPO.repo}/contents/${CONTENT_PATH}?ref=${REPO.branch}`,
        { headers: headers(token), cache: "no-store" },
      );
      setSha((await after.json())?.sha ?? null);

      // A fresh publish is not live yet by definition, whatever the last one
      // was — so the green is dropped before the wait begins.
      setLive(false);
      setCommitted(true);
      setAwaitingDeploy(built.current !== null);
      setStatus({
        kind: "saved",
        message:
          "Committed. The site rebuilds and goes live in a couple of minutes.",
      });
    } catch (e) {
      setStatus({
        kind: "error",
        message:
          e instanceof Error
            ? e.message
            : `Could not reach GitHub: ${String(e)}`,
      });
    }
  }

  const set = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const unknownSlugs = [draft.coverSlug, ...draft.featured].filter(
    (s) => s.trim() !== "" && !known.has(s),
  );

  return (
    /* Three columns from `xl`: the site on the left, the work in the middle,
       the result on the right. Below that they stack in the same order.
       At `2xl` the sitemap shares the slack instead of the middle taking all
       of it. A fixed rail beside a `1fr` centre means every pixel past the
       breakpoint goes to the form — measured at 2000px that was a 1041px
       column of fields next to a sitemap still four thumbnails wide, which is
       the opposite of what the extra width is for. Two flex tracks in a 1:1.6
       ratio grow together, so the map gets wider as the display does; the
       34rem floor is what the fields need before the ratio takes over, and
       the preview stays fixed because it is a picture of a page at a
       plausible width rather than a panel to fill. */
    <div className="mt-10 grid gap-10 xl:min-h-0 xl:flex-1 xl:grid-cols-[17rem_1fr_23rem] 2xl:gap-12 2xl:grid-cols-[1fr_minmax(34rem,1.6fr)_26rem]">
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
      <aside className="min-w-0 xl:min-h-0 xl:overflow-y-auto xl:pb-10">
        <AdminSitemap
          projects={projects.map((p) => ({
            slug: p.slug,
            name: p.name,
            category: p.category,
            cover: p.cover,
          }))}
          hidden={hidden}
          categories={categoryLinks}
          origin={origin}
          onGo={go}
          compact
        />
      </aside>

      <div className="min-w-0 xl:min-h-0 xl:overflow-y-auto xl:pb-10">
        {/* Not a gate any more. The editor used to be hidden entirely until a
            token proved itself, which meant arriving at /admin — or clicking
            a project in the sitemap — showed a read-only index and a password
            box. Everything on this page can be worked out from what the last
            build published, so the form is the page and the token is only
            asked for at the point it is actually needed: the commit. The
            usual visit does not see this at all, because a stored token
            reconnects on mount. */}
        {!sha ? (
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
                  className="block h-full bg-foreground transition-[width] duration-300 ease-out"
                  style={{
                    width: `${Math.round(((status.done ?? 0) / status.total) * 100)}%`,
                  }}
                />
              ) : (
                <span className="sweep block h-full w-1/4 bg-foreground" />
              )}
            </div>
          ) : null}
          <nav
            className="flex items-center gap-3 border-b border-border py-2"
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
                className="flex shrink-0 border border-border p-0.5"
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
            <span className="ml-auto flex items-center gap-3 self-center">
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
                <span
                  aria-hidden
                  className={cn(
                    "block size-1.5 rounded-full",
                    dirty || awaitingDeploy || committed
                      ? "bg-foreground"
                      : "bg-live",
                  )}
                />
                {dirty ? (
                  <span className="text-foreground">unpublished</span>
                ) : awaitingDeploy ? (
                  <span className="text-muted-foreground">
                    published &middot; going live
                  </span>
                ) : committed ? (
                  // The watch gave up, or there was no `/BUILD_ID` to watch.
                  // The commit happened; whether it landed is unknown, and
                  // green would claim otherwise.
                  <span className="text-muted-foreground">published</span>
                ) : (
                  // Nothing pending. Either a deploy was seen landing, or this
                  // page has published nothing — and it was itself served by
                  // the current build, so what is on screen is what the public
                  // site has.
                  <span className="text-live">live</span>
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
                      ? "Nothing to publish — the draft matches the live site"
                      : undefined
                }
                className="label border border-foreground bg-foreground px-4 py-2 text-background press hoverable:hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-50"
              >
                {status.kind === "working" ? "Publishing…" : "Publish"}
              </button>
            </span>
          </nav>
        </div>

        {view === "disciplines" ? (
          <AdminDisciplines
            disciplines={categories}
            /* In the draft's running order, so the list this view drags is
               the list the site will publish — including the projects added
               in this session, which the manifest has never seen. */
            projects={orderedProjects}
            hidden={hidden}
            order={order}
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

        {view === "projects" ? (
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
              onRemoved={setTrash}
              disciplines={categories}
              recategorised={recategorised}
              onRecategorise={(slug, categorySlug) =>
                setRecategorised((r) => ({ ...r, [slug]: categorySlug }))
              }
              reframed={reframed}
              onReframe={(slug, frames) =>
                setReframed((r) => {
                  const next = { ...r };
                  // Dropped rather than stored as null, so a gallery put back
                  // the way it was leaves no entry behind to publish.
                  if (frames) next[slug] = frames;
                  else delete next[slug];
                  return next;
                })
              }
              uploads={uploads}
              onUpload={(added) =>
                setUploads((u) => ({
                  ...u,
                  ...Object.fromEntries(added.map((a) => [a.path, a])),
                }))
              }
              credits={recredited}
              onCredits={(slug, next) =>
                setRecredited((c) => {
                  const copy = { ...c };
                  // Dropped rather than stored empty, so credits put back the
                  // way they were leave no entry behind to publish. An
                  // intentionally empty list is a different thing and is kept.
                  if (next) copy[slug] = next;
                  else delete copy[slug];
                  return copy;
                })
              }
              opened={opened}
              onOpened={setOpened}
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

        {/* One area at a time. Each is its own component rather than a section
            of one long form, so switching tabs is not a scroll and the widest
            column holds only the fields you came for. */}
        {view === "home" ? <HomeFields /> : null}
        {view === "sessions" ? <SessionFields /> : null}
        {view === "testimonials" ? <QuoteFields /> : null}
        {view === "contact" ? <ContactFields /> : null}

        {/* The slug list, shared by every field that takes one, so it has to
            outlive the tab that uses it. */}
        <datalist id="project-slugs">
          {slugs.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        {/* The token and the status line, under every tab. Publish itself is
            up in the app bar; what stays down here is the thing you set once
            and the thing you read after pressing it. */}
        <div className="sticky bottom-0 mt-12 flex flex-wrap items-center gap-4 border-t border-border bg-background py-6">
          {sha ? (
            <>
              <StatusLine status={status} />
              <button
                type="button"
                onClick={() => {
                  window.localStorage.removeItem(TOKEN_KEY);
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
              Arrange anything you like — publishing needs the GitHub token at
              the top of this column, and nothing is committed until then.
            </p>
          )}
        </div>
      </div>

      {/* Sticky, so it stays beside the field being edited on a long form.
          Below `xl` it drops under the form rather than squeezing both. */}
      <aside className="min-w-0 xl:min-h-0 xl:overflow-y-auto xl:pb-10">
        {/* Ordered too: the preview's whole job is to be what publishing
            would produce, and the homepage band it draws is in running
            order. */}
        <AdminPreview
          draft={draft}
          projects={orderedProjects}
          hidden={hidden}
        />
      </aside>
    </div>
  );

  function HomeFields() {
    return (
      <Area title="Homepage">
        <Field
          anchor="coverSlug"
          label="Cover project"
          hint="The photograph that opens the site."
        >
          <input
            type="text"
            list="project-slugs"
            value={draft.coverSlug}
            onChange={(e) => set("coverSlug", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          anchor="featured"
          label="Selected work, in order"
          hint="The cards under the cover, three across. Reorder with the arrows."
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
            emptyNote="Nothing selected — the section is left out of the homepage entirely."
          />
        </Field>

        <Field
          anchor="coverArt"
          label="Cover art on the homepage"
          hint={`Which releases lead the rack, and in what order. The homepage shows ${releaseLimit}; anything you do not pick fills the rest in the order they were delivered, so the grid is always full.`}
        >
          <AdminPicker
            chosen={draft.coverArt}
            items={releases}
            onChange={(next) => set("coverArt", next)}
            limit={releaseLimit}
            addLabel="Add a release"
            searchLabel="Search releases"
            emptyNote={`Nothing picked — the first ${releaseLimit} releases lead, as they always have.`}
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

  function SessionFields() {
    return (
      <Area title="Sessions" anchor="sessions">
        <p className="max-w-prose text-sm text-muted-foreground">
          A price left empty reads as &ldquo;On request&rdquo;, which is honest
          — but a visible number is the single biggest thing that stops a
          session client leaving without enquiring.
        </p>

        {draft.sessions.map((session, i) => (
          <div
            key={session.slug}
            className="flex flex-col gap-4 border-t border-border pt-6"
          >
            <h3 className="font-display text-xl uppercase tracking-[0.02em]">
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

  function QuoteFields() {
    return (
      <Area title="Quotes" anchor="testimonials">
        <p className="max-w-prose text-sm text-muted-foreground">
          The section does not render at all while this is empty, so there is
          never invented praise on the site. A specific detail beats an
          adjective — &ldquo;turned a two-hour window into eighteen usable
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

  function ContactFields() {
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
          hint="The public Google Calendar booking page — calendar.app.google/…, not a share or edit link. Set it and a 'Check availability' button appears across the site; leave it empty and everything falls back to the enquiry form."
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

  function updateTestimonial(i: number, patch: Partial<Testimonial>) {
    set(
      "testimonials",
      draft.testimonials.map((t, j) => (j === i ? { ...t, ...patch } : t)),
    );
  }

  function updateSession(
    i: number,
    patch: Partial<SiteContent["sessions"][number]>,
  ) {
    set(
      "sessions",
      draft.sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );
  }
}

/** Blank lines dropped, so a stray return does not become an empty bullet. */
const splitLines = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const inputClass =
  "w-full border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground focus-visible:border-foreground";

function Connect({
  token,
  setToken,
  onConnect,
  status,
}: {
  token: string;
  setToken: (v: string) => void;
  onConnect: () => void;
  status: Status;
}) {
  return (
    <div className="mt-12 max-w-prose">
      <ol className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <li>
          <span className="text-foreground">1.</span> Open{" "}
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            GitHub&rsquo;s fine-grained token page
          </a>
          .
        </li>
        <li>
          <span className="text-foreground">2.</span> Repository access:{" "}
          <em>Only select repositories</em> &rarr; <code>juliangigola-com</code>
          . Permissions: <em>Contents</em> &rarr; <em>Read and write</em>.
          Nothing else — that is the only thing this page does.
        </li>
        <li>
          <span className="text-foreground">3.</span> Give it an expiry you are
          happy with, then paste it below. It is kept in this browser only, and
          sent only to GitHub.
        </li>
      </ol>

      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onConnect();
        }}
      >
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_…"
          autoComplete="off"
          spellCheck={false}
          aria-label="GitHub token"
          className={cn(inputClass, "font-mono")}
        />
        <button
          type="submit"
          disabled={!token.trim() || status.kind === "working"}
          className="label self-start border border-foreground bg-foreground px-6 py-4 text-background press hoverable:hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          {status.kind === "working" ? "Connecting…" : "Connect"}
        </button>
        <StatusLine status={status} />
      </form>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === "idle") return null;

  return (
    <p
      // Announced, because the outcome of a publish is the whole point and it
      // happens away from where the pointer is.
      role="status"
      className={cn(
        "text-sm",
        status.kind === "error" ? "text-accent" : "text-muted-foreground",
      )}
    >
      {status.message}
      {status.kind === "saved" ? (
        <>
          {" "}
          <a
            // Workers Builds, not GitHub Actions — the workflow file is gone
            // and deploys are driven from the Cloudflare side now.
            href={`https://github.com/${REPO.owner}/${REPO.repo}/commits/${REPO.branch}`}
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            Watch the deploy
          </a>
        </>
      ) : null}
    </p>
  );
}

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
function Area({
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
      <h2 className="font-display border-b border-border pb-3 text-xl uppercase tracking-[0.02em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
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
