import { describe, expect, it } from "vitest";
import { bodyOf, json, NO_STORE } from "@/lib/http";

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
