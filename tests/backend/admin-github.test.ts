import { afterEach, describe, expect, it, vi } from "vitest";
import { reply } from "./fakes";
import { TOKEN_STORE, credentials, listDirectory, readFile } from "@/lib/admin-github";

/* The GitHub calls /admin makes (`lib/admin-github.ts`), against a stubbed fetch. */

afterEach(() => vi.unstubAllGlobals());

describe("credentials", () => {
  it("prefers a pasted inbox key, else the stored GitHub token, else nothing", () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => stored.get(k) ?? null } });
    expect(credentials("k1")).toEqual({ "x-inbox-key": "k1" });
    expect(credentials("")).toEqual({});
    stored.set(TOKEN_STORE, "ghp_x");
    expect(credentials("")).toEqual({ authorization: "Bearer ghp_x" });
  });
});

describe("listDirectory", () => {
  it("lists only files, and nothing for a missing folder", async () => {
    vi.stubGlobal("fetch", async () => reply([{ type: "file", path: "public/a.jpg" }, { type: "dir", path: "public/x" }]));
    expect(await listDirectory("t", "public")).toEqual(["public/a.jpg"]);
    vi.stubGlobal("fetch", async () => reply({ message: "Not Found" }, 404));
    expect(await listDirectory("t", "nope")).toEqual([]);
  });

  it("surfaces GitHub's message on an error", async () => {
    vi.stubGlobal("fetch", async () => reply({ message: "Bad credentials" }, 401));
    await expect(listDirectory("t", "public")).rejects.toThrow("GitHub said 401: Bad credentials");
  });
});

describe("readFile", () => {
  it("decodes GitHub's wrapped base64 as UTF-8", async () => {
    const b64 = Buffer.from("café ♱\n").toString("base64");
    vi.stubGlobal("fetch", async () => reply({ content: `${b64.slice(0, 4)}\n${b64.slice(4)}` }));
    expect(await readFile("t", "content/site.json")).toBe("café ♱\n");
  });

  it("answers null for a file not there yet", async () => {
    vi.stubGlobal("fetch", async () => reply({}, 404));
    expect(await readFile("t", "content/new.json")).toBeNull();
  });
});
