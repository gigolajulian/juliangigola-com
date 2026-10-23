/* JG V3 (master v39, DESIGN.md "Photos"): what each screen shows, per theme.
   Dark is the hard-light set; light is a second, brighter set. Paths under
   `public/`. Names are the captions the master prints. */

export type Shot = { src: string; name: string; meta?: string };
export type Pair = { d: Shot; l: Shot };

const w = (slug: string, n: string) => `/work/${slug}/${n}.jpg`;

export const HERO: Pair[] = [
  { d: { src: w("diesel", "03"), name: "Diesel" }, l: { src: w("valgur", "06"), name: "VALGUR 06" } },
  { d: { src: w("valgur", "06"), name: "Valgur" }, l: { src: w("places", "02"), name: "PLACES 02" } },
  { d: { src: w("wild-and-unapologetic", "06"), name: "Wild and Unapologetic" }, l: { src: w("weddings", "01"), name: "WEDDINGS 01" } },
  { d: { src: w("hua", "11"), name: "Hua" }, l: { src: "/v3/novocaine-16.jpg", name: "NOVOCAINE 16" } },
];
export const HERO_ALT = ["Diesel 03", "Valgur: two knights and a lightning strike", "Wild and Unapologetic 06", "Hua 11"];

/* Three columns of two, each drifting at its own speed. */
export const RECENT: { speed: number; shots: Pair[] }[] = [
  {
    speed: -0.06,
    shots: [
      { d: { src: w("valgur", "02"), name: "Valgur 02", meta: "Artist presskit" }, l: { src: w("paradox", "01"), name: "Paradox 01", meta: "Campaigns" } },
      { d: { src: "/hero/nyx-06.jpg", name: "Nyx 06", meta: "Editorial" }, l: { src: w("iris", "07"), name: "Iris 07", meta: "Artist presskit" } },
    ],
  },
  {
    speed: 0.1,
    shots: [
      { d: { src: w("i-wanna-be-a-human", "01"), name: "I Wanna Be A Human 01", meta: "Editorial" }, l: { src: w("i-wanna-be-a-human", "01"), name: "I Wanna Be A Human 01", meta: "Editorial" } },
      { d: { src: w("oakley-x-nike", "01"), name: "Oakley x Nike 01", meta: "Campaigns" }, l: { src: w("undisputed", "04"), name: "Undisputed 04", meta: "Editorial" } },
    ],
  },
  {
    speed: 0.02,
    shots: [
      { d: { src: w("liminal", "01"), name: "Liminal 01", meta: "Chroma" }, l: { src: w("ukiyosunknown", "01"), name: "Ukiyosunknown 01", meta: "Campaigns" } },
      { d: { src: w("novocaine", "04"), name: "Novocaine 04", meta: "Editorial" }, l: { src: w("aegis", "03"), name: "Aegis 03", meta: "Editorial" } },
    ],
  },
];

export const COMMISSIONS: Pair[] = [
  { d: { src: w("cyber1a", "01"), name: "Cyber1a 01", meta: "Artist presskit" }, l: { src: w("relay", "09"), name: "Relay 09", meta: "Editorial" } },
  { d: { src: w("ghostlight", "05"), name: "Ghostlight 05" }, l: { src: w("azure-bloom", "08"), name: "Azure Bloom 08" } },
  { d: { src: w("paranoia", "13"), name: "Paranoia 13" }, l: { src: w("paradox", "02"), name: "Paradox 02" } },
  { d: { src: w("vigil", "05"), name: "Vigil 05" }, l: { src: w("byte-me", "17"), name: "Byte Me 17" } },
  { d: { src: w("events", "01"), name: "Events 01" }, l: { src: w("ukiyosunknown", "01"), name: "Ukiyosunknown 01" } },
  { d: { src: w("true-grit", "01"), name: "True Grit 01" }, l: { src: w("graduation", "01"), name: "Graduation 01" } },
  { d: { src: w("vendetta", "11"), name: "Vendetta 11" }, l: { src: w("goodcult", "01"), name: "Goodcult 01" } },
  { d: { src: w("celestis", "03"), name: "Celestis 03" }, l: { src: w("i-wanna-be-a-human", "06"), name: "I Wanna Be A Human 06" } },
  { d: { src: w("gilt", "01"), name: "Gilt 01" }, l: { src: w("sago", "01"), name: "Sago 01" } },
];
export const COMMISSION_TABS = ["All", "Campaigns", "Presskits", "Editorial", "Portraits", "Mixed media", "Cover art", "Motion"];

