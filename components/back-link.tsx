"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/* Back where they came from: a step back in history when the last page was
   on this site, the portfolio when the page was opened directly (a new tab,
   a shared link, a search result). */

let steps = 0; // client navigations in this document

const cameFromSite = () => steps > 0 || document.referrer.startsWith(location.origin + "/");

/** Mounted once in the root layout: counts client navigations. */
export function NavMemo() {
  const path = usePathname();
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) first.current = false;
    else steps++;
  }, [path]);
  return null;
}

export function BackLink({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <Link
      className={className}
      href="/portfolio"
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !cameFromSite()) return;
        e.preventDefault();
        router.back();
      }}
    >
      &larr; Back
    </Link>
  );
}
