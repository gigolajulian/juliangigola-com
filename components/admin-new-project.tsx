"use client";

import * as React from "react";
import { ADDED_PATH, type AddedProject } from "@/lib/added";
import { commitFiles, readFile } from "@/lib/admin-github";
import {
  COVER_WIDTH,
  MAX_WIDTH,
  processImage,
  toSlug,
} from "@/lib/admin-image";
import type { Credit, Frame } from "@/lib/work-types";
import { AdminCredits, tidyCredits } from "@/components/admin-credits";
import { cn } from "@/lib/utils";

/* ── adding a project ─────────────────────────────────────────────
 * Names a shoot, files it under a discipline, and commits the photographs.
 *
 * Everything lands in one commit: the frames under
 * `public/work/<slug>/`, and the entry in `content/projects.json` that
 * points at them. One commit is one build, and — more importantly — the
 * manifest is never in the repo describing files that are not.
 *
 * The frames are resized and re-encoded here, in the browser, to the same
 * 2500px the harvester uses. Uploading originals would mean committing 40MB
 * of camera JPEG per shoot for pixels nothing can show.
 * ─────────────────────────────────────────────────────────────── */

type Status =
  | { kind: "idle" }
  | { kind: "working"; message: string }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

type Staged = {
  file: File;
  /** Filled once processed; `null` while still being read. */
  processed: {
    base64: string;
    width: number;
    height: number;
    color: string;
    bytes: number;
  } | null;
  error?: string;
};

