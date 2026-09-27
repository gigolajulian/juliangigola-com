import Link from "next/link";
import Image from "next/image";
import { categoryLabel, type Project } from "@/lib/work";
import { cn } from "@/lib/utils";
import { CoverSpace } from "@/components/cover-space";
import { CoverRole } from "@/components/cover-role";
import { CoverCard, HeroDials, HeroName } from "@/components/hero-dials";

/* ── the cover ────────────────────────────────────────────────────
 * The name in the middle of the screen and the featured work round it,
 * laid out like basis's cover (`SLOTS`).
 *
 * The entrance is basis's, measured off Julian's recording: a second
 * after the opening lifts, the frames fade up out of nothing and a blur
 * and rise into place, out of order across two seconds. Then they hold
 * still, and the space turns a little after the pointer
 * (`cover-space.tsx`). The name rises out of its line as the frames
 * settle. All of it is held at its first frame while the opening is up
 * (`[data-intro="1"]` in `globals.css`) and runs as the panel leaves.
 *
 * Every frame is a link to its project, so the field is an index as well
 * as a picture.
 * ─────────────────────────────────────────────────────────────── */

/** Where each frame sits: left and top as a share of the cover, width in
    vw; each keeps its own photograph's proportions. Julian: laid out like
    basis's cover, his reference: upright cards in a loose, staggered field
    with room between them, some running off the edges, the middle left
    clear for the name. A little depth each (`z`, pixels toward the
    viewer) so the pointer moves them apart. The six with a `phone` place
    are the ones a phone shows, above and below the name. */
const SLOTS: {
  x: number;
  y: number;
  w: number;
  z: number;
  phone?: [number, number];
}[] = [
  { x: 8, y: 14, w: 13, z: 40, phone: [4, 8] },
  { x: 77, y: 12, w: 13, z: 30, phone: [68, 9] },
  { x: 30, y: -2.4, w: 12, z: -30, phone: [37, 3] },
  { x: 72, y: 60, w: 12, z: 50, phone: [68, 73] },
  { x: 17, y: 62, w: 11.5, z: -20, phone: [6, 74] },
  { x: 52, y: 2, w: 10, z: -50, phone: [37, 80] },
  { x: 93, y: 46, w: 12, z: -10 },
  { x: 40, y: 74, w: 10.5, z: 20 },
  { x: -3, y: 57, w: 11, z: -40 },
  { x: 57, y: 79, w: 11, z: -25 },
];

/** When each frame sets off, in the order of `SLOTS`: out of order, as
    measured, across about a second and a half. */
const ORDER = [0, 700, 1100, 850, 560, 1340, 620, 950, 1220, 780];

export function CoverFloat({
  work,
  className,
}: {
  work: Project[];
  className?: string;
}) {
  const frames = work.slice(0, SLOTS.length);
  /* What each frame is, for the line under the name to say while it is
     pointed at. Worked out here, on the server, so the archive that
     `categoryLabel` reads never reaches the browser. */
  const labels = frames.map((p) =>
    p.categories[0] ? categoryLabel(p.categories[0]) : "Photography",
  );
  return (
    <section
      data-tick
      data-label="Cover"
      aria-label="Julian Gigola, photographer and creative director"
      className={cn(
        "cover-float relative isolate grid place-items-center overflow-hidden",
        className,
      )}
    >
      {/* First, so its panels are listed before the cards' own. */}
      <HeroDials />
      <CoverSpace className="cover-float-ring absolute inset-0 -z-10">
        {frames.map((p, i) => {
          const s = SLOTS[i];
          return (
            <Link
              key={p.slug}
              prefetch={false}
              href={`/work/${p.slug}`}
              tabIndex={-1}
              data-discipline={labels[i]}
              className={cn("cover-float-frame", !s.phone && "max-sm:hidden")}
              style={
                {
                  "--x": `${s.x}%`,
                  "--y": `${s.y}%`,
                  "--w": `${s.w}vw`,
                  "--px": `${s.phone?.[0] ?? 0}%`,
                  "--py": `${s.phone?.[1] ?? 0}%`,
                  "--z": `${s.z}px`,
                  /* When it sets off: `--delay` in `globals.css`. */
                  "--order": ORDER[i] ?? 0,
                  // Julian: keep each photograph's own proportions.
                  aspectRatio: `${p.cover.width} / ${p.cover.height}`,
                } as React.CSSProperties
              }
            >
              <CoverCard>
                <Image
                  src={p.cover.src}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 30vw, 14vw"
                  priority={i < 4}
                  className="object-cover"
                  style={{ backgroundColor: p.cover.color }}
                />
              </CoverCard>
            </Link>
          );
        })}
      </CoverSpace>

      <div className="flex max-w-[min(62rem,92vw)] flex-col items-center px-6 text-center">
        <h1 className="uppercase">
          <span className="block">
            <span
              className="lift block"
              style={{ "--reveal-delay": "1300ms" } as React.CSSProperties}
            >
              {/* Julian: the name through React Bits' WarpText, in Inter
                  Tight Black. The canvas is a picture of the words; the words
                  themselves are here for search and screen readers. */}
              <span className="sr-only">Julian Gigola</span>
              <HeroName
                className="cover-float-name mx-auto normal-case"
                style={{
                  width: "5.9em",
                  height: "1.1em",
                  maxWidth: "92vw",
                }}
              />
            </span>
          </span>
          <span className="mt-6 block">
            <span
              className="lift block cover-float-title"
              style={{ "--reveal-delay": "1420ms" } as React.CSSProperties}
            >
              <CoverRole
                role="Photographer ♱ Creative Director"
                disciplines={[...new Set(labels)]}
              />
            </span>
          </span>
        </h1>
        <p
          className="lift cover-float-where mt-5 mb-[26px] max-w-[34rem]"
          style={{ "--reveal-delay": "1600ms" } as React.CSSProperties}
        >
          Based in San Francisco, CA. Available worldwide.
        </p>
        <div
          className="lift flex flex-wrap justify-center gap-3"
          style={{ "--reveal-delay": "1760ms" } as React.CSSProperties}
        >
          <Link href="/work" className="cover-cta press active:scale-[0.97]">
            See the work
          </Link>
          <Link
            href="/sessions"
            className="cover-cta cover-cta-quiet press active:scale-[0.97]"
          >
            Book a session
          </Link>
        </div>
      </div>
    </section>
  );
}
