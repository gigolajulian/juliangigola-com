import type { MetadataRoute } from "next";

// Required by `output: "export"` — see the note in `sitemap.ts`.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // /admin is unlisted rather than protected — it does nothing without a
    // GitHub token — but there is no reason for it to be in an index.
    rules: [{ userAgent: "*", allow: "/", disallow: "/admin" }],
    sitemap: "https://www.juliangigola.com/sitemap.xml",
  };
}
