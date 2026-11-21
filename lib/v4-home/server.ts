import { COMM_KEYS, DOES, FILM_DRESS, FILM_FILES, FILM_PICKS, HERO_KEYS, type MtData, type MtFrame } from "@/lib/v4-home/data";
import { PROJECTS, categoryLabel, getProject } from "@/lib/work/work";
import { CONTENT } from "@/lib/content";
import { REEL, posterFor, previewUrl } from "@/lib/work/videos";
import { RESPONSE_TIME } from "@/lib/site";

/* `?mtscroll=1` (v4 home): the frames resolved on the server so lib/work stays out of the client. */
// the home's own start second for a film's preview, where one was picked (FILM_DRESS.startSec)
const at = (title: string) => (FILM_DRESS[title]?.startSec === undefined ? {} : { previewAt: FILM_DRESS[title]?.startSec });
const frame = (key: string): MtFrame => {
  const [slug, n] = key.split("/");
  const p = getProject(slug);
  const src = `/work/${slug}/${n}.jpg`;
  const f = p?.images.find((x) => x.src === src) ?? p?.cover;
  return { src, slug, name: `${p?.name ?? slug} ${n}`, meta: p?.categories[0] ? categoryLabel(p.categories[0]) : "", r: f ? +(f.height / f.width).toFixed(3) : 1.25 };
};
const markOf = (client: string) => (client === "Sammy Shiblaq" ? "empire" : client === "Imanemun" ? "paydar" : client.toLowerCase().replace(/\s+/g, "-"));
// the site's own file for a film, starting at the same second as its player preview (`#t=8s` in the preview URL)
const file = (title: string, preview?: string) => (FILM_FILES[title] ? `${FILM_FILES[title]}#t=${preview?.match(/#t=(\d+)s/)?.[1] ?? 8}` : undefined);
const vid = (title: string) => CONTENT.videos.find((v) => v.title === title);
const used = new Set([...HERO_KEYS, ...COMM_KEYS].map((k) => k.split("/")[0]));
export const MT: MtData = {
  hero: HERO_KEYS.map(frame),
  // Side columns on wide screens (spec 5): Commissions frames, then each project's first frame not already on the wall.
  // 70 of them: wide screens show 30 on the wall itself (side columns, rows five and six) and the intro canvas draws 30 more.
  // Only projects whose files sit under /work/<slug>/: `frame` builds that path, and Cover art keeps its files in /covers/ (it 404ed).
  extras: [...COMM_KEYS.map(frame), ...PROJECTS.filter((p) => !used.has(p.slug) && p.images[0]?.src.startsWith(`/work/${p.slug}/`)).slice(0, 70).map((p) => frame(`${p.slug}/${p.images[0].src.split("/").pop()!.replace(".jpg", "")}`))],
  comm: COMM_KEYS.map(frame),
  films: FILM_PICKS.map(([title, kind]) => {
    const reel = title === REEL.title ? previewUrl({ ...REEL, id: "reel", section: "music", ...at(title) } as Parameters<typeof previewUrl>[0]) : "";
    if (reel) return { id: "reel", title, kind, client: "2023", poster: REEL.poster, href: "/portfolio/video", preview: reel, file: file(title, reel) };
    const v = vid(title), preview = v ? previewUrl({ ...v, ...at(title) }) : undefined;
    return { id: v?.id ?? title, title, kind, client: v?.client ?? "", poster: v ? posterFor(v) : null, preview, file: file(title, preview), href: v?.client ? `/portfolio/video#${markOf(v.client)}` : "/portfolio/video" };
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
