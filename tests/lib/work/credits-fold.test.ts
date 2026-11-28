import { expect, test } from "vitest";
import { creditsFold } from "@/lib/work/credits-fold";

const c = (...roles: string[]) => roles.map((role) => ({ role, name: role }));
const roles = (list: { role: string }[]) => list.map((x) => x.role);

test("four or fewer show in full, nothing folded", () => {
  const four = c("In frame", "Styling", "Wardrobe", "Photo");
  const f = creditsFold(four);
  expect(f.shown).toBe(four);
  expect(f.folded).toEqual([]);
  expect(f.last).toBeNull();
  expect(creditsFold([]).shown).toEqual([]);
});

test("seven credits: the model, two more, the rest folded, the photo credit last", () => {
  const f = creditsFold(c("Model", "Stylist", "Lighting", "BTS", "Creative direction", "Hair and makeup", "Photo"));
  expect(roles(f.shown)).toEqual(["Model", "Stylist", "Lighting"]);
  expect(roles(f.folded)).toEqual(["BTS", "Creative direction", "Hair and makeup"]);
  expect(f.last?.role).toBe("Photo");
});

test("the model leads wherever it sits in the list; In frame counts", () => {
  const f = creditsFold(c("Styling", "Grip", "In frame", "BTS", "Photographer"));
  expect(roles(f.shown)).toEqual(["In frame", "Styling", "Grip"]);
  expect(roles(f.folded)).toEqual(["BTS"]);
});

test("with no model the first credit leads", () => {
  const f = creditsFold(c("Client", "Design", "3D", "Video", "Producer", "Photographer"));
  expect(roles(f.shown)).toEqual(["Client", "Design", "3D"]);
  expect(roles(f.folded)).toEqual(["Video", "Producer"]);
});

test("every credit is somewhere, once", () => {
  const all = c("Model", "Model", "Styling", "Hair & makeup", "Assistant", "Photographer");
  const f = creditsFold(all);
  expect([...f.shown, ...f.folded, f.last].length).toBe(all.length);
});
