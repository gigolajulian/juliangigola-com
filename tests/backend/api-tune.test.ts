import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/tune/route";

/* /api/tune: the dev server's slider submit. 404 anywhere else; in dev it
   refuses a bad body and writes the panel's values. The file system is a
   fake, so nothing lands in .next. */

const fs = vi.hoisted(() => ({ written: [] as string[] }));
vi.mock("node:fs/promises", () => ({
  readFile: async () => "{}",
  writeFile: async (_: string, data: string) => void fs.written.push(data),
}));

const post = (body: unknown) => POST(new Request("https://juliangigola.com/api/tune", { method: "POST", body: JSON.stringify(body) }));
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/tune", () => {
  it("is 404 outside the dev server", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await post({ title: "warp", values: { a: 1 } })).status).toBe(404);
    expect(fs.written).toEqual([]);
  });

  it("in dev, refuses a body without a title or values", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await post({ values: { a: 1 } })).status).toBe(400);
    expect((await post({ title: "warp" })).status).toBe(400);
    expect(fs.written).toEqual([]);
  });

  it("in dev, keeps the panel's values under its title", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await post({ title: "warp", values: { a: 1 } })).status).toBe(204);
    expect(JSON.parse(fs.written[0]).warp.values).toEqual({ a: 1 });
  });
});
