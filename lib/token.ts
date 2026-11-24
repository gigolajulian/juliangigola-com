/* Hashes and random ids from Web Crypto, so they run in Workers, browsers and Node. */

/** Lowercase hex SHA-256 of the text's UTF-8 bytes. crypto.subtle, so it runs in Workers, browsers and Node. */
export async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** 16 base62 characters from the platform's CSPRNG (rejection sampling keeps it uniform). Contract ids and older galleries' tokens; new galleries get `proofId`. */
export function newToken(): string {
  let out = "";
  while (out.length < 16) {
    for (const b of crypto.getRandomValues(new Uint8Array(24))) {
      if (b < 248 && out.length < 16) out += B62[b % 62];
    }
  }
  return out;
}
