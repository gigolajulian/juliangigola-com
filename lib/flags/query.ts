/* Dev and rollback overrides in the query string (?mtpin=0, ?preload=0, ?intro=1, ...). One reader, so every
   flag is parsed the same way. The flags that ride sessionStorage from a head script live beside it (v4pages.ts). `value` and `pattern` are regex fragments, as the call sites wrote them ("0", "[12]").
   No end boundary, as before: ?mtpin=05 reads as mtpin=0. False and undefined on the server. */
export const qflag = (name: string, value: string): boolean =>
  typeof location !== "undefined" && new RegExp(`[?&]${name}=${value}`).test(location.search);

export const qvalue = (name: string, pattern = "\\w+"): string | undefined =>
  typeof location === "undefined" ? undefined : new RegExp(`[?&]${name}=(${pattern})`).exec(location.search)?.[1];
