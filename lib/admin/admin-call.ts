/**
 * The admin fetch the lead desk, the proofs desk and /admin share.
 * Browser only: the key comes from localStorage.
 */
import { credentials, KEY_STORE } from "@/lib/admin/admin-github";
import { localGet } from "@/lib/storage";
import { TZ } from "@/lib/time-zone";
import { errorText } from "@/lib/utils";

/** The admin key if one was pasted, else the /admin GitHub token. */
export const authed = () => credentials(localGet(KEY_STORE) ?? "");

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

/**
 * One authed file from an admin route (a CSV, a signed copy, a reference).
 * A failed answer throws a plain Error, `fail` and the status, so a 401 reads
 * like any other failure and does not send the desk to sign-in.
 */
export async function adminBlob(path: string, fail: string, headers: Record<string, string> = authed()): Promise<Blob> {
  const res = await fetch(path, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`${fail} (${res.status})`);
  return res.blob();
}

export const OFFLINE = "Offline. The desk loads again when you are back online.";
/** Any 401 from the admin gate (`refuseAdmin`): a missing key or a token GitHub refused. The desks show sign-in for it. */
export const isLocked = (e: unknown) => e instanceof AdminError && e.status === 401;
export const LOCKED = "Not authorized.";
/** What a failed load says: offline, or the route's own words. */
export const loadErrorText = (e: unknown) => (navigator.onLine === false || e instanceof TypeError ? OFFLINE : isLocked(e) ? LOCKED : errorText(e));

/** "Nov 11, 4:05 PM" in Julian's time. */
export const stampPT = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
