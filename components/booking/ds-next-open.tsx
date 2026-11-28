"use client";

import { useDs } from "@/lib/flags/ds";
import { useNextOpen } from "@/components/home/next-open";
import type { SessionSlug } from "@/lib/booking/catalog";

/* ds (S1): the next open day under a service page's booking button, the line the home's Sessions screen already
   shows. One slots request a page view, only with the flag on; nothing is drawn when no day is open. */
export function DsNextOpen({ slug }: { slug: SessionSlug }) {
  const ds = useDs();
  const next = useNextOpen(ds ? slug : null);
  return ds && next ? <p className="ds-next lbl mute">Next open · {next}</p> : null;
}
