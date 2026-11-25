import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/* SEC-12: a security.txt (RFC 9116) and the disclosure policy it points to, served from public/.well-known. */

const txt = readFileSync("public/.well-known/security.txt", "utf8");
const field = (name: string) => new RegExp(`^${name}: (.+)$`, "m").exec(txt)?.[1];

describe("security.txt", () => {
  it("names a contact, a policy that ships, and an expiry within the year ahead", () => {
    expect(field("Contact")).toBe("mailto:hello@juliangigola.com");
    const expires = Date.parse(field("Expires") ?? "");
    expect(expires).toBeGreaterThan(Date.now());
    expect(expires - Date.now()).toBeLessThanOrEqual(366 * 864e5);
    const policy = field("Policy") ?? "";
    expect(policy).toMatch(/^https:\/\/juliangigola\.com\/\.well-known\//);
    const file = `public${new URL(policy).pathname}`;
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toMatch(/How to report[\s\S]*What happens next/);
  });
});
