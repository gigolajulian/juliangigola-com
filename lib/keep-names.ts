/* Scripts inlined from `fn.toString()` carry the bundler's `__name(fn, "x")`
   calls when it keeps function names (the preview builds do; the live one
   does not), and the page has no `__name`: give them a pass-through then.
   Live output is unchanged, since there is nothing to match. */
export const keepNames = (js: string) => (js.includes("__name(") ? `var __name=function(f){return f};${js}` : js);
