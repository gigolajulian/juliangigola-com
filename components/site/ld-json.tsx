import { ldJson } from "@/lib/seo";

/* ── the booking pages' structured data ───────────────────────────
 * The screens themselves are the homepage's (`app/[service]/page.tsx`).
 * ─────────────────────────────────────────────────────────────── */

/** A JSON-LD graph, inlined (`ldJson` escapes it). */
export function LdJson({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: ldJson(data) }}
    />
  );
}
