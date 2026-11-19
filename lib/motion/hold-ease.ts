/* A held row's travel through its hold: it eases away from its first item and into its last (0.4 of the scroll's speed at the two ends). */
export const holdEase = (p: number) => p - (0.6 * Math.sin(2 * Math.PI * p)) / (2 * Math.PI);
/** the scroll share at which `holdEase` reaches v (it only rises, so halving finds it) */
export const holdUnease = (v: number) => {
  let a = 0, b = 1;
  for (let k = 0; k < 20; k++) if (holdEase((a + b) / 2) < v) a = (a + b) / 2; else b = (a + b) / 2;
  return (a + b) / 2;
};
