/* JG V3 (DESIGN.md "Photos"): what each screen shows, per theme.
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
export const DOORS = {
  commissions: { d: w("stratus-lookbook-vol-1", "12"), l: w("undisputed", "10") },
  book: { d: w("places", "12"), l: w("paradox", "02") },
};
export const CALL_CARD = { d: w("channel-orange", "01"), l: w("second-skin", "13") };
export const ABOUT_PHOTO = "/about/julian-steps.jpg";
