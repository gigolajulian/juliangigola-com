import * as React from "react";
import type { SiteContent } from "@/lib/content";
import { loadRepo, publishDraft, type Draft, type Status } from "@/lib/admin/publish";
import { sameJson } from "@/lib/admin/admin-payload";
import { TOKEN_STORE } from "@/lib/admin/admin-github";
import { localGet, localRemove, localSet } from "@/lib/storage";
import type { Baseline } from "@/components/admin/editor/draft";
import type { PendingUpload } from "@/components/admin/use-sequence";

/* The GitHub session behind the editor (`editor.tsx`): the token, the blob
 * SHA of the content file, the status line, and the baseline the draft is
 * measured against. Reading the repo and publishing to it both go through
 * here; the editor keeps the draft and is handed what to adopt.
 *
 * The token is kept between visits in `localStorage` (`TOKEN_STORE`), on
 * this device only: it never reaches this site's server and is never sent
 * anywhere but api.github.com. Anyone with this browser profile can use it,
 * which is the trade for not having to paste it every time. "Forget token"
 * clears it. */
export function useContentSession({
  published,
  draft,
  manifest,
  reframed,
  bts,
  uploads,
  onRepo,
  onPublished,
}: {
  /** What the build that served the page published: the first baseline. */
  published: () => Baseline;
  /** The content half of the draft. */
  draft: SiteContent;
  /** The manifest half, as it would be written (`remapSlugs`). */
  manifest: Draft;
  /** The draft's sequences and BTS by the slugs the rows wear, for the photographs a publish carries. */
  reframed: Draft["frames"];
  bts: Draft["bts"];
  uploads: Record<string, PendingUpload>;
  /** The repo was read: take its content, and its manifest when there is one to take (nothing unpublished). */
  onRepo: (content: SiteContent, repo: Draft | null) => void;
  /** A publish landed: the manifest as written, which the draft takes back. */
  onPublished: (written: Draft) => void;
}) {
  const [token, setToken] = React.useState("");
  /** The blob SHA of the file being edited. Absent until connected. */
  const [sha, setSha] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });

  /**
   * What the repository holds, as far as this page knows.
   *
   * Seeded from the props, all this page knows before a token is in, which
   * is the build that served it, and then advanced twice: when the token
   * reads the repo, and when a publish makes the repo match the draft.
   *
   * That advancing is the whole fix for a marker that said UNPUBLISHED for
   * ever. Compared against the props alone, a successful publish left it lit:
   * the commit had landed and the draft and the repo agreed, but the build
   * this page shipped with still disagreed, and a publish cannot change that
   * because the deploy is minutes away.
   *
   * The repo is the right baseline in any case: it is what a publish writes
   * to and what the next build is made from, and it is where a publish from
   * another browser shows up.
   */
  const [baseline, setBaseline] = React.useState<Baseline>(published);

  /** Whether the project list has moved: the second file, written only if so. */
  const manifestMoved = !sameJson(manifest, baseline.manifest);

  /**
   * Whether anything is unpublished.
   *
   * Derived by comparing rather than tracked with a flag, so undoing an edit
   * by hand clears the warning instead of leaving it stuck on.
   *
   * Through `sameJson`, not `JSON.stringify`: the draft comes back from the
   * repo with the file's own key order while `lib/content.ts` builds its
   * object field by field, and comparing the two strings called that a change.
   */
  const dirty = manifestMoved || !sameJson(draft, baseline.content);

  // Reconnect on mount if a token is already stored, so the usual visit is a
  // page that is simply ready.
  //
  // The effect body only reads the external system and hands off; every state
  // update happens inside `load`, after the request comes back. Setting state
  // here directly would be a cascading render on every mount, and the token
  // field would flash a value that may already be expired.
  React.useEffect(() => {
    const saved = localGet(TOKEN_STORE);
    if (saved) void load(saved);
    // Once, on mount: `load` closes over nothing that changes what a stored
    // token should do, and in the deps it would refetch on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(t: string) {
    setStatus({ kind: "working", message: "Reading the current content…" });
    const r = await loadRepo(t, baseline.manifest);
    if ("error" in r) return setStatus({ kind: "error", message: r.error });
    setSha(r.sha);
    if (!dirty) {
      onRepo(r.content, r.repo);
      setBaseline({ content: r.content, manifest: r.repo });
    } else {
      // The edits stay, and so does the baseline they are measured against
      // for the project list: only the content half moves.
      onRepo(r.content, null);
      setBaseline((b) => ({ ...b, content: r.content }));
    }
    setToken(t);
    localSet(TOKEN_STORE, t);
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
    onPublished(written);
    setStatus({
      kind: "saved",
      message:
        "Committed. The site rebuilds and goes live in a couple of minutes.",
    });
  }

  /** Drops the stored token and the connection with it. */
  const forget = () => {
    localRemove(TOKEN_STORE);
    setToken("");
    setSha(null);
    setStatus({ kind: "idle" });
  };

  return { token, setToken, sha, status, baseline, dirty, load, publish, forget };
}
