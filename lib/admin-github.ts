/**
 * The GitHub calls `/admin` makes.
 *
 * Split out of the editor because adding a project writes several files at
 * once — a manifest and every photograph in it — and that needs a different
 * API than editing one JSON file does.
 *
 * The Contents API, which the text editor uses, writes one file per request
 * and makes one commit per file. Adding a shoot of twelve frames that way
 * would be thirteen commits and, because every push to `main` builds, thirteen
 * deploys racing each other. The Git Data API below assembles a tree first and
 * lands all of it as a single commit: one push, one build.
 */

export const REPO = {
  owner: "gigolajulian",
  repo: "juliangigola-com",
  branch: "main",
};
const API = "https://api.github.com";

export type CommitFile = {
  /** Repo-relative, e.g. `public/work/new-thing/01.jpg`. */
  path: string;
  /** Raw text, or base64 for binary. */
  content: string;
  encoding: "utf-8" | "base64";
};

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

/**
 * One request, with GitHub's error message surfaced rather than a status code.
 *
 * A 409 here is not a conflict to retry blindly: it means someone — or another
 * tab — moved the branch since this page loaded, and the safe move is to start
 * again from the new head.
 */
async function gh<T>(
  token: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API}/repos/${REPO.owner}/${REPO.repo}${path}`, {
    method: init?.method ?? "GET",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      (body as { message?: string } | null)?.message ?? "unknown error";
    throw new Error(
      res.status === 401
        ? "GitHub rejected the token — it has probably expired."
        : res.status === 403
          ? `GitHub refused: ${detail}. The token needs Contents: read and write on this repo.`
          : `GitHub said ${res.status}: ${detail}`,
    );
  }
  return body as T;
}

/**
 * Writes every file in one commit.
 *
 * `onProgress` exists because uploading a shoot is slow enough that silence
 * reads as a hang — each photograph is a separate blob upload, and a dozen
 * full-size frames is a real wait on a domestic connection.
 */
export async function commitFiles({
  token,
  message,
  files,
  onProgress,
}: {
  token: string;
  message: string;
  files: CommitFile[];
  onProgress?: (done: number, total: number) => void;
}): Promise<{ sha: string }> {
  if (!files.length) throw new Error("Nothing to commit.");

  // Where the branch is *now*, not where it was when the page loaded.
  const ref = await gh<{ object: { sha: string } }>(
    token,
    `/git/ref/heads/${REPO.branch}`,
  );
  const parent = ref.object.sha;
  const base = await gh<{ tree: { sha: string } }>(
    token,
    `/git/commits/${parent}`,
  );

  // Sequential, not parallel. A dozen simultaneous multi-megabyte uploads
  // compete for the same upstream bandwidth and make the progress meaningless;
  // in order, each one finishes before the next starts and the count is true.
  const blobs: string[] = [];
  for (const [i, file] of files.entries()) {
    const blob = await gh<{ sha: string }>(token, "/git/blobs", {
      method: "POST",
      body: { content: file.content, encoding: file.encoding },
    });
    blobs.push(blob.sha);
    onProgress?.(i + 1, files.length);
  }

  const tree = await gh<{ sha: string }>(token, "/git/trees", {
    method: "POST",
    body: {
      // Everything already in the branch stays; this only adds and replaces.
      base_tree: base.tree.sha,
      tree: files.map((file, i) => ({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blobs[i],
      })),
    },
  });

  const commit = await gh<{ sha: string }>(token, "/git/commits", {
    method: "POST",
    body: { message, tree: tree.sha, parents: [parent] },
  });

  // Not forced: if the branch moved while the blobs were uploading, this fails
  // rather than discarding whatever arrived in the meantime.
  await gh(token, `/git/refs/heads/${REPO.branch}`, {
    method: "PATCH",
    body: { sha: commit.sha, force: false },
  });

  return { sha: commit.sha };
}

/** Reads a text file at the branch head. `null` when it does not exist yet. */
export async function readFile(
  token: string,
  path: string,
): Promise<string | null> {
  const res = await fetch(
    `${API}/repos/${REPO.owner}/${REPO.repo}/contents/${path}?ref=${REPO.branch}`,
    { headers: headers(token), cache: "no-store" },
  );
  if (res.status === 404) return null;
  const body = await res.json();
  if (!res.ok)
    throw new Error(
      `GitHub said ${res.status}: ${body?.message ?? "unknown error"}`,
    );

  const binary = atob(String(body.content).replace(/\s/g, ""));
  return new TextDecoder().decode(
    Uint8Array.from(binary, (c) => c.charCodeAt(0)),
  );
}
