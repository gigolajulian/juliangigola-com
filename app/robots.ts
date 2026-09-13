import type { MetadataRoute } from "next";

// Required by `output: "export"` — see the note in `sitemap.ts`.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // /admin is unlisted rather than protected — it does nothing without a
    // GitHub token — but there is no reason for it to be in an index.
    rules: [
      { userAgent: "*", allow: "/", disallow: "/admin" },
      // Crawlers that collect for AI training and honour robots.txt. Search
      // indexing is unaffected: Googlebot and Bingbot are not in this list,
      // and Google-Extended / Applebot-Extended are the switches those two
      // companies publish for training use specifically. The legal version
      // of this list is clause 5 of /terms; the headers carry it too.
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "OAI-SearchBot",
          "Google-Extended",
          "Applebot-Extended",
          "ClaudeBot",
          "Claude-Web",
          "anthropic-ai",
          "CCBot",
          "Bytespider",
          "Amazonbot",
          "FacebookBot",
          "Meta-ExternalAgent",
          "Meta-ExternalFetcher",
          "PerplexityBot",
          "Perplexity-User",
          "cohere-ai",
          "cohere-training-data-crawler",
          "Diffbot",
          "omgili",
          "omgilibot",
          "webzio-extended",
          "ImagesiftBot",
          "img2dataset",
          "Timpibot",
          "YouBot",
          "AI2Bot",
          "Ai2Bot-Dolma",
          "PanguBot",
          "Kangaroo Bot",
          "DuckAssistBot",
          "MistralAI-User",
          "iaskspider/2.0",
          "ICC-Crawler",
          "Scrapy",
        ],
        disallow: "/",
      },
    ],
    sitemap: "https://www.juliangigola.com/sitemap.xml",
  };
}
