import Image from "next/image";
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

/** `cell`: each mark in its own box (the About grid). */
export function Marks({ hidden, cell }: { hidden?: boolean; cell?: boolean }) {
  return MARKS.map(([slug, name, w, h]) => {
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
    return cell ? <div key={slug}>{mark}</div> : mark;
  });
}
