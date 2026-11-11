/* The installed Leads app's iPhone and iPad startup screens: black, the app
 * icon in the middle. iOS shows one only when its size matches the device
 * exactly, so there is one per screen size, portrait.
 * shortcut: portrait only; add landscape if the app is opened sideways on an iPad.
 * Regenerate the PNGs with `node scripts/leads-startup.mjs`. */

/** [CSS width, CSS height, pixel ratio] */
export const STARTUP_SCREENS: [number, number, number][] = [
  [440, 956, 3], // iPhone 16 Pro Max
  [402, 874, 3], // iPhone 16 Pro
  [430, 932, 3], // iPhone 15/16 Plus, 14/15 Pro Max
  [393, 852, 3], // iPhone 14 Pro, 15, 15 Pro, 16
  [428, 926, 3], // iPhone 12/13 Pro Max, 14 Plus
  [390, 844, 3], // iPhone 12, 13, 14, 12/13 Pro
  [375, 812, 3], // iPhone X, XS, 11 Pro, 12/13 mini
  [414, 896, 3], // iPhone XS Max, 11 Pro Max
  [414, 896, 2], // iPhone XR, 11
  [375, 667, 2], // iPhone SE, 8
  [1032, 1376, 2], // iPad Pro 13 (M4)
  [1024, 1366, 2], // iPad Pro 12.9
  [834, 1210, 2], // iPad Pro 11 (M4)
  [834, 1194, 2], // iPad Pro 11
  [820, 1180, 2], // iPad Air, iPad 10th
  [810, 1080, 2], // iPad 9th
  [768, 1024, 2], // iPad mini 5, older iPads
  [744, 1133, 2], // iPad mini 6+
];

export const startupFile = ([w, h, r]: [number, number, number]) => `/leads-app/startup/${w * r}x${h * r}.png`;

export const startupImages = STARTUP_SCREENS.map((s) => ({
  url: startupFile(s),
  media: `(device-width: ${s[0]}px) and (device-height: ${s[1]}px) and (-webkit-device-pixel-ratio: ${s[2]}) and (orientation: portrait)`,
}));
