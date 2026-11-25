import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, getJson, json, NO_STORE, postJson, SMALL_BODY, taken, textOf } from "@/lib/http";

/* `lib/http.ts`: every API answer is uncached and unindexed, and a bad body
   reads as null rather than a throw out of the handler. */

const post = (body: string) => new Request("https://juliangigola.com/api/x", { method: "POST", body });

describe("json", () => {
  it("answers with the body, the status and the no-store headers", async () => {
    const res = json({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    for (const [k, v] of Object.entries(NO_STORE)) expect(res.headers.get(k)).toBe(v);
  });

  it("defaults to 200", () => expect(json(null).status).toBe(200));
});

describe("bodyOf", () => {
  it("reads an object body", async () => expect(await bodyOf(post('{"a":1}'))).toEqual({ a: 1 }));

  it("is null for malformed JSON, a bare value null or an array", async () => {
    for (const b of ["{oops", "3", '"text"', "null", "[1,2]"]) expect(await bodyOf(post(b))).toBeNull();
  });
});

describe("postJson and getJson", () => {
  afterEach(() => vi.unstubAllGlobals());
  const answer = (res: Response | Error) => {
    const f = vi.fn(() => (res instanceof Error ? Promise.reject(res) : Promise.resolve(res)));
    vi.stubGlobal("fetch", f);
    return f;
  };

  it("posts the body as JSON and hands back the parsed answer", async () => {
    const f = answer(Response.json({ id: "b1" }));
    expect(await postJson("/api/x", { a: 1 })).toEqual({ ok: true, status: 200, data: { id: "b1" } });
    expect(f).toHaveBeenCalledWith("/api/x", { method: "POST", headers: { "content-type": "application/json" }, body: '{"a":1}' });
  });

  it("reads a refusal's error and code", async () => {
    answer(taken());
    expect(await getJson("/api/x")).toEqual({ ok: false, status: 409, error: "That time was just taken. Pick another.", code: "taken" });
  });

  it("is status 0 when nothing answers, and has no error when the body is not JSON", async () => {
    answer(new TypeError("offline"));
    expect(await getJson("/api/x")).toEqual({ ok: false, status: 0 });
    answer(new Response("<html>", { status: 502 }));
    expect(await postJson("/api/x", {}, "PATCH")).toEqual({ ok: false, status: 502, error: undefined, code: undefined });
  });
});

describe("bodyOf's size cap", () => {
  const post = (body: BodyInit, headers: Record<string, string> = {}) => new Request("https://juliangigola.com/api/book", { method: "POST", body, headers, duplex: "half" } as RequestInit);
  /** A body sent in chunks with no length, as a script can stream one. */
  const streamed = (bytes: number) =>
    post(new ReadableStream({ start(c) { for (let n = 0; n < bytes; n += 16_384) c.enqueue(new Uint8Array(Math.min(16_384, bytes - n)).fill(32)); c.close(); } }), {});

  it("reads a small body", async () => {
    expect(await bodyOf(post(JSON.stringify({ a: 1 })), SMALL_BODY)).toEqual({ a: 1 });
  });

  it("refuses a body past the cap before parsing it", async () => {
    const big = JSON.stringify({ a: "x".repeat(SMALL_BODY) });
    expect(await bodyOf(post(big), SMALL_BODY)).toBeNull();
  });

  it("stops reading a streamed body once it passes the cap", async () => {
    // Valid JSON past the cap (leading spaces, then an object), so only the cap can make it null.
    const tail = new TextEncoder().encode('{"a":1}');
    const valid = post(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(SMALL_BODY).fill(32)); c.enqueue(tail); c.close(); } }), {});
    expect(await bodyOf(valid, SMALL_BODY)).toBeNull();
    expect(await textOf(streamed(10), 100)).toBe(" ".repeat(10));
  });
});
