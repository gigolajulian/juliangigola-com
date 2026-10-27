import Image from "next/image";
import Link from "next/link";
import { CLIENT_MARKS } from "@/lib/clients-data";

/* A photo slot with its dark and light frame. Both are rendered and the
   theme hides one (`.v3d` / `.v3l` in styles/v3.css), so a theme switch
   needs no script and no flash; a hidden lazy picture is never fetched. */
export function Duo({
  d,
  l,
  alt,
  altL,
  sizes,
  priority,
  className,
}: {
  d: string;
  l: string;
  alt: string;
  altL?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <>
      <Image src={d} alt={alt} fill sizes={sizes} priority={priority} className={className ? `v3d ${className}` : "v3d"} />
      <Image src={l} alt={altL ?? alt} fill sizes={sizes} className={className ? `v3l ${className}` : "v3l"} />
    </>
  );
}

/** Text that changes with the theme (a caption under a Duo). */
export function Pick({ d, l }: { d: string; l: string }) {
  return d === l ? (
    <>{d}</>
  ) : (
    <>
      <span className="v3d">{d}</span>
      <span className="v3l">{l}</span>
    </>
  );
}

/* The client marks in `currentColor`, at the master's sizes, in the strip's
   order (DESIGN.md, Logo strip). The About grid reuses them. */
const MARKS: [slug: string, name: string, w: number, h: number][] = [
  ["empire", "Empire", 35, 35],
  ["ladera-granola", "Ladera Granola", 107, 18],
  ["pear-vc", "Pear VC", 48, 38],
  ["sols", "Sols", 51, 38],
  ["goodcult", "Goodcult", 111, 18],
  ["sago", "Sago", 70, 38],
  ["wired-magazine", "WIRED", 90, 18],
  ["jubo", "Jubo", 50, 23],
  ["paradox", "Paradox", 106, 23],
  ["ukiyosunknown", "Ukiyosunknown", 58, 30],
];

/* Where a strip mark goes when it is not its project's page (PRESS in lib/work.ts). */
const MARK_HREF: Record<string, string> = { empire: "https://www.empi.re/", "pear-vc": "/portfolio/video", "ladera-granola": "/portfolio/video" };

/* The About grid's own order (Julian's Arrange, master v45); the homepage strip keeps MARKS order. */
const ABOUT_ORDER = ["empire", "goodcult", "jubo", "wired-magazine", "paradox", "sols", "ladera-granola", "pear-vc", "sago", "ukiyosunknown"];

/** `cell`: each mark in its own box, in ABOUT_ORDER (the About grid). */
export function Marks({ hidden, cell }: { hidden?: boolean; cell?: boolean }) {
  const list = cell ? ABOUT_ORDER.map((s) => MARKS.find(([slug]) => slug === s)!) : MARKS;
  return list.map(([slug, name, w, h]) => {
    const m = CLIENT_MARKS[slug];
    if (!m) return null;
    const label = hidden ? { "aria-hidden": true } : { role: "img", "aria-label": name };
    const mask = `url(${m.kind === "mask" ? m.src : ""}) center/contain no-repeat`;
    const mark =
      m.kind === "svg" ? (
        <svg key={slug} className="mk" viewBox={m.viewBox} width={w} height={h} fill="currentColor" data-mk={slug} {...label} dangerouslySetInnerHTML={{ __html: m.body }} />
      ) : (
        <span key={slug} className="mk" data-mk={slug} {...label} style={{ width: w, height: h, WebkitMask: mask, mask }} />
      );
    if (cell) return <div key={slug}>{mark}</div>;
    const href = MARK_HREF[slug] ?? `/portfolio/${slug}`;
    return (
      <Link key={slug} href={href} draggable={false} {...(hidden ? { tabIndex: -1, "aria-hidden": true } : {})}>
        {mark}
      </Link>
    );
  });
}

/** One client's mark at height `h`, its width from its own proportions (a project page's head).
    `even` scales `h` by the mark's own evening factor, so a row of different marks reads one size. */
export function Mark({ slug, name, h: base, even = false }: { slug: string; name: string; h: number; even?: boolean }) {
  const m = CLIENT_MARKS[slug];
  if (!m) return null;
  const h = even ? Math.round(base * m.scale) : base;
  if (m.kind === "svg") {
    const [, , vw, vh] = m.viewBox.split(/\s+/).map(Number);
    return <svg className="mk" viewBox={m.viewBox} height={h} width={(h * vw) / vh} fill="currentColor" role="img" aria-label={name} dangerouslySetInnerHTML={{ __html: m.body }} />;
  }
  const mask = `url(${m.src}) center/contain no-repeat`;
  return <span className="mk" role="img" aria-label={name} style={{ display: "inline-block", height: h, width: (h * m.width) / m.height, WebkitMask: mask, mask, background: "currentColor" }} />;
}