export const DOORS = {
  commissions: { d: w("stratus-lookbook-vol-1", "12"), l: w("undisputed", "10") },
  book: { d: w("places", "12"), l: w("paradox", "02") },
};
export const CALL_CARD = { d: w("channel-orange", "01"), l: w("second-skin", "13") };
export const ABOUT_PHOTO = "/about/julian-steps.jpg";

/* ── sessions (master SESS; deposit list from lib/paid.ts) ── */
export type SessionSlug = "portraits" | "headshots" | "studio-digitals" | "graduation" | "weddings" | "consultation";
export type Session = {
  slug: SessionSlug;
  name: string;
  blurb?: string;
  from: number | null;
  includes: string[];
  turnaround?: string;
  /** Cal.com "username/event-slug"; none for an on-request session. */
  cal?: string;
  /** Takes the $100 deposit (`lib/paid.ts`). */
  paid: boolean;
  photo: { d: string; l: string };
};

export const SESSIONS: Record<SessionSlug, Session> = {
  portraits: {
    slug: "portraits",
    name: "Portraits",
    blurb: "One hour with direction, lighting and edited selects. Studio located in San Jose, available to travel across the SF Bay Area.",
    from: null,
    includes: ["One hour, studio or location", "Two looks", "Retouched selects", "Crops for web and print"],
    turnaround: "1 week",
    cal: "juliangigola/portraits",
    paid: true,
    photo: { d: w("sonder", "05"), l: w("serif", "03") },
  },
  graduation: {
    slug: "graduation",
    name: "Graduation",
    blurb: "Cap and gown, on campus or in studio. Enough coverage for the family frame and the announcement. Studio located in San Jose, available to travel across the SF Bay Area. On campus at SJSU or SCU; a travel fee applies further out.",
    from: 400,
    includes: ["90 minutes on location", "Two outfit changes", "Edited gallery", "Print release"],
    turnaround: "1 week",
    cal: "juliangigola/graduation",
    paid: true,
    photo: { d: "/work/graduation/cover.jpg", l: w("graduation", "06") },
  },
  headshots: {
    slug: "headshots",
    name: "Headshots",
    blurb: "Clean, current and usable everywhere: LinkedIn, press, casting, a company about page. Studio located in San Jose, available to travel across the SF Bay Area.",
    from: null,
    includes: ["Studio lighting", "Multiple backgrounds", "Retouched selects", "Crops for web and print"],
    turnaround: "3 days",
    cal: "juliangigola/headshots",
    paid: true,
    photo: { d: "/v3/headshots-cover.jpg", l: "/v3/headshots-03.jpg" },
  },
  "studio-digitals": {
    slug: "studio-digitals",
    name: "Studio digitals",
    blurb: "Agency-standard digitals: clean light, no retouching, accurate to how you actually look. Studio located in San Jose.",
    from: 250,
    includes: ["Full length, three-quarter and close", "Front and profile", "Unretouched, as agencies require"],
    turnaround: "2 days",
    cal: "juliangigola/digitals",
    paid: true,
    photo: { d: w("abril", "03"), l: w("abril", "03") },
  },
  weddings: {
    slug: "weddings",
    name: "Weddings",
    blurb: "Coverage that reads as editorial rather than as a wedding album. Limited dates each year.",
    from: null,
    includes: ["Full-day coverage", "Second shooter available", "Edited gallery", "Print release"],
    turnaround: "4 weeks",
    paid: false,
    photo: { d: w("weddings", "02"), l: w("weddings", "07") },
  },
  consultation: {
    slug: "consultation",
    name: "Consultation",
    from: null,
    includes: ["Phone or video", "Dates and references"],
    cal: "juliangigola/consultation",
    paid: false,
    /* The master's call card shows the About portrait. */
    photo: { d: ABOUT_PHOTO, l: ABOUT_PHOTO },
  },
};
/** The session tabs' order (DESIGN.md, Stepper). */
export const TAB_ORDER: SessionSlug[] = ["portraits", "headshots", "studio-digitals", "graduation", "weddings", "consultation"];
/** The homepage index and the doors' order. */
export const INDEX_ORDER: SessionSlug[] = ["portraits", "graduation", "headshots", "studio-digitals", "weddings"];
export const rate = (s: Session) =>
  s.slug === "consultation" ? "15 min" : s.from != null ? `From $${s.from}` : s.paid ? "$100 deposit" : "On request";
/** Session lengths in minutes (master MIN); Cal.com's own length wins where it answers. */
export const LENGTH: Record<SessionSlug, number> = { portraits: 60, graduation: 90, headshots: 45, "studio-digitals": 60, weddings: 480, consultation: 15 };
