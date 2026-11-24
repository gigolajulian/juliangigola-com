/* ── reading and publishing the editor's draft ────────────────────
 * The network half of `components/admin/editor/editor.tsx`: read the repo
 * when a token is pasted in, and commit the draft back. The editor keeps
 * its state; these take what they need and return what it should adopt.
 * ─────────────────────────────────────────────────────────────── */

import { CONTENT_PATH, type SiteContent } from "@/lib/content";
import { ADDED_PATH, isTextRef, type FrameRef } from "@/lib/work/added";
import { adoptable, projectsFile, sameJson, type Manifest, type ProjectsFile } from "@/lib/admin/admin-payload";
import { commitFiles, failureMessage, readFile, type CommitFile, TOKEN_STORE, REPO, GITHUB_API } from "@/lib/admin/admin-github";
import type { Bts, Copy, Credit } from "@/lib/work/work-types";

/**
 * The manifest half of the draft, as the editor holds it.
 *
 * `Manifest` in `lib/admin/admin-payload.ts` is loose about what a frame and a
 * credit are: that module deliberately knows only that a sequence is a list,
 * which is what lets the check script run it. Here they are the real things.
 */
export type Draft = Omit<Manifest, "frames" | "credits" | "copy" | "bts"> & {
  frames: Record<string, FrameRef[]>;
  credits: Record<string, Credit[]>;
  copy: Record<string, Copy>;
  bts: Record<string, Bts>;
};

/**
 * `adoptable` taken as the editor's types, the one place the loose manifest is
 * narrowed. Not checked here: `lib/work/added.ts` validates the file at build
 * time, where a bad one fails the deploy (see `adoptable`).
 */
const adoptDraft = (file: ProjectsFile, fallback: Draft): Draft =>
  adoptable(file, fallback) as Draft;

export type Status =
  | { kind: "idle" }
  /**
   * `done`/`total` where the work is countable, absent where it is not.
   *
   * Committing is measurable: the editor knows how many files it is sending.
   * Reading the repo first, and waiting for Cloudflare afterwards, are not:
   * neither can be asked how far along it is, and inventing a proportion for
   * them would be a lie shaped exactly like the truth.
   */
  | { kind: "working"; message: string; done?: number; total?: number }
  | { kind: "error"; message: string }
  | { kind: "saved"; message: string };

