"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cameFromSite, notePath } from "@/lib/nav-memo";

/* Back where they came from: a step back in history when the last page was
   on this site, the portfolio when the page was opened directly (a new tab,
   a shared link, a search result). */

/** Mounted once in the root layout: hands each client navigation to the memo (lib/nav-memo.ts). */
export function NavMemo() {
  const path = usePathname();
  React.useEffect(() => notePath(path), [path]);
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
