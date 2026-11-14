import type { Metadata } from "next";
import { V3Home, type TopWork } from "@/components/v3/home";
import { MtGate } from "@/components/v3/mt/gate";
import { COMM_KEYS, FILM_PICKS, HERO_KEYS, type MtData, type MtFrame } from "@/components/v3/mt/data";
import { DOES } from "@/components/v3/about";
import { COMMISSION_TABS } from "@/lib/v3";
import { PROJECTS, categoryLabel, getProject } from "@/lib/work";
import { CONTENT } from "@/lib/content";
import { REEL, posterFor, previewUrl } from "@/lib/videos";
import { RESPONSE_TIME } from "@/lib/site";
import ORDER from "@/lib/portfolio-order.json";
import { shareOg } from "@/lib/share";

export const metadata: Metadata = shareOg("Photographer and creative director","Fashion editorial, campaigns and portraits in the San Francisco Bay Area. Available worldwide.");

/* JG V3 homepage (master v39). The old deck (strip, cover float, screens)
   is retired. */
/* Each Commissions tab's top projects in Julian's portfolio order, as
   /portfolio shows them: nine, or five, the counts that fill the sheet
   (one large and its small ones). Fewer than five and the tab keeps
   linking to /portfolio. */
const rank = (slug: string) => {
  const i = ORDER.indexOf(slug);
  return i < 0 ? ORDER.length : i;
};
const TOP: Record<string, TopWork[]> = Object.fromEntries(
  COMMISSION_TABS.flatMap(([, href]) => {
    const d = new URLSearchParams(href.split("?")[1]).get("d");
    if (!d) return [];
    const list = PROJECTS.filter((p) => p.slug !== "realestate" && p.categories.some((c) => c.slug === d))
      .sort((a, b) => rank(a.slug) - rank(b.slug))
      .map((p) => ({ s: p.slug, n: p.name, src: p.cover.src, meta: categoryLabel(p.categories.find((c) => c.slug === d)!) }));
    const fit = list.length >= 9 ? 9 : list.length >= 5 ? 5 : 0;
    return fit ? [[d, list.slice(0, fit)]] : [];
  }),
);

/* `?mtscroll=1` (v4 home): the frames resolved here so lib/work stays out of the client. */
const frame = (key: string): MtFrame => {
  const [slug, n] = key.split("/");
  const p = getProject(slug);
  const src = `/work/${slug}/${n}.jpg`;
  const f = p?.images.find((x) => x.src === src) ?? p?.cover;
  return { src, slug, name: `${p?.name ?? slug} ${n}`, meta: p?.categories[0] ? categoryLabel(p.categories[0]) : "", r: f ? +(f.height / f.width).toFixed(3) : 1.25 };
};
const markOf = (client: string) => (client === "Sammy Shiblaq" ? "empire" : client === "Imanemun" ? "paydar" : client.toLowerCase().replace(/\s+/g, "-"));
const vid = (title: string) => CONTENT.videos.find((v) => v.title === title);
const used = new Set([...HERO_KEYS, ...COMM_KEYS].map((k) => k.split("/")[0]));
const MT: MtData = {
  hero: HERO_KEYS.map(frame),
  // Side columns on wide screens (spec 5): Commissions frames, then each project's first frame not already on the wall.
  extras: [...COMM_KEYS.map(frame), ...PROJECTS.filter((p) => !used.has(p.slug) && p.images[0]).slice(0, 40).map((p) => frame(`${p.slug}/${p.images[0].src.split("/").pop()!.replace(".jpg", "")}`))],
  comm: COMM_KEYS.map(frame),
  films: FILM_PICKS.map(([title, kind]) => {
    if (title === REEL.title) return { id: "reel", title, kind, client: "2023", poster: REEL.poster, href: "/portfolio/video", preview: previewUrl({ ...REEL, id: "reel", section: "music" } as Parameters<typeof previewUrl>[0]) };
    const v = vid(title);
    return { id: v?.id ?? title, title, kind, client: v?.client ?? "", poster: v ? posterFor(v) : null, preview: v ? previewUrl(v) : undefined, href: v?.client ? `/portfolio/video#${markOf(v.client)}` : "/portfolio/video" };
  }),
  does: DOES,
  reply: RESPONSE_TIME,
  stills: Object.fromEntries(
    ([["film:pear-vc", "Pear VC Campaign"], ["film:ladera", "Ladera Granola"]] as const).map(([k, t]) => {
      const v = vid(t);
      return [k, (v && posterFor(v)) ?? ""];
    }),
  ),
};

export default function Home() {
  return (
    <MtGate data={MT}>
      <V3Home top={TOP} />
    </MtGate>
  );
}
