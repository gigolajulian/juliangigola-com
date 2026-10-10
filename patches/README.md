# Patches

Changes to packages in `node_modules`, applied by `patch-package` on every
`npm install` (the `postinstall` script). Each patch has an owner and a
reason here. A patch with no entry here is not allowed.

## liquid-gooey+0.2.2.patch

- **Owner:** Julian Gigola. The site keeps this patch; nobody upstream does.
- **Package:** `liquid-gooey` 0.2.2, pinned exactly in `package.json`. The
  patch is written against `dist/index.js` and `dist/index.cjs` of that
  version only.
- **What it changes:** `ObserveEngine`, the loop that measures every liquid
  item each frame.
  - A scroll pauses the loop. It wakes 150ms after the last scroll event.
    The items scroll with their group, so there is nothing to re-measure.
  - A group off screen does not run. An `IntersectionObserver` on the group
    sets `visible`.
  - The idle check runs once a second instead of every 300ms, and skips a
    hidden tab, a scroll in progress and a group off screen.
- **Why:** measuring every item on every frame of a swipe forced a layout a
  frame on the strips. The buttons in liquid (`liquid-pair.tsx`) run on
  this engine. The rail's drop no longer does (`RailFollow`,
  `strip/rail.tsx`).
- **Check:** `lib/liquid-gooey-patch.test.ts` fails if the patch is not in
  `node_modules`, so `npm test` catches an install that skipped it.

### Upgrading liquid-gooey

1. Read the new version's `ObserveEngine`. If it already pauses on scroll
   and off screen, delete the patch and its test.
2. Otherwise set the new version in `package.json`, run `npm install`, and
   redo the edit by hand in both `dist` files.
3. Run `npx patch-package liquid-gooey` to write the new patch, delete the
   old one and update this entry and the version in the test.
