"use client";

import * as React from "react";
import Image from "next/image";
import {
  ADDED_PATH,
  TRASH_DAYS,
  type AddedProject,
  type TrashedProject,
} from "@/lib/added";
import {
  commitFiles,
  listDirectory,
  readFile,
  type CommitFile,
} from "@/lib/admin-github";
import { cn } from "@/lib/utils";

/* ── recently deleted ─────────────────────────────────────────────
 * Where removed projects wait.
 *
 * Removing takes the work off the site at once — the entry leaves the
 * manifest, so the route stops being built and every index forgets it — but
 * leaves the photographs in the repository. Recovering is then a matter of
 * moving the entry back, not of finding the originals again.
 *
 * After a week the files go for good. Not on a timer: nothing runs on a
 * schedule on a static site, so the purge happens the next time this page is
 * opened with a working token. "A week" is therefore a floor rather than a
 * deadline, which is the safer direction for the one thing here that cannot
 * be undone.
 * ─────────────────────────────────────────────────────────────── */

type Status =
  | { kind: "idle" }
  | { kind: "working"; message: string }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

const DAY = 24 * 60 * 60 * 1000;

const daysLeft = (deletedAt: string): number =>
  Math.ceil((Date.parse(deletedAt) + TRASH_DAYS * DAY - Date.now()) / DAY);

export function AdminTrash({
  token,
  trash,
  onChanged,
}: {
  token: string;
  trash: TrashedProject[];
  /** Called after any commit, so the page can refresh what it shows. */
  onChanged: (next: TrashedProject[]) => void;
}) {
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const purged = React.useRef(false);

  /** Reads the manifest at the branch head — never the copy this page shipped with. */
  const readManifest = async () => {
    const current = await readFile(token, ADDED_PATH);
    if (!current) throw new Error("Could not read the project list.");
    return JSON.parse(current) as {
      projects: AddedProject[];
      trash?: TrashedProject[];
      hidden?: string[];
    };
  };

  /** Entry back into `projects`; the files never left. */
  async function recover(slug: string) {
    try {
      setStatus({ kind: "working", message: `Recovering ${slug}…` });
      const m = await readManifest();
      const entry = (m.trash ?? []).find((t) => t.slug === slug);
      if (!entry)
        throw new Error(`"${slug}" is no longer in Recently deleted.`);

      const { deletedAt: _deletedAt, ...project } = entry;
      m.projects = [project, ...m.projects];
      m.trash = (m.trash ?? []).filter((t) => t.slug !== slug);

      await commitFiles({
        token,
        message: `Recover ${slug} from /admin`,
        files: [
          {
            path: ADDED_PATH,
            content: `${JSON.stringify(m, null, 2)}\n`,
            encoding: "utf-8",
          },
        ],
      });

      onChanged(m.trash);
      setStatus({
        kind: "done",
        message: `${slug} is back. Live in a couple of minutes.`,
      });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Entry and files, gone.
   *
   * The directory is listed from the repo rather than derived from the entry's
   * frame list: a re-upload or an interrupted commit can leave files the
   * manifest never mentioned, and those would otherwise stay in `public/work/`
   * forever with nothing pointing at them.
   */
  async function destroy(slugs: string[], label: string) {
    setConfirming(null);
    try {
      setStatus({ kind: "working", message: `Reading ${label}…` });
      const m = await readManifest();
      const going = new Set(slugs);
      m.trash = (m.trash ?? []).filter((t) => !going.has(t.slug));

      const files: CommitFile[] = [];
      for (const slug of slugs) {
        setStatus({ kind: "working", message: `Listing ${slug}…` });
        for (const path of await listDirectory(token, `public/work/${slug}`)) {
          files.push({ path, remove: true });
        }
      }
      files.push({
        path: ADDED_PATH,
        content: `${JSON.stringify(m, null, 2)}\n`,
        encoding: "utf-8",
      });

      await commitFiles({
        token,
        message: `Delete ${label} permanently from /admin`,
        files,
        onProgress: (done, total) =>
          setStatus({
            kind: "working",
            message: `Removing ${done} of ${total}…`,
          }),
      });

      onChanged(m.trash);
      setStatus({
        kind: "done",
        message: `Deleted ${label} and ${files.length - 1} files for good.`,
      });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Clears anything past its week, once per visit.
   *
   * This is the whole of the "after a week" promise: there is no scheduler, so
   * the sweep rides on somebody opening the page. Guarded by a ref rather than
   * by state so a re-render cannot start a second commit while the first is in
   * flight.
   */
  React.useEffect(() => {
    if (purged.current) return;
    const expired = trash
      .filter((t) => daysLeft(t.deletedAt) <= 0)
      .map((t) => t.slug);
    if (!expired.length) return;
    purged.current = true;
    void destroy(
      expired,
      `${expired.length} expired ${expired.length === 1 ? "project" : "projects"}`,
    );
    // Once, against the list this page loaded with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!trash.length && status.kind === "idle") return null;

  return (
    <section className="mt-12 border-t border-border pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="title">Recently deleted</h2>
        {trash.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              confirming === "*"
                ? void destroy(
                    trash.map((t) => t.slug),
                    "everything in Recently deleted",
                  )
                : setConfirming("*")
            }
            className={cn(
              "label border px-3 py-2 press",
              confirming === "*"
                ? "border-destructive text-destructive"
                : "border-border text-muted-foreground hoverable:hover:text-destructive",
            )}
          >
            {confirming === "*" ? "Really empty it" : "Empty now"}
          </button>
        ) : null}
      </div>

      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Removed projects are already off the site. Their photographs stay in the
        repository for {TRASH_DAYS} days so they can be brought back, then go
        for good — cleaned up the next time you open this page, since nothing
        runs on a schedule here.
      </p>

      {status.kind !== "idle" ? (
        <p
          className={cn(
            "label mt-4",
            status.kind === "error"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {status.message}
        </p>
      ) : null}

      <ul className="mt-6 border-t border-border">
        {trash.map((t) => {
          const left = daysLeft(t.deletedAt);
          return (
            <li
              key={t.slug}
              className="flex items-center gap-4 border-b border-border py-3"
            >
              <span
                className="relative block h-14 w-11 shrink-0 overflow-hidden opacity-60"
                style={{ backgroundColor: t.cover.color }}
              >
                <Image
                  src={t.cover.src}
                  alt=""
                  fill
                  sizes="44px"
                  loading="lazy"
                  className="object-cover"
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{t.name}</span>
                <span className="label block truncate text-muted-foreground">
                  {t.images.length} frames ·{" "}
                  {left > 0
                    ? `${left} ${left === 1 ? "day" : "days"} left`
                    : "past its week — clearing now"}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void recover(t.slug)}
                  className="label border border-border px-3 py-2 press hoverable:hover:bg-card"
                >
                  Recover
                </button>
                {confirming === t.slug ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void destroy([t.slug], t.name)}
                      className="label border border-destructive px-3 py-2 text-destructive press"
                    >
                      Really delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="label border border-border px-3 py-2 press hoverable:hover:bg-card"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(t.slug)}
                    className="label border border-border px-3 py-2 text-muted-foreground press hoverable:hover:text-destructive"
                  >
                    Delete forever
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
