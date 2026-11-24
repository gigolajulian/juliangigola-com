import type { ReactNode, SVGProps } from "react";

/** Chrome the private desks (leads, proofs, admin sign-in) share. */

/** A desk icon: a 24 box, a 1.6 line in the text colour. */
export const glyph = (d: ReactNode) =>
  function Glyph(p: SVGProps<SVGSVGElement>) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{d}</svg>;
  };

export const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-border px-4 text-[15px] font-medium transition-colors duration-200 hoverable:hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
export const primary = "border-accent bg-accent font-semibold text-accent-foreground hoverable:hover:bg-accent/90";
