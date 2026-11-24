/* Dev overrides in the query string (?intro=1, ?proofwall=0). One reader, so every flag is parsed the same way.
   The flags that ride sessionStorage from a head script live beside it (v4pages.ts). `value` is a regex fragment, as
   the call sites wrote it ("0", "[12]"). No end boundary: ?intro=05 reads as intro=0. False on the server. */
export const qflag = (name: string, value: string): boolean =>
  typeof location !== "undefined" && new RegExp(`[?&]${name}=${value}`).test(location.search);
