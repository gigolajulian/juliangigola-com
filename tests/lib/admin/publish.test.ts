import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Draft } from "@/lib/admin/publish";
import { reply } from "../../backend/fakes";

/* `lib/admin/publish.ts`: the editor reading the repo and committing its
   draft. GitHub's Git Data calls (`commitFiles`, `readFile`) are stood in;
   the contents API is a mocked fetch. A publish must refuse rather than
   overwrite anything that moved in the repo since the page loaded. */

const gh = vi.hoisted(() => ({ readFile: vi.fn(), commitFiles: vi.fn() }));
vi.mock("@/lib/admin/admin-github", async (real) => ({ ...(await real<object>()), ...gh }));
const { loadRepo, publishDraft } = await import("@/lib/admin/publish");

const empty = (): Draft => ({
  hidden: [],
  unlisted: [],
  categories: {},
  frames: {},
  credits: {},
  copy: {},
  order: [],
  covers: {},
  avatars: {},
  slugs: {},
  bts: {},
});
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const site = { featured: ["café"] };
const contents = (sha: string) => reply({ sha, content: b64(JSON.stringify(site)).replace(/(.{60})/g, "$1\n") });

let fetch: ReturnType<typeof vi.fn>;
const removeItem = vi.fn();
beforeEach(() => {
  fetch = vi.fn(async () => contents("sha1"));
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("localStorage", { removeItem });
  gh.readFile.mockReset().mockResolvedValue(null);
  gh.commitFiles.mockReset().mockResolvedValue(undefined);
  removeItem.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("loadRepo", () => {
  it("reads site.json from its wrapped base64 and adopts the repo's project list", async () => {
    gh.readFile.mockResolvedValue(JSON.stringify({ projects: [], trash: [], hidden: ["old"] }));
    const out = await loadRepo("tok", empty());
    expect(out).toMatchObject({ sha: "sha1", content: site });
    expect("repo" in out && out.repo.hidden).toEqual(["old"]);
    expect((fetch.mock.calls[0][1] as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBe("Bearer tok");
  });

  it("forgets a token GitHub rejects, and names a token that cannot see the repo", async () => {
    fetch.mockResolvedValueOnce(reply({ message: "Bad credentials" }, 401));
    expect(await loadRepo("tok", empty())).toEqual({ error: expect.stringContaining("rejected that token") });
    expect(removeItem).toHaveBeenCalledWith("jg-admin-token");
    fetch.mockResolvedValueOnce(reply({}, 404));
    expect(await loadRepo("tok", empty())).toEqual({ error: expect.stringContaining("Contents: read and write") });
    fetch.mockResolvedValueOnce(reply({ message: "slow down" }, 403));
    expect(await loadRepo("tok", empty())).toEqual({ error: "GitHub said 403: slow down" });
  });

  it("says GitHub is unreachable instead of throwing, after its retries", async () => {
    for (let i = 0; i < 3; i++) fetch.mockRejectedValueOnce(new TypeError("offline"));
    expect(await loadRepo("tok", empty())).toEqual({ error: "Could not reach GitHub: TypeError: offline" });
  });
});

describe("publishDraft", () => {
  const args = (over: Partial<Parameters<typeof publishDraft>[0]> = {}) => ({
    token: "tok",
    sha: "sha1",
    draft: site as never,
    manifest: empty(),
    manifestMoved: false,
    baseline: empty(),
    reframed: {},
    bts: {},
    uploads: {},
    onStatus: vi.fn() as (s: unknown) => void,
    ...over,
  });

  it("commits site.json alone when only the content moved, and returns the new sha", async () => {
    fetch.mockResolvedValueOnce(contents("sha1")).mockResolvedValueOnce(contents("sha2"));
    const a = args();
    expect(await publishDraft(a)).toEqual({ sha: "sha2", written: a.baseline });
    const { files, message } = gh.commitFiles.mock.calls[0][0];
    expect(message).toBe("Update site content from /admin");
    expect(files.map((f: { path: string }) => f.path)).toEqual(["content/site.json"]);
    expect(files[0].content).toBe(`${JSON.stringify(site, null, 2)}\n`);
  });

  it("refuses when site.json moved since the page loaded", async () => {
    fetch.mockResolvedValueOnce(contents("other"));
    expect(await publishDraft(args())).toEqual({ error: expect.stringContaining("content changed in the repo") });
    expect(gh.commitFiles).not.toHaveBeenCalled();
  });

  it("refuses when the project list moved since the page loaded", async () => {
    gh.readFile.mockResolvedValue(JSON.stringify({ projects: [], trash: [], hidden: ["someone-else"] }));
    expect(await publishDraft(args({ manifestMoved: true }))).toEqual({ error: expect.stringContaining("project list changed") });
    expect(gh.commitFiles).not.toHaveBeenCalled();
  });

  it("commits both files together, plus only the uploads a gallery still uses", async () => {
    const manifest = { ...empty(), hidden: ["b", "a"] };
    const reframed = { p: ["/work/p/1.jpg"] } as never;
    const uploads = { "public/work/p/1.jpg": { base64: "AAA" }, "public/work/p/dropped.jpg": { base64: "BBB" } };
    const out = await publishDraft(args({ manifestMoved: true, manifest, reframed, uploads }));
    expect("written" in out && out.written.hidden).toEqual(["a", "b"]);
    const { files, message } = gh.commitFiles.mock.calls[0][0];
    expect(message).toBe("Update site content and projects from /admin");
    expect(files.map((f: { path: string; encoding: string }) => [f.path, f.encoding])).toEqual([
      ["content/site.json", "utf-8"],
      ["content/projects.json", "utf-8"],
      ["public/work/p/1.jpg", "base64"],
    ]);
  });

  it("reports progress while committing, and a failed commit as its message", async () => {
    const a = args();
    gh.commitFiles.mockImplementationOnce(async ({ onProgress }) => onProgress(1, 2));
    await publishDraft(a);
    expect(a.onStatus).toHaveBeenCalledWith({ kind: "working", message: "Uploading 1 of 2", done: 1, total: 2 });
    gh.commitFiles.mockRejectedValueOnce(new Error("GitHub said 422"));
    expect(await publishDraft(args())).toEqual({ error: "GitHub said 422" });
  });
});
