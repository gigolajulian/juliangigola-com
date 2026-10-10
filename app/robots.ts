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
      // of this list is clause 5 of /legal#terms; the headers carry it too.
      //
      // AI search is let in, at Julian's ask: OAI-SearchBot, ChatGPT-User,
      // PerplexityBot, Perplexity-User, DuckAssistBot, MistralAI-User and
      // Meta-ExternalFetcher fetch a page to answer a question and cite it,
      // and are off this list. Each company's training crawler (GPTBot,
      // Meta-ExternalAgent...) stays on it. Claude-SearchBot and Claude-User
      // were never listed; ClaudeBot is Anthropic's trainer.
      //
      // Google-Extended is off the list at Julian's ask so Gemini can
      // recommend the site. Google uses that one token for both Gemini answers
      // and Gemini training, so the terms' AI search clause names Google as
      // the exception. Googlebot-Image is shut out in exchange, so the
      // photographs themselves stay out of Google.
      { userAgent: "Googlebot-Image", disallow: "/" },
      {
        userAgent: [
          "GPTBot",
          "Applebot-Extended",
          "ClaudeBot",
          "Claude-Web",
          "anthropic-ai",
          "CCBot",
          "Bytespider",
          "Amazonbot",
          "FacebookBot",
          "Meta-ExternalAgent",
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
          "iaskspider/2.0",
          "ICC-Crawler",
          "Scrapy",
        ],
        disallow: "/",
      },
    ],
    sitemap: "https://juliangigola.com/sitemap.xml",
  };
}
