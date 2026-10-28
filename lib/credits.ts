import type { Credit } from "./work-types";

/* The one list of credit roles. The harvested site and years of hand edits left 79 spellings of
   about 40 jobs; a role outside this list fails lib/credits.test.ts. Compound labels split into one
   credit per job, so a person who styled and did makeup is listed once under each. */
const SPLIT: Record<string, string[]> = {
  "mua & styling": ["Styling", "Hair & makeup"], "styling & hmua": ["Styling", "Hair & makeup"], "hmua & styling": ["Styling", "Hair & makeup"],
  "styling & makeup": ["Styling", "Hair & makeup"], "makeup, hair & styling": ["Styling", "Hair & makeup"],
  "muse and styling": ["Muse", "Styling"], "talent and styling": ["Model", "Styling"], "model & stylist": ["Model", "Styling"], "model & styling": ["Model", "Styling"],
  "model and makeup": ["Model", "Hair & makeup"], "creative direction and photography": ["Creative direction", "Photographer"],
  "creative direction & photography": ["Creative direction", "Photographer"], "creative direction & model": ["Creative direction", "Model"],
  "creative direction and styling": ["Creative direction", "Styling"], "art direction and styling": ["Art direction", "Styling"], "art direction & styling": ["Art direction", "Styling"],
  "photo and assist": ["Photographer", "Assistant"], "bts and assist": ["BTS", "Assistant"], "assist & second shooter": ["Assistant", "Second shooter"],
  "wardrobe/assist": ["Wardrobe", "Assistant"], "1st ad & hmua": ["1st AD", "Hair & makeup"],
};
const ONE: Record<string, string> = {
  assist: "Assistant", "photo assist": "Assistant", "photo assistant": "Assistant", "light assist": "Lighting assistant",
  "styling assist": "Styling assistant", "styling assistant": "Styling assistant", "stylist assistant": "Styling assistant",
  stylist: "Styling", "lead stylist": "Styling", designer: "Design", brand: "Client", talent: "Model",
  hmua: "Hair & makeup", makeup: "Hair & makeup", hair: "Hair & makeup", "hair and makeup": "Hair & makeup", "hair & makeup artist": "Hair & makeup",
  "art director": "Art direction", "creative director": "Creative direction", director: "Direction", dress: "Wardrobe", garments: "Wardrobe",
  "bts photographer": "BTS", "cg artist": "3D", "3d artist": "3D", "key grip": "Grip", "creative producer": "Producer",
};
export const CANON = new Set([
  "Photographer", "Photo", "Direction", "Creative direction", "Art direction", "Model", "Muse", "Styling", "Styling assistant", "Hair & makeup", "Wardrobe",
  "Assistant", "Lighting assistant", "Second shooter", "BTS", "Video", "Cinematographer", "Lighting", "Gaffer", "Grip", "DIT", "PA", "Producer", "Production",
  "1st AD", "Studio", "Client", "Design", "Set design", "3D", "Artist", "Archive", "In frame", "CRT tech", "Retouching", "Poster editor", "Mask design", "GFX", "Projected image",
]);

/** Roles a credit becomes: its own when already canonical, else the mapped one(s). Unknown labels pass through for the test to flag. */
export const rolesFor = (role: string): string[] => {
  const k = role.trim().toLowerCase();
  const hit = [...CANON].find((r) => r.toLowerCase() === k);
  return hit ? [hit] : SPLIT[k] ?? (ONE[k] ? [ONE[k]] : [role]);
};

/** Julian's own credit is shown as "Photo: @juliangigola" on purpose. */
export const isOwn = (c: Credit) => /^@?juliangigola$/.test(c.name) || c.instagram === "juliangigola";
/** A name that is really an Instagram handle. */
export const isHandle = (n: string) => /^@/.test(n) || /^[a-z0-9._]+$/.test(n);
