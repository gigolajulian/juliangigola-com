import type { MetadataRoute } from "next";

// Required by `output: "export"` — see the note in `sitemap.ts`.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://www.juliangigola.com/sitemap.xml",
  };
}
