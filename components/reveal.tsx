import type * as React from "react";

/**
 * Used to reveal its children once they scrolled into view: a lift and a
 * fade on a photograph, a calmer one on type. Julian asked for the reveal
 * on scroll to go, so this is a plain wrapper now and everything is on the
 * page from the start. The component stays so its call sites do not
 * change; `variant` is accepted and ignored for the same reason.
 */
export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "photo" | "calm";
}) {
  return <div className={className}>{children}</div>;
}
