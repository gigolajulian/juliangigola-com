import { EVENTS } from "@/lib/booking/rules";
import { depositFor, takesDeposit } from "@/lib/leads/deposit-terms";
import { ABOUT_PHOTO } from "@/lib/photos";
import { CONTENT, type SessionType } from "@/lib/content";

export type { SessionType };

/** The sessions as /admin sets them (`content/site.json`), in its order; it may list one the catalog below does not.
    `from` stays null until a price is set there. */
export const SESSION_TYPES: SessionType[] = CONTENT.sessions;

/** A starting price as the service pages and the structured data print it: null is "On request".
    The session cards print `priceLabel` instead, which reads differently (no thousands comma, a call's length, a deposit). */
export const formatPrice = (from: number | null): string => (from === null ? "On request" : `From $${from.toLocaleString("en-US")}`);

const w = (slug: string, n: string) => `/work/${slug}/${n}.jpg`;

/* ── the session catalog: what /book, the homepage and the service pages offer (deposits from lib/leads/deposit-terms.ts) ── */
export type SessionSlug =
  | "portraits"
  | "headshots"
  | "studio-digitals"
  | "model-test"
  | "graduation"
  | "weddings"
  | "consultation"
  | "music-photography"
  | "fashion-photography"
  | "brand-photography"
  | "editorial"
  | "events";
export type Session = {
  slug: SessionSlug;
  name: string;
  blurb?: string;
  from: number | null;
  includes: string[];
  turnaround?: string;
  /** The event it books, "juliangigola/event-slug" (a stored key; the slug keys `EVENTS`); none for an on-request session. */
  cal?: string;
  /** Takes a deposit: its event is in `DEPOSIT_SESSIONS` (`lib/leads/deposit-terms.ts`). */
  paid: boolean;
  /** `m`: a horizontal frame for the phone banner, where the tall one crops badly.
      `at`: where the phone and portrait-tablet banner sits on each frame (an
      object-position), where the middle cuts the heads off. */
  photo: { d: string; l: string; m?: string; desk?: string; at?: { d?: string; l?: string } };
  /** The enquiry type an on-request booking posts (`lib/leads/enquiry.ts`); "session" when unset. */
  type?: string;
};