export function AdminNewProject({
  token,
  categories,
  existingSlugs,
}: {
  token: string;
  categories: { slug: string; name: string }[];
  existingSlugs: Set<string>;
}) {
  const [name, setName] = React.useState("");
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [slug, setSlug] = React.useState("");
  const [categorySlug, setCategorySlug] = React.useState(
    categories[0]?.slug ?? "",
  );
  const [credits, setCredits] = React.useState<Credit[]>([]);
  const [staged, setStaged] = React.useState<Staged[]>([]);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });

  // The slug follows the name until it is touched, then stops — otherwise a
  // deliberate slug is silently undone by the next keystroke in the title.
  const onName = (value: string) => {
    setName(value);
    if (!slugEdited) setSlug(toSlug(value));
  };

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const incoming: Staged[] = [...files].map((file) => ({
      file,
      processed: null,
    }));
    setStaged((s) => [...s, ...incoming]);

    // One at a time. Decoding several 50-megapixel files at once is how a
    // browser tab runs out of memory and dies without an error.
    for (const item of incoming) {
      try {
        const processed = await processImage(item.file, MAX_WIDTH);
        setStaged((s) =>
          s.map((x) => (x.file === item.file ? { ...x, processed } : x)),
        );
      } catch (e) {
        setStaged((s) =>
          s.map((x) => (x.file === item.file ? { ...x, error: String(e) } : x)),
        );
      }
    }
  }

  const move = (i: number, delta: number) =>
    setStaged((s) => {
      const next = [...s];
      const j = i + delta;
      if (j < 0 || j >= next.length) return s;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const ready = staged.filter((s) => s.processed && !s.error);
  const stillReading = staged.some((s) => !s.processed && !s.error);

  const slugTaken = existingSlugs.has(slug);
  const canPublish =
    !!name.trim() &&
    /^[a-z0-9][a-z0-9-]*$/.test(slug) &&
    !slugTaken &&
    !!categorySlug &&
    ready.length > 0 &&
    !stillReading &&
    status.kind !== "working";

  async function publish() {
    try {
      setStatus({ kind: "working", message: "Preparing the cover…" });

      // The opening frame again at 600px. Indexes and hover previews show
      // dozens at once; pointing those at the 2500px originals costs
      // megabytes before anything is visible.
      const cover = await processImage(ready[0].file, COVER_WIDTH);

      const dir = `public/work/${slug}`;
      const images: Frame[] = ready.map((item, i) => ({
        src: `/work/${slug}/${String(i + 1).padStart(2, "0")}.jpg`,
        width: item.processed!.width,
        height: item.processed!.height,
        color: item.processed!.color,
        alt: "",
      }));

      const entry: AddedProject = {
        slug,
        name: name.trim(),
        categorySlug,
        credits: tidyCredits(credits),
        cover: {
          src: `/work/${slug}/cover.jpg`,
          width: cover.width,
          height: cover.height,
          color: cover.color,
          alt: "",
        },
        images,
      };

      // Read the manifest at the branch head rather than trusting the copy
      // this page was built with: another project may have been added since,
      // and writing a stale list would delete it.
      setStatus({ kind: "working", message: "Reading the project list…" });
      const current = await readFile(token, ADDED_PATH);
      const parsed = current
        ? (JSON.parse(current) as { projects: AddedProject[] })
        : { projects: [] };
      if (parsed.projects.some((p) => p.slug === slug)) {
        throw new Error(`"${slug}" already exists in the project list.`);
      }
      parsed.projects = [entry, ...parsed.projects];

      const files = [
        ...ready.map((item, i) => ({
          path: `${dir}/${String(i + 1).padStart(2, "0")}.jpg`,
          content: item.processed!.base64,
          encoding: "base64" as const,
        })),
        {
          path: `${dir}/cover.jpg`,
          content: cover.base64,
          encoding: "base64" as const,
        },
        {
          path: ADDED_PATH,
          content: `${JSON.stringify(parsed, null, 2)}\n`,
          encoding: "utf-8" as const,
        },
      ];

      await commitFiles({
        token,
        message: `Add ${entry.name} from /admin`,
        files,
        onProgress: (done, total) =>
          setStatus({
            kind: "working",
            message: `Uploading ${done} of ${total}…`,
          }),
      });

      setStatus({
        kind: "done",
        message: `Committed ${ready.length} frames. The site rebuilds and goes live in a couple of minutes.`,
      });
      setStaged([]);
      setName("");
      setSlug("");
      setSlugEdited(false);
      setCredits([]);
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const totalBytes = ready.reduce((n, s) => n + (s.processed?.bytes ?? 0), 0);

  return (
    <section className="border-t border-border pt-10">
      <h2 className="title">Add a project</h2>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Photographs are resized to {MAX_WIDTH}px and committed with the project
        in one go. The first frame becomes the cover.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Luxe Meets Future"
            className={input}
          />
        </Field>

        <Field
          label="Slug"
          hint={
            slugTaken
              ? "Already used by another project."
              : `/work/${slug || "…"}`
          }
        >
          <input
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(toSlug(e.target.value));
            }}
            placeholder="luxe-meets-future"
            className={cn(input, slugTaken && "border-destructive")}
          />
        </Field>

        <Field label="Discipline">
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className={input}
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Photographs"
          hint={
            ready.length
              ? `${ready.length} ready · ${(totalBytes / 1024 / 1024).toFixed(1)}MB`
              : "JPEG, PNG, WebP or AVIF"
          }
        >
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
            className="label w-full text-muted-foreground file:label file:mr-4 file:border file:border-border file:bg-transparent file:px-4 file:py-2 file:text-foreground"
          />
        </Field>
      </div>

      {staged.length > 0 ? (
        <ol className="mt-8 border-t border-border">
          {staged.map((item, i) => (
            <li
              key={`${item.file.name}-${i}`}
              className="flex items-center gap-4 border-b border-border py-3"
            >
              <span className="label w-8 shrink-0 tabular-nums text-muted-foreground">
                {i === 0 ? "CVR" : String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {item.file.name}
              </span>
              <span className="label shrink-0 text-muted-foreground">
                {item.error
                  ? "failed"
                  : item.processed
                    ? `${item.processed.width}×${item.processed.height} · ${(item.processed.bytes / 1024).toFixed(0)}KB`
                    : "reading…"}
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  className={tiny}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  className={tiny}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setStaged((s) => s.filter((_, j) => j !== i))}
                  className={tiny}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <AdminCredits credits={credits} onChange={setCredits} className="mt-8" />

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={!canPublish}
          onClick={() => void publish()}
          className="label border border-foreground bg-foreground px-6 py-4 text-background press disabled:cursor-not-allowed disabled:opacity-40 hoverable:hover:opacity-90"
        >
          Publish project
        </button>
        {status.kind !== "idle" ? (
          <p
            className={cn(
              "label",
              status.kind === "error"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {status.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

const input =
  "w-full border border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none focus-visible:border-foreground";
const tiny =
  "label border border-border px-2 py-1 text-muted-foreground hoverable:hover:text-foreground";

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
    <label className="block">
      <span className="label block text-muted-foreground">{label}</span>
      <span className="mt-2 block">{children}</span>
      {hint ? (
        <span className="label mt-2 block text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
