"use client";

import * as React from "react";
import {
  CONTENT_PATH,
  type SiteContent,
  type Testimonial,
} from "@/lib/content";
import { AdminNewProject } from "@/components/admin-new-project";
import { AdminProjects, type AdminProject } from "@/components/admin-projects";
import { AdminSitemap } from "@/components/admin-sitemap";
import { AdminPreview } from "@/components/admin-preview";
import { ADDED_PATH } from "@/lib/added";
import { commitFiles, readFile } from "@/lib/admin-github";
import { cn } from "@/lib/utils";

/* ── the editor ───────────────────────────────────────────────────
 * Edits `content/site.json` and commits it to the repo. The deploy does the
 * rest, so a save takes a couple of minutes to appear on the live site.
 *
 * Writing is authorised by a GitHub token you make yourself and paste in
 * once. Nothing here checks it — GitHub does, which is the only opinion worth
 * trusting about what a token may do to a repository.
 *
 * Reaching the page at all is a separate question, and it is no longer this
 * code's to answer: `/admin` sits behind a Cloudflare Access policy, so the
 * request is challenged before the Worker ever runs. There is deliberately no
 * login here — no password to store, no session to forge, and nothing to get
 * wrong. See the Hosting section of the README.
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

/** UTF-8 safe, because the copy is full of em dashes and curly quotes. */
const toBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (b64: string): string => {
  // The contents API wraps its base64 at 60 characters.
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

type Status =
  | { kind: "idle" }
  | { kind: "working"; message: string }
  | { kind: "error"; message: string }
  | { kind: "saved"; message: string };

export function AdminEditor({
  initial,
  slugs,
  categories,
  projects,
  initialHidden,
  categoryLinks,
}: {
  /** The content as it was at build time — what the live site is serving. */
  initial: SiteContent;
  /** Every project slug, so the cover and featured fields can be checked. */
  slugs: string[];
  /** Disciplines a new project can be filed under. */
  categories: { slug: string; name: string }[];
  /** Every project, hidden ones included, for the list and the preview. */
  projects: AdminProject[];
  /** Which slugs the last build was hiding. */
  initialHidden: string[];
  /** Discipline pages, for the sitemap. */
  categoryLinks: { slug: string; name: string; href: string }[];
}) {
  const [token, setToken] = React.useState("");
  const [draft, setDraft] = React.useState<SiteContent>(initial);
  /** The blob SHA of the file being edited. Absent until connected. */
  const [sha, setSha] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [view, setView] = React.useState<"content" | "projects" | "sitemap">(
    "content",
  );

  const [hidden, setHidden] = React.useState<Set<string>>(
    () => new Set(initialHidden),
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
    [...hidden].sort().join() !== [...initialHidden].sort().join();

  /**
   * Where "Open live" points. Read after mount, because the server has no
   * window and guessing the origin would send every link to the wrong host on
   * a preview deployment.
   */
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);

  const known = React.useMemo(() => new Set(slugs), [slugs]);

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

      const files = [
        {
          path: CONTENT_PATH,
          content: `${JSON.stringify(draft, null, 2)}\n`,
          encoding: "utf-8" as const,
        },
      ];

      const hiddenMoved =
        [...hidden].sort().join() !== [...initialHidden].sort().join();

      if (hiddenMoved) {
        setStatus({ kind: "working", message: "Reading the project list…" });
        // Read fresh: a project may have been added or deleted since this page
        // loaded, and writing back a stale list would undo it.
        const current = await readFile(token, ADDED_PATH);
        const parsed = current
          ? (JSON.parse(current) as { projects: unknown[]; hidden?: string[] })
          : { projects: [], hidden: [] };
        parsed.hidden = [...hidden].sort();
        files.push({
          path: ADDED_PATH,
          content: `${JSON.stringify(parsed, null, 2)}\n`,
          encoding: "utf-8" as const,
        });
      }

      setStatus({ kind: "working", message: "Committing…" });
      await commitFiles({
        token,
        message: hiddenMoved
          ? "Update site content and visibility from /admin"
          : "Update site content from /admin",
        files,
      });

      // Re-read so a second publish in the same session compares against what
      // is now in the repo rather than against the SHA we just replaced.
      const after = await fetch(
        `${API}/repos/${REPO.owner}/${REPO.repo}/contents/${CONTENT_PATH}?ref=${REPO.branch}`,
        { headers: headers(token), cache: "no-store" },
      );
      setSha((await after.json())?.sha ?? null);

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

  if (!sha) {
    return (
      <div className="flex flex-col gap-12">
        <Connect
          token={token}
          setToken={setToken}
          onConnect={() => load(token.trim())}
          status={status}
        />

        {/* Shown before connecting, because it needs nothing a token
            protects: it is the site as the last build left it, which is
            exactly the question somebody opening this page usually has.
            Editing is what requires GitHub's permission, not looking. */}
        <AdminSitemap
          projects={projects.map((p) => ({
            slug: p.slug,
            name: p.name,
            category: p.category,
          }))}
          hidden={hidden}
          categories={categoryLinks}
          origin={origin}
        />
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-10 xl:grid-cols-[1fr_24rem] xl:items-start">
      <div className="min-w-0">
        {/* Three views over one draft, rather than three pages. Everything the
            tabs switch between edits the same object, and the preview beside
            them reflects all of it — so moving between them never loses work
            and never needs saving first. */}
        <nav
          className="flex gap-1 border-b border-border"
          aria-label="Editor sections"
        >
          {(["content", "projects", "sitemap"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-current={view === v ? "true" : undefined}
              className={cn(
                "label -mb-px border-b-2 px-4 py-3 capitalize transition-colors duration-200",
                view === v
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hoverable:hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
          {dirty ? (
            <span className="label ml-auto self-center text-muted-foreground">
              unpublished changes
            </span>
          ) : null}
        </nav>

        {view === "projects" ? (
          <AdminProjects
            token={token}
            projects={projects}
            hidden={hidden}
            onHiddenChange={setHidden}
          />
        ) : view === "sitemap" ? (
          <AdminSitemap
            projects={projects.map((p) => ({
              slug: p.slug,
              name: p.name,
              category: p.category,
            }))}
            hidden={hidden}
            categories={categoryLinks}
            origin={origin}
          />
        ) : (
          <ContentForm />
        )}
      </div>

      {/* Sticky, so it stays beside the field being edited on a long form.
          Below `xl` it drops under the form rather than squeezing both. */}
      <aside className="xl:sticky xl:top-28">
        <AdminPreview draft={draft} projects={projects} hidden={hidden} />
      </aside>
    </div>
  );

  function ContentForm() {
    return (
      <div className="mt-10 flex flex-col gap-14">
        <Section title="Contact" number="01">
          <Field
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
        </Section>

        <Section title="Homepage" number="02">
          <Field
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
            label="Selected work, in order"
            hint="One project slug per line. These are the six cards under the cover."
          >
            <textarea
              rows={7}
              value={draft.featured.join("\n")}
              onChange={(e) => set("featured", splitLines(e.target.value))}
              className={cn(inputClass, "font-mono text-xs")}
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
        </Section>

        <Section title="Testimonials" number="03">
          <p className="max-w-prose text-sm text-muted-foreground">
            The section does not render at all while this is empty, so there is
            never invented praise on the site. A specific detail beats an
            adjective — &ldquo;turned a two-hour window into eighteen usable
            frames&rdquo; earns trust, &ldquo;great to work with&rdquo; does
            not. Three to five is the useful range.
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
                onChange={(e) =>
                  updateTestimonial(i, { quote: e.target.value })
                }
                placeholder="What they said"
                className={inputClass}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <input
                  type="text"
                  value={t.name}
                  onChange={(e) =>
                    updateTestimonial(i, { name: e.target.value })
                  }
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
        </Section>

        <Section title="Sessions" number="04">
          <p className="max-w-prose text-sm text-muted-foreground">
            A price left empty reads as &ldquo;On request&rdquo;, which is
            honest — but a visible number is the single biggest thing that stops
            a session client leaving without enquiring.
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
        </Section>

        {/* The slug list, shared by every field that takes one. */}
        <datalist id="project-slugs">
          {slugs.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-border bg-background py-6">
          <button
            type="button"
            onClick={publish}
            disabled={status.kind === "working"}
            className="label border border-foreground bg-foreground px-6 py-4 text-background press hoverable:hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {status.kind === "working" ? "Publishing…" : "Publish"}
          </button>

          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem(TOKEN_KEY);
              setToken("");
              setSha(null);
              setStatus({ kind: "idle" });
            }}
            className="label border border-border px-6 py-4 press hoverable:hover:bg-card active:scale-[0.98]"
          >
            Forget token
          </button>

          <StatusLine status={status} />
        </div>

        {/* Reached only once the token has proved itself against the repo — the
          form commits several files at once, and a rejected token halfway
          through would leave photographs in the branch with no manifest
          pointing at them. */}
        <AdminNewProject
          token={token}
          categories={categories}
          existingSlugs={known}
        />
      </div>
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

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline gap-4 border-b border-border pb-4">
        <span className="label tabular-nums text-muted-foreground">
          {number}
        </span>
        <h2 className="font-display text-2xl uppercase tracking-[0.02em]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
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