const fromBase64 = (b64: string): string => {
  // The contents API wraps its base64 at 60 characters.
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const headers = (t: string) => ({
  Authorization: `Bearer ${t}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

const contentUrl = `${GITHUB_API}/repos/${REPO.owner}/${REPO.repo}/contents/${CONTENT_PATH}?ref=${REPO.branch}`;

/**
 * Reads the content file as it is in the repo right now, and proves the token
 * works. Also reads the project list, adopted against `baseline`; the editor
 * decides whether to take it (only when it has nothing unpublished).
 */
export async function loadRepo(
  t: string,
  baseline: Draft,
): Promise<{ error: string } | { sha: string; content: SiteContent; repo: Draft }> {
  try {
    const res = await fetch(contentUrl, { headers: headers(t), cache: "no-store" });
    if (!res.ok) {
      const message = await failureMessage(res);
      // A rejected token is not worth keeping, otherwise every visit
      // retries it and the page looks broken rather than logged out.
      if (res.status === 401) window.localStorage.removeItem(TOKEN_STORE);
      return {
        error:
          res.status === 401
            ? "GitHub rejected that token. It has probably expired. Make a new one and paste it in."
            : res.status === 404
              ? "Token is valid but cannot see this repo's contents. It needs Contents: read and write on juliangigola-com."
              : `GitHub said ${res.status}: ${message}`,
      };
    }
    const body = (await res.json()) as { content: string; sha: string };

    // The repo is the truth, not the build this page shipped with: someone
    // may have published since, and editing the stale copy would revert it.
    const content = JSON.parse(fromBase64(body.content)) as SiteContent;

    /* The project list, from the repo as well.
     *
     * Only `site.json` was read here, and the other half of the draft
     * (hiding, filing, sequences, credits, the running order, the discipline
     * covers) stayed on whatever the build that served this page was made
     * with. Two consequences, both of which Julian hit. The marker called
     * the gap an unpublished edit, so a page loaded inside the couple of
     * minutes a deploy takes said UNPUBLISHED about work that was already
     * committed. And publishing from that page wrote the stale list back
     * over the fresh one, quietly undoing the previous publish.
     *
     * Read with the same call `publishDraft` uses, and only adopted when
     * there is nothing to lose: an untouched page is being brought up to
     * date, whereas a page with edits on it asked to reconnect would be
     * having them thrown away. */
    const manifestJson = await readFile(t, ADDED_PATH);
    const repo = manifestJson
      ? adoptDraft(JSON.parse(manifestJson) as ProjectsFile, baseline)
      : baseline;

    return { sha: body.sha, content, repo };
  } catch (e) {
    return { error: `Could not reach GitHub: ${String(e)}` };
  }
}

/**
 * Commits the draft: the content, and the hide list if it moved.
 *
 * Both files in one commit, through the Git Data API rather than two
 * Contents-API writes. Hiding a project lives in `projects.json` while
 * everything else lives in `site.json`, and as two commits there is a build
 * in between serving a half-applied draft: the project taken down but still
 * featured on the homepage, or the reverse.
 *
 * The staleness check that the Contents API gave for free is kept by hand:
 * the blob SHA is re-read first, and a publish is refused if the file moved
 * since this page loaded rather than overwriting whatever arrived.
 *
 * Returns the new SHA and the manifest as written, which the editor takes as
 * its new baseline.
 */
export async function publishDraft({
  token,
  sha,
  draft,
  manifest,
  manifestMoved,
  baseline,
  reframed,
  bts,
  uploads,
  onStatus,
}: {
  token: string;
  /** The blob SHA of `site.json` as this page last read it. */
  sha: string;
  draft: SiteContent;
  manifest: Draft;
  manifestMoved: boolean;
  /** The manifest the repo held, as far as this page knows. */
  baseline: Draft;
  reframed: Draft["frames"];
  bts: Draft["bts"];
  /** Staged photographs by repo path. */
  uploads: Record<string, { base64: string }>;
  onStatus: (s: Status) => void;
}): Promise<{ error: string } | { sha: string | null; written: Draft }> {
  onStatus({ kind: "working", message: "Checking for newer content…" });
  try {
    const check = await fetch(contentUrl, { headers: headers(token), cache: "no-store" });
    if (!check.ok) {
      return { error: `GitHub said ${check.status}: ${await failureMessage(check)}` };
    }
    const checkBody = (await check.json()) as { sha: string };
    if (checkBody.sha !== sha) {
      return {
        error:
          "The content changed in the repo since this page loaded. Reload to pick up the new version, then redo the edit.",
      };
    }

    /* The manifest as committed, filled in only if one is written. Left
       as the current baseline otherwise, because a content-only publish
       does not touch the project list. */
    let written: Draft = baseline;

    const files: CommitFile[] = [
      {
        path: CONTENT_PATH,
        content: `${JSON.stringify(draft, null, 2)}\n`,
        encoding: "utf-8" as const,
      },
    ];

    if (manifestMoved) {
      onStatus({ kind: "working", message: "Reading the project list…" });
      // Read fresh: a project may have been added or deleted since this page
      // loaded, and writing back a stale list would undo it.
      const current = await readFile(token, ADDED_PATH);

      /* And the same refusal `site.json` gets above, for the half of the
         draft that lives here.
       *
       * Reading fresh is not enough on its own: `projectsFile` writes this
       * page's whole manifest over whatever it read, so a key this page has
       * never heard of is a key it deletes. That is not hypothetical:
       * `f807362` erased the credits on I WANNA BE A HUMAN and DECOY,
       * committed by hand two commits before, because this page had been
       * open since before them.
       *
       * `loadRepo` already adopts the repo when the page is clean; a page
       * with edits on it cannot, because adopting would throw them away.
       * So it refuses instead. One reload costs a minute. The other way
       * costs work, silently, and nobody finds out until they look at a
       * page that used to name three people. */
      const live = current
        ? adoptDraft(JSON.parse(current) as ProjectsFile, baseline)
        : baseline;
      if (!sameJson(live, baseline)) {
        return {
          error:
            "The project list changed in the repo since this page loaded, so publishing now would undo it. Reload /admin and make the edit again.",
        };
      }
      // Built by `lib/admin/admin-payload.ts`, covered by
      // `scripts/check-payload.mjs`. That is the one part of publishing
      // testable without a token, and the part where a dropped field
      // publishes as "you never made that edit".
      const parsed = projectsFile(
        current ? (JSON.parse(current) as ProjectsFile) : null,
        manifest,
      );
      // What the repo will hold, which is not quite what was asked for:
      // `projectsFile` drops blank passages and empty sequences. Kept, so
      // the baseline is what was actually written rather than what was
      // sent; otherwise a tidied-away passage reads as an edit still
      // waiting to publish, for ever.
      written = adoptDraft(parsed, manifest);
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
      [...Object.values(reframed), ...Object.values(bts).map((b) => b.frames)]
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

    onStatus({ kind: "working", message: "Committing…" });
    await commitFiles({
      token,
      message: manifestMoved
        ? "Update site content and projects from /admin"
        : "Update site content from /admin",
      files,
      onProgress: (done, total) =>
        onStatus({
          kind: "working",
          message: `Uploading ${done} of ${total}`,
          done,
          total,
        }),
    });

    // Re-read so a second publish in the same session compares against what
    // is now in the repo rather than against the SHA we just replaced.
    const after = await fetch(contentUrl, { headers: headers(token), cache: "no-store" });
    return { sha: (await after.json())?.sha ?? null, written };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : `Could not reach GitHub: ${String(e)}`,
    };
  }
}
