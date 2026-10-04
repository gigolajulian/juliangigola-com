import Image from "next/image";
import SOURCES from "@/public/work/sources.json";
import Link from "next/link";
import type { Frame } from "@/lib/work-types";
import { CoverFloat } from "@/components/cover-float";
import { Strip } from "@/components/strip";
import { StripPage } from "@/components/strip-page";
import { EnquiryCell } from "@/components/enquiry-cell";
import { Testimonials } from "@/components/testimonials";
import { InquireWall } from "@/components/inquire-wall";
import {
  FEATURED,
  DISCIPLINE_TILES,
  PRESS_HOME,
  PROJECTS,
  projectsIn,
  WALL,
  WORK_PAGE,
  WORK_CATEGORY_LINKS,
  commissionsIn,
  indexRow,
  COVER_RELEASES,
} from "@/lib/work";
import { CONTENT } from "@/lib/content";
import { frameHash } from "@/lib/frame-hash";
import { REEL, posterFor } from "@/lib/videos";
import { LeadWindow } from "@/components/lead-window";
import { ClientMarks } from "@/components/client-marks";
import { AboutScreen } from "@/components/about-screen";
import { ContactScreen } from "@/components/contact-screen";
import { SessionsScreen } from "@/components/sessions-screen";
import { ServicesScreen, type Shot } from "@/components/services-screen";
import { SESSION_TYPES, formatPrice } from "@/lib/sessions";
import { pageForSession } from "@/lib/booking";

/* ── the homepage ─────────────────────────────────────────────────
 * One screen at a time, sideways. Each screen is a whole section rather
 * than a slice of one — the cover, the whole of the selected work, the rack
 * of sleeves, the two doors, the ask — and a notch, a swipe or an arrow
 * moves exactly one of them. Julian asked for the page to be
 * sectioned off, with the movement between sections meaning something:
 * a gesture is "the next thing", never "a bit further along".
 *
 * The moves are the ones the page has always made, in the order a first
 * visitor asks for them:
 *
 *   1. The cover — who he is and what he does, cycling through the
 *      disciplines so the range lands in the first few seconds. It is the
 *      first screen and it is the whole screen, so nothing about the first
 *      impression changes. `arrive="none"`: nothing slides the photograph
 *      in, and nothing moves inside it.
 *   2. Selected work — all nine on one screen, three across and three
 *      down, each tile scrubbing through its own sequence under the
 *      pointer. That answers the question a cover cannot: not "does this
 *      project exist" but "is the whole set good", which is a question
 *      about a set, so the set is on one screen with nothing behind it,
 *      and the client marks run in a line under it: the names that make an
 *      art director keep reading, beside what he made for them.
 *   3. Cover art, About, Contact, and last the two doors and the ask,
 *      which leads on to the work.
 * ─────────────────────────────────────────────────────────────── */

/* The nine are one screen. The question the section answers is "is the
   whole set good", and a set is something you see at once — split over two
   screens it was a set of six and a set of three, and the second one was a
   page nobody knew was there.

   Five along the top and four under it, rather than three rows of three.
   The previews are upright, and three rows of an upright tile in the height
   a screen has left is a tile 155 wide: small enough that UKIYOSUNKNOWN came
   out UKIYOS... Two rows of a taller tile is the same nine pictures at half
   again the size, and the short row centres itself under the long one. */
/* Each session's sample, the lead window's covers, and the wall behind
   Inquire without any frame those, the cover or the services already show. */
const SAMPLES = SESSION_TYPES.map(
  (s) => (s.sample && PROJECTS.find((p) => p.slug === s.sample)) || projectsIn(s.slug)[0],
);
const LEAD = commissionsIn(WORK_CATEGORY_LINKS[0].slug).slice(0, 16);
/* Julian's sleeves for the Cover Art table, in his order (2026-10-03). */
const COVER_PICKS = [
  "problem-child",
  "the-river",
  "the-description",
  "your-way",
  "jahannam",
  "est-modvs-in-rebvs",
  "took-time",
  "in-the-hoodie-on-your-sleeve",
];
/* A project's cover is a copy of one of its frames under another name
   (`sources.json`, written by `make-cards`). Compared by that frame, a
   cover and the frame it was cut from count as one picture: Event coverage
   showed its first photograph twice (Julian, 2026-10-03). */
/* Frames past a project's cover that its discipline shows as well:
   Wrapped Up's heels and lipstick, and a second Crave. */
const MORE = ["/work/wrapped-up/04.jpg", "/work/crave/03.jpg"];

