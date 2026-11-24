/**
 * The admin fetch the lead desk, the proofs desk and /admin share.
 * Browser only: the key comes from localStorage.
 */
import { credentials, KEY_STORE } from "@/lib/admin/admin-github";

/** The admin key if one was pasted, else the /admin GitHub token. */
export const authed = () => credentials(window.localStorage.getItem(KEY_STORE) ?? "");

/** A failed admin request, with the status the route answered. */
export class AdminError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * One authed JSON request to an admin route. `fail` is what a failure says
 * when the route gave no error of its own. A failed answer that is not JSON
 * (an HTML 502) reads as {}, so the status still shows; a 2xx that is not
 * JSON throws, since there is nothing to hand back.
 */
export async function adminCall<T = Record<string, unknown>>(path: string, init: RequestInit = {}, fail?: string): Promise<T> {
  const res = await fetch(path, { ...init, headers: { ...authed(), "content-type": "application/json", ...init.headers }, cache: "no-store" });
  const text = await res.text().catch(() => "");
  let out: (T & { error?: string }) | undefined;
  try {
    out = JSON.parse(text);
  } catch {
    if (res.ok) throw new AdminError(fail ?? "The route did not answer with JSON.", res.status);
  }
  if (!res.ok) throw new AdminError(out?.error ?? fail ?? `Request failed (${res.status})`, res.status);
  return out as T;
}
