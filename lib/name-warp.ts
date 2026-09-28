/** Julian's look for his name in `WarpText`, set by hand on the `?tune`
    sliders (`warp-tuner.tsx`): the cover's name and the header's logo share
    it. The color split is raised from his 0.011 to 0.03 at his request. A
    plain module, not the client component's, so the cover (a server
    component) gets the values rather than a client reference. */
export const NAME_WARP = {
  warpStrength: 0.28,
  warpScale: 0.6,
  speed: 0.8,
  pointerInfluence: 1.25,
  // Julian: lower the hover on the name, and the swipe with it (0.87).
  pointerStrength: 0.6,
  refraction: 0.03,
  ripple: 1.65,
} as const;