const same = (src: string) => (SOURCES as Record<string, string>)[src] ?? src;

/* What the cover, Sessions and the lead window show, which the services
   light table leaves out as well. */
const ELSEWHERE = new Set([...FEATURED, ...SAMPLES, ...LEAD].map((p) => p?.cover.src));
const SHOWN = new Set([
  ...ELSEWHERE,
  // Services: each discipline's cover, and its light table's frames.
  ...DISCIPLINE_TILES.flatMap((t) => [t.cover.src, ...shotsOf(t).map((s) => s.src)]),
]);
const WALL_HERE = WALL.filter((t) => !SHOWN.has(t.src));
/* A photograph behind each door on the last screen (critique, 2026-10-03:
   the screen that asks was the only one without work on it). */
// Julian's pick (2026-10-03): Valgur, the two knights and the lightning.
const DOOR_WORK = PROJECTS.find((p) => p.slug === "valgur")?.images.find((f) => f.src === "/work/valgur/06.jpg");
// Julian's pick (2026-10-03): Sago, standing in the tall grass.
const DOOR_SESSIONS = PROJECTS.find((p) => p.slug === "sago")?.images.find((f) => f.src === "/work/sago/01.jpg");

/* A discipline's frames for the Commissions table, up to twelve: its
   projects' covers (Julian, 2026-10-03), the films for Motion, his picked
   sleeves for Cover Art. */

function shotsOf(t: (typeof DISCIPLINE_TILES)[number]): Shot[] {
  const projects = projectsIn(t.category);
  const shots: Shot[] = [];
  // Julian: Mixed media, Brand campaigns and Artist presskit show every
  // project, even one shown elsewhere (campaigns bar Hellamack; presskit
  // for Valgur and Iris).
  const every = ["mixed-media", "campaigns", "artist-presskit"].includes(t.category);
  const add = (f: { src: string; color?: string; width: number; height: number }, title: string, href: string) => {
    if ((every || shots.length < 12) && (every || !ELSEWHERE.has(f.src)) && !shots.some((s) => same(s.src) === same(f.src))) shots.push({ src: f.src, color: f.color, width: f.width, height: f.height, title, href });
  };
  // Cover Art's projects are its sleeves, dealt below; a project cover there
  // would show one of them twice.
  if (t.category !== "coverart")
    for (const p of projects) {
      if (p.slug === "hellamack") continue;
      add(p.cover, p.name, `/portfolio#${p.slug}`);
      // Frames Julian asked for beside the cover (2026-10-03).
      for (const f of p.images) if (MORE.includes(f.src)) add(f, p.name, `/portfolio#${p.slug}`);
    }
  // Julian (2026-10-03): covers only. Motion has no projects: every
  // film, the reel first, by its poster. Cover Art: eight sleeves, not the
  // photograph of them laid out (Julian: remove).
  // Event coverage is one long set: its own frames, as /portfolio runs it.
  if (t.category === "events")
    for (const p of projects) for (const f of p.images) add(f, p.name, `/portfolio#${frameHash(f.src)}`);
  if (t.category === "video")
    for (const v of [REEL, ...CONTENT.videos]) {
      const still = "id" in v ? posterFor(v) : v.poster;
      // Julian: the film and who it was for, "CLEAN - CAMR".
      const who = "client" in v ? v.client : undefined;
      const title = who && who !== v.title ? `${v.title} - ${who}` : v.title;
      if (still) add({ src: still, width: 1280, height: 720 }, title, `/portfolio#${"id" in v ? v.id : "reel"}`);
    }
  if (t.category === "coverart") {
    for (const r of COVER_PICKS.map((slug) => COVER_RELEASES.find((c) => c.slug === slug)))
      if (r) add({ ...r.frames[0], src: r.frames[0].thumb }, `${r.title}, ${r.artist}`, `/portfolio#${frameHash(r.frames[0].src)}`);
  }
  return shots;
}

/* What each discipline is, one line under its name (Julian, 2026-10-03:
   a short description of each, in place of the credit names). */
const ABOUT: Record<string, string> = {
  campaigns: "Product and lifestyle shoots for brands",
  "artist-presskit": "Press photos for musicians and artists",
  editorial: "Styled stories built around a concept",
  portraits: "Personal portraits, in studio or on location",
  "mixed-media": "Photography crossed with 3D design",
  events: "Live shows, from the stage to the crowd",
  coverart: "Album and single covers for artists",
  video: "Music videos, campaigns and short films",
};

