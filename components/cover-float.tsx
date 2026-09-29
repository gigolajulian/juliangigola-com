import Link from "next/link";
import Image from "next/image";
import { categoryLabel, type Project } from "@/lib/work";
import { cn } from "@/lib/utils";
import { CoverSpace } from "@/components/cover-space";
import { CoverRole } from "@/components/cover-role";
import { FitLines } from "@/components/fit-lines";
import { CoverCard, HeroDials, HeroName } from "@/components/hero-dials";
import { DEAL, LANDSCAPE, MIDDLE, PHONE, SIDEWAYS, SLOTS, UPRIGHT, middleVars } from "@/lib/cover-slots";
import { LiquidPair } from "@/components/liquid-pair";

/* ── the cover ────────────────────────────────────────────────────
 * The name in the middle of the screen and the featured work round it,
 * laid out like basis's cover (`lib/cover-slots.ts`).
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
      style={
        {
          ...middleVars(MIDDLE),
          /* The frontmost photograph in each layout, which the one pointed
             at comes out in front of (`globals.css`). */
          "--zmax-large": `${Math.max(...SLOTS.map((s) => s.z))}px`,
          ...Object.fromEntries(
            Object.entries({ upright: UPRIGHT, landscape: LANDSCAPE, sideways: SIDEWAYS, phone: PHONE }).map(
              ([shape, set]) => [`--zmax-${shape}`, `${Math.max(...set.filter((p) => p.show).map((p) => p.z))}px`],
            ),
          ),
        } as React.CSSProperties
      }
      className={cn(
        "cover-float relative isolate grid place-items-center overflow-hidden",
        className,
      )}
    >
      {/* First, so its panels are listed before the cards' own. */}
      <HeroDials />
      <CoverSpace className="cover-float-ring absolute inset-0 -z-10">
        {frames.map((p, i) => {
          const at = DEAL[i] ?? i;
          const s = SLOTS[at];
          const u = UPRIGHT[at];
          const l = LANDSCAPE[at];
          const ph = PHONE[at];
          const sw = SIDEWAYS[at];
          return (
            <Link
              key={p.slug}
              prefetch={false}
              href={`/portfolio/${p.slug}`}
              tabIndex={-1}
              // Julian: VIEW on the ring over a photo, as on every other.
              data-ring="View"
              data-discipline={labels[i]}
              data-photo={p.name}
              className={cn(
                "cover-float-frame",
                !ph.show && "cover-float-off-phone",
                !sw.show && "cover-float-off-sideways",
                // The smaller screens' own layouts (globals.css).
                !u.show && "cover-float-off-upright",
                !l.show && "cover-float-off-landscape",
              )}
              style={
                {
                  "--x": `${s.x}%`,
                  "--y": `${s.y}%`,
                  "--w": `${s.w}vw`,
                  "--ux": `${u.x}%`,
                  "--uy": `${u.y}%`,
                  "--uw": `${u.w}vw`,
                  "--uz": `${u.z}px`,
                  "--lx": `${l.x}%`,
                  "--ly": `${l.y}%`,
                  "--lw": `${l.w}vw`,
                  "--lz": `${l.z}px`,
                  "--sx": `${sw.x}%`,
                  "--sy": `${sw.y}%`,
                  "--sw": `${sw.w}vw`,
                  "--sz": `${sw.z}px`,
                  "--px": `${ph.x}%`,
                  "--py": `${ph.y}%`,
                  "--pw": `${ph.w}vw`,
                  "--pwh": `${(ph.w * 13) / 28}svh`,
                  "--pz": `${ph.z}px`,
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
                  sizes="(max-width: 640px) 30vw, (max-width: 1280px) 22vw, 14vw"
                  priority={i < 4}
                  className="object-cover"
                  style={{ backgroundColor: p.cover.color }}
                />
              </CoverCard>
            </Link>
          );
        })}
      </CoverSpace>

      {/* Julian: the words come in as the photographs do, from the first
          photograph's start (`--h-start`, "Load animation"), each part a
          beat after the one above, rather than once they have landed. */}
      <div className="cover-float-middle flex max-w-[min(62rem,92vw)] flex-col items-center px-6 text-center">
        <h1 className="uppercase">
          <span className="block">
            <span
              className="lift block"
              style={{ "--reveal-delay": "var(--h-start, 420ms)" } as React.CSSProperties}
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
          <span className="mt-[var(--h-gap-role,5px)] block">
            <span
              className="lift block cover-float-title"
              style={{ "--reveal-delay": "calc(var(--h-start, 420ms) + 120ms)" } as React.CSSProperties}
            >
              <CoverRole
                role={"Photographer ♱ Creative Director"}
                disciplines={[...new Set(labels)]}
              />
            </span>
          </span>
        </h1>
        <p
          className="lift cover-float-where mt-[var(--h-gap-where,8px)] mb-[var(--h-gap-cta,19px)] max-w-[34rem]"
          style={{ "--reveal-delay": "calc(var(--h-start, 420ms) + 300ms)" } as React.CSSProperties}
        >
          <span className="fit-line">{"Based in San Francisco, CA. Available Worldwide"}</span>
          <FitLines />
        </p>
        <LiquidPair
          fill="var(--hero-ink)"
          className="lift cover-float-ctas flex flex-wrap justify-center gap-3"
          style={{ "--reveal-delay": "calc(var(--h-start, 420ms) + 460ms)" } as React.CSSProperties}
        >
          <Link href="/portfolio" className="cover-cta press active:scale-[0.97]">
            See the work
          </Link>
          <Link
            href="/#sessions"
            className="cover-cta cover-cta-quiet press active:scale-[0.97]"
          >
            Book a session
          </Link>
        </LiquidPair>
      </div>
    </section>
  );
}
