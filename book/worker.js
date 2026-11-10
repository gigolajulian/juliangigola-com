// Serves the booking page's images. Every page now redirects to the site:
// the sessions and the two calls book on a page of their own (/book/<slug>),
// and the old Cal.com page (public/index.html) is never served.
const picker = { portraits: "portraits", graduation: "graduation", headshots: "headshots", digitals: "studio-digitals", editorial: "editorial", campaign: "brand-photography" };

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const path = pathname.split("/")[1];
    // 302, not 301: one line to undo.
    if (Object.hasOwn(picker, path)) return Response.redirect(`https://juliangigola.com/book/${picker[path]}`, 302);
    // Images (og cards, logo) still serve; any page, or a path with no file, goes to /book.
    if (/\.(jpe?g|png|svg)$/i.test(pathname)) return env.ASSETS.fetch(request);
    return Response.redirect("https://juliangigola.com/book", 302);
  },
};