export default function Home() {
  return (
    <StripPage>
      <Strip
        label="Julian Gigola: the cover, selected work, cover art, about, contact, and how to get in touch. One screen at a time, left and right."
        next={WORK_PAGE}
        arrive="none"
        paged
        // Julian: the ScrollStack, sideways. Each screen slides over the one
        // before, which sinks back under it (`lib/deck.ts`).
        deck="screens"
        // The hero and the next screen first, the rest once it has landed.
        defer
        bleed
        className="flex-1"
      >
        {/* Julian: the cover as skvarenina.com opens, with his work. */}
        <CoverFloat
          work={FEATURED}
          className="w-full shrink-0 max-sm:h-[100svh] sm:h-full"
        />

        {/* Julian (2026-10-03): a preview of the portfolio, not all of
            it: the disciplines as an index beside one large photograph,
            and the way on to the portfolio (`services-screen.tsx`). It was
            a grid of eight tiles, every one a door. */}
        <ServicesScreen
          rows={DISCIPLINE_TILES.map((t) => ({
            slug: t.slug,
            // Julian: "Fashion editorial" on this list.
            name: t.category === "editorial" ? "Fashion Editorial" : t.name,
            href: t.href ?? `/portfolio/${t.slug}`,
            cover: t.cover,
            shots: shotsOf(t),
            about: ABOUT[t.category] ?? "",
          }))}
          total={PROJECTS.length}
        >
          {PRESS_HOME.length ? (
            <section
              aria-labelledby="press"
              className="flex shrink-0 flex-col items-center gap-4 border-t border-border px-6 py-5 sm:flex-row sm:justify-center sm:gap-10 sm:px-8 lying:gap-5 lying:py-2.5"
            >
              <h2 id="press" className="label shrink-0 text-muted-foreground">
                Published &amp; commissioned by
              </h2>
              <ClientMarks clients={PRESS_HOME} layout="row" className="max-sm:hidden" />
              {/* Julian: on a phone, one line that scrolls, as on the About
                  page (`about-marquee` in `globals.css`): the list twice,
                  the second out of reach of keys and readers. */}
              <div className="about-marquee w-full sm:hidden">
                <div className="about-marquee-track">
                  <ClientMarks clients={PRESS_HOME} layout="row" className="about-marquee-list" />
                  <div inert aria-hidden>
                    <ClientMarks clients={PRESS_HOME} layout="row" className="about-marquee-list" />
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </ServicesScreen>

        <Testimonials cells />

        {/* Julian: About, Sessions and Contact on the homepage, before
            the ask, which stays last. /about and /contact redirect here.
            About before Sessions (Julian, 2026-10-04), as in the bar.
            Each session shows the sample /sessions shows. */}
        <AboutScreen />
        <SessionsScreen
          sessions={SESSION_TYPES.map((s, i) => {
            const sample = SAMPLES[i];
            return {
              slug: s.slug,
              name: s.name,
              rate: formatPrice(s.from),
              turnaround: s.turnaround,
              blurb: s.blurb,
              includes: s.includes,
              cover: sample ? sample.cover : null,
              page: pageForSession(s.slug) && `/${pageForSession(s.slug)!.slug}`,
              pageTitle: pageForSession(s.slug)?.h1,
            };
          })}
        />
        {/* Julian (2026-10-03): the wall behind Inquire, where it was
            behind the last screen's doors, and none of it a picture the
            page already shows. */}
        <ContactScreen backdrop={<InquireWall items={WALL_HERE} />} />

        {/* Julian: merge these, there is too much white space. The ask and
            the two doors were two screens of mostly paper asking the same
            thing, with the second repeating the first's "See the work".
            One screen: the question on the left, and on the right the two
            audiences split — an art director and somebody pricing a
            graduation shoot each get one obvious door, which is the fix
            for the old site's thirteen-item dropdown maze.

            `#where-next` still resolves: the strip finds the cell holding
            whatever the address names, and that id is on the doors. */}
        <EnquiryCell
          title="Have something in mind?"
          body="Tell me what you have in mind and I'll come back with an approach and a quote."
          next={WORK_PAGE}
          className="screen-measure border-l border-border"
          /* Julian: the photo wall on the last page, as on the intro and
             the 404. Behind the ask and the two doors, dimmed so both
             still read; the doors are frosted glass over it. Each tile a way into
             its project, as on the 404. Four dozen, which covers the widest
             screen (`intro.tsx` has the arithmetic). */
          aside={
            /* Julian (2026-10-01, layout): the two doors split the screen
               under the bar, not behind it. The bar (`--bar-h`) lies over the
               first, so the first row is half the screen plus half the bar
               and each door shows the same height. */
            <div
              id="where-next"
              className="grid h-full grid-rows-2 divide-y divide-border sm:grid-rows-[minmax(0,calc(50%+var(--bar-h)/2))_minmax(0,1fr)]"
            >
              <PathCard
                photo={DOOR_WORK}
                photoAt="50% 0%"
                href="/portfolio"
                title="See the work"
                body="Editorial, campaigns, portraits, and artist imagery."
              />
              <SessionsDoor photo={DOOR_SESSIONS} />
            </div>
          }
        />
        {/* The window into the work (`lead-window.tsx`). */}
        <LeadWindow
          // Three fill the strip; a screen of the rack takes up to sixteen.
          covers={LEAD.map(indexRow)}
        />
      </Strip>
    </StripPage>
  );
}

/* The second door, forward rather than back (audit, 2026-10-03): it sent
   a private client back to Sessions, a screen behind them with Sessions in
   the bar as well. Each session straight to its own booking page instead. */
function SessionsDoor({ photo }: { photo?: Frame }) {
  return (
    <div className="group relative isolate flex flex-col justify-center gap-6 overflow-hidden border-l border-border bg-background/30 px-6 py-12 backdrop-blur-[var(--door-blur,1px)] sm:px-16 lying:gap-3 lying:px-10 lying:py-3">
      <DoorPhoto photo={photo} />
      <h3 className="title lying:[--text-title:1.75rem]">Book a session</h3>
      <ul className="max-w-sm border-t border-border">
        {SESSION_TYPES.map((s) => {
          const page = pageForSession(s.slug);
          return (
            <li key={s.slug} className="border-b border-border">
              <Link
                prefetch={false}
                href={page ? `/${page.slug}` : "/#sessions"}
                className="group label flex items-center justify-between gap-4 py-3 text-foreground lying:py-1.5"
              >
                {s.name}
                <span
                  aria-hidden
                  className="transition-transform duration-300 ease-[var(--ease-out-strong)] hoverable:group-hover:translate-x-1 motion-reduce:transition-none"
                >
                  &rarr;
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* The door's photograph, held back so its words read over it. */
function DoorPhoto({ photo, at = "50% 25%" }: { photo?: Frame; at?: string }) {
  if (!photo) return null;
  return (
    <>
      <Image
        src={photo.src}
        alt=""
        fill
        sizes="(min-width: 640px) 50vw, 100vw"
        className="door-photo -z-20 object-cover"
        style={{ backgroundColor: photo.color, objectPosition: at }}
      />
      <span aria-hidden className="door-veil absolute inset-0 -z-10" />
    </>
  );
}

function PathCard({
  href,
  title,
  body,
  photo,
  photoAt,
}: {
  href: string;
  title: string;
  body: string;
  photo?: Frame;
  /** Where the crop sits, as object-position. */
  photoAt?: string;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      // Centred rather than stretched top to bottom: half a screen each is
      // more room than two short paragraphs need, and a block pinned to the
      // top with its way out pinned to the bottom reads as a page that
      // failed to load the middle.
      /* Julian: the wall runs on behind the doors, seen rather than
         frosted over: a 30% tint for the type and 6px of blur, not the
         site's glass. */
      className="group relative isolate flex flex-col justify-center gap-6 overflow-hidden border-l border-border bg-background/30 px-6 py-12 backdrop-blur-[var(--door-blur,1px)] transition-colors duration-300 hoverable:hover:bg-background/45 sm:px-16 sm:first:pt-[calc(3rem+var(--bar-h))] lying:gap-3 lying:px-10 lying:py-3 lying:first:pt-16"
    >
      <DoorPhoto photo={photo} at={photoAt} />
      <div>
        {/* Julian: no audience line over the title, on any screen. */}
        <h3 className="title lying:[--text-title:1.75rem]">{title}</h3>
        {/* A phone on its side has the height for the door, not its
            description. */}
        <p className="mt-4 max-w-sm text-left text-sm normal-case leading-relaxed text-muted-foreground lying:hidden">
          {body}
        </p>
      </div>

      <span className="label inline-flex items-center gap-2 text-foreground">
        View
        <span
          aria-hidden
          className="transition-transform duration-300 ease-[var(--ease-out-strong)] hoverable:group-hover:translate-x-1 motion-reduce:transition-none"
        >
          &rarr;
        </span>
      </span>
    </Link>
  );
}
