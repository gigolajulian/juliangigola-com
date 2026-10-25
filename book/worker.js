// Serves the static booking page's files. The sessions and the two calls
// book on a page of their own on the site (/book/<slug>), on the V3 stepper.
const picker = { portraits: "portraits", graduation: "graduation", headshots: "headshots", digitals: "studio-digitals", editorial: "editorial", campaign: "brand-photography" };

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname.split("/")[1];
    // 302, not 301: one line to undo.
    if (path === "") return Response.redirect("https://juliangigola.com/book", 302);
    if (Object.hasOwn(picker, path)) return Response.redirect(`https://juliangigola.com/book/${picker[path]}`, 302);
    return env.ASSETS.fetch(request);
  },
};