const LISTED: Record<SessionSlug, Omit<Session, "paid">> = {
  portraits: {
    slug: "portraits",
    name: "Portraits",
    blurb: "One hour with direction, lighting and edited selects. My studio is in San Jose, and I travel across the Bay Area.",
    from: null,
    includes: ["One hour, studio or location", "Two looks", "Retouched selects", "Crops for web and print"],
    turnaround: "1 week",
    cal: "juliangigola/portraits",
    // SIAN 01, Julian's pick for the Portraits booking card. Was ZOE 16.
    // Desktop gets sian/01 with 200px of her own backdrop added on top, so her face sits at the panel's middle.
    photo: { d: w("sian", "01"), l: w("sian", "01"), desk: "/v3/portraits-sian-tall.jpg", at: { d: "50% 5%", l: "50% 5%" } },
  },
  graduation: {
    slug: "graduation",
    name: "Graduation",
    blurb:
      "Cap and gown, on campus or in studio. Enough coverage for the family frame and the announcement. My studio is in San Jose, and I travel across the Bay Area. SJSU and SCU are included. A travel fee applies farther out.",
    from: 400,
    includes: ["90 minutes on location", "Two outfit changes", "Edited gallery", "Print release"],
    turnaround: "1 week",
    cal: "juliangigola/graduation",
    // Julian's picks, 2026-11-24: one main frame per session, the same in both themes.
    photo: { d: w("graduation", "01"), l: w("graduation", "01"), at: { d: "50% 15%", l: "50% 15%" } },
  },
  headshots: {
    slug: "headshots",
    name: "Headshots",
    blurb:
      "Clean, current and usable everywhere: LinkedIn, press, casting, a company about page. My studio is in San Jose, and I travel across the Bay Area.",
    from: 400,
    includes: ["Studio lighting", "Multiple backgrounds", "Retouched selects", "Crops for web and print"],
    turnaround: "3 business days",
    cal: "juliangigola/headshots",
    photo: { d: w("headshots", "04"), l: w("headshots", "04"), at: { d: "50% 30%", l: "50% 30%" } },
  },
  "studio-digitals": {
    slug: "studio-digitals",
    name: "Studio digitals",
    blurb: "Agency-standard digitals: clean light, no retouching, true to how you look. Studio located in San Jose.",
    from: 300,
    includes: ["Full length, three-quarter and close", "Front and profile", "Unretouched, as agencies require"],
    turnaround: "2 business days",
    cal: "juliangigola/digitals",
    photo: { d: w("abril", "03"), l: w("abril", "03"), at: { d: "50% 10%", l: "50% 10%" } },
  },
  /* The name, an hour, a week and the $100 deposit; the rate is quoted on the call. */
  "model-test": {
    slug: "model-test",
    name: "Model test",
    blurb: "One look, built with you.",
    from: null,
    includes: ["One hour", "Styled"],
    turnaround: "1 week",
    cal: "juliangigola/model-test",
    photo: { d: w("sonder", "01"), l: w("sonder", "01") },
  },
  weddings: {
    slug: "weddings",
    name: "Weddings",
    blurb: "Editorial coverage of the full day. Limited dates each year.",
    from: null,
    includes: ["Full-day coverage", "Second shooter available", "Edited gallery", "Print release"],
    turnaround: "4 weeks",
    photo: { d: w("weddings", "02"), l: w("weddings", "02") },
  },
  consultation: {
    slug: "consultation",
    name: "Consultation",
    from: null,
    includes: ["Phone or video", "Dates and references"],
    cal: "juliangigola/consultation",
    /* The call card shows the About portrait. */
    photo: { d: ABOUT_PHOTO, l: ABOUT_PHOTO, at: { d: "50% 85%", l: "50% 85%" } },
  },
  /* The commission calls and events (BOOK_MENU in `lib/booking/service-pages.ts`, same words),
     on the stepper but not in its tabs. */
  "music-photography": {
    slug: "music-photography",
    name: "Music & artists",
    blurb: "Press photos, cover art and music videos for a release, planned together so it reads as one thing.",
    from: null,
    includes: ["Phone or video", "Dates and references"],
    cal: "juliangigola/music-call",
    photo: { d: w("valgur", "02"), l: w("iris", "02"), at: { d: "50% 12%", l: "50% 40%" } },
  },
  "fashion-photography": {
    slug: "fashion-photography",
    name: "Fashion & Editorial",
    blurb: "Editorials, lookbooks and campaign images, shot and art-directed as one story.",
    from: null,
    includes: ["Book a phone or video call", "Dates and references"],
    cal: "juliangigola/editorial",
    photo: { d: w("i-wanna-be-a-human", "02"), l: w("i-wanna-be-a-human", "02") },
  },
  "brand-photography": {
    slug: "brand-photography",
    name: "Brand campaigns",
    blurb: "Campaign imagery, from concept and art direction to shoot and retouch.",
    from: null,
    includes: ["Phone or video", "Dates and references"],
    cal: "juliangigola/campaign",
    photo: { d: w("oakley-x-nike", "01"), l: w("paradox", "01") },
  },
  /* book.juliangigola.com/editorial's call, its words from the retired book page (`book/public/index.html`, in git history). */
  editorial: {
    slug: "editorial",
    name: "Editorial call",
    blurb: "Fifteen minutes about the idea, the team and the dates. I quote after the call.",
    from: null,
    includes: ["Phone or video", "Dates and references"],
    cal: "juliangigola/editorial",
    photo: { d: w("novocaine", "04"), l: w("novocaine", "04"), m: w("novocaine", "01") },
  },
  events: {
    slug: "events",
    name: "Event coverage",
    blurb: "Launches, brand events, concerts and parties, shot as they happen.",
    from: null,
    includes: [],
    photo: { d: w("events", "01"), l: w("events", "01") },
    type: "event",
  },
};
/** The event slug a session books ("digitals" for studio-digitals), or "". */
const eventOf = (s: { cal?: string }) => s.cal?.split("/")[1] ?? "";
// The price set in /admin (content/site.json) wins, so the home card and /book never disagree.
const ADMIN_FROM = new Map(SESSION_TYPES.map((t) => [t.slug, t.from]));
export const SESSIONS = Object.fromEntries(
  Object.entries(LISTED).map(([k, s]) => [
    k,
    { ...s, from: ADMIN_FROM.has(k) ? ADMIN_FROM.get(k)! : s.from, paid: takesDeposit(eventOf(s)) },
  ]),
) as Record<SessionSlug, Session>;
export const isSession = (s?: string): s is SessionSlug => !!s && Object.hasOwn(SESSIONS, s);
/** The session tabs' order (DESIGN.md, Stepper). */
export const TAB_ORDER: SessionSlug[] = [
  "portraits",
  "headshots",
  "studio-digitals",
  "model-test",
  "graduation",
  "weddings",
  "consultation",
];
/** The homepage index and the doors' order. */
export const INDEX_ORDER: SessionSlug[] = ["portraits", "graduation", "headshots", "studio-digitals", "weddings"];
export const priceLabel = (s: Session) =>
  !s.paid && s.cal ? "15 min" : s.from != null ? `From $${s.from}` : s.paid ? `$${depositFor(eventOf(s))} deposit` : "On request";
/** Session lengths in minutes: the event's own (`EVENTS`), or these where there is none or the stepper says otherwise.
    Where /api/slots answers, the event's length is the one booked. */
const OWN_LENGTH: Partial<Record<SessionSlug, number>> = {
  weddings: 480,
  events: 0,
};
export const LENGTH = Object.fromEntries(
  Object.values(SESSIONS).map((s) => [s.slug, OWN_LENGTH[s.slug] ?? EVENTS[eventOf(s)]?.length ?? 0]),
) as Record<SessionSlug, number>;
