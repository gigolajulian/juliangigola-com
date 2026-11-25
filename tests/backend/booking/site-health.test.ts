import { expect, it, vi } from "vitest";
import { HEALTH_PATHS, health } from "@/worker/index";

/* The hourly run loads the site's main pages; any that fails mails hello@ once, and a healthy site mails nothing. */

const run = async (answer: (path: string) => Response | Promise<Response>) => {
  const sent: { to: string; subject: string; text: string }[] = [];
  const env = {
    SITE: { fetch: async (url: string) => answer(new URL(url).pathname) },
    CLIENT_EMAIL: { send: async (m: (typeof sent)[number]) => void sent.push(m) },
  } as never;
  return { bad: await health(env), sent };
};

it("mails nothing when every page loads", async () => {
  const { bad, sent } = await run(() => new Response("ok"));
  expect(bad).toEqual([]);
  expect(sent).toEqual([]);
});

it("mails hello@ once, naming each page that failed", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { bad, sent } = await run((p) =>
    p === "/book" ? new Response("", { status: 500 }) : p === "/portfolio" ? Promise.reject(new Error("network")) : new Response("ok"),
  );
  expect(bad).toEqual(["/book: 500", "/portfolio: Error: network"]);
  expect(sent).toHaveLength(1);
  expect(sent[0].to).toBe("hello@juliangigola.com");
  expect(sent[0].subject).toBe(`Site check failed: 2 of ${HEALTH_PATHS.length} pages`);
  expect(sent[0].text).toContain("/book: 500");
});
