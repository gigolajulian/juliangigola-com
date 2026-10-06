// Serves the static booking page, and gives each booking link its own preview
// title and description (link-preview crawlers don't run the page's script).
const pages = {
  headshots: ["Headshots", "In Studio or on Location", "/og-headshots.jpg", 1200, 630],
  portraits: ["Portraits", "In Studio, on Campus or at Your Place", "/og-portraits.jpg", 1200, 630],
  graduation: ["Graduation", "On Campus", "/og-graduation.jpg", 1200, 630],
  digitals: ["Digitals", "In Studio", "/og-digitals.jpg", 1200, 630],
  editorial: ["Editorial call", "15 minutes about the shoot", "/og-editorial.jpg", 1200, 630],
  campaign: ["Brand & campaign call", "15 minutes about the brief", "/og-campaign.jpg", 1200, 630],
};

export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const page = pages[new URL(request.url).pathname.split("/")[1]];
    if (!page || !res.headers.get("content-type")?.includes("text/html")) return res;
    const [title, description, image, w, h] = page;
    const set = (value) => ({ element: (el) => el.setAttribute("content", value) });
    return new HTMLRewriter()
      .on('meta[property="og:title"]', set(title))
      .on('meta[property="og:description"]', set(description))
      // A session swaps in its own preview image, a wall of its gallery.
      .on('meta[property="og:image"]', image ? set(new URL(image, request.url).href) : {})
      .on('meta[property="og:image:width"]', image ? set(String(w)) : {})
      .on('meta[property="og:image:height"]', image ? set(String(h)) : {})
      .transform(res);
  },
};
