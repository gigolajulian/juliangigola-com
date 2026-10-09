# Decisions

Dated decisions about how the site is built, and why. Newest first.

## 2026-10-09: The liquid-gooey patch stays a patch, owned here

`liquid-gooey` 0.2.2 is patched so its `ObserveEngine` rests while the page
scrolls and while its group is off screen (`patches/liquid-gooey+0.2.2.patch`).

- **Chosen:** keep `patch-package`. Julian owns the patch. `patches/README.md`
  says what it changes, why, and how to redo it on an upgrade. The version
  is pinned exactly, and `lib/liquid-gooey-patch.test.ts` fails if the patch
  is missing from `node_modules`.
- **Not chosen:** vendoring the package into `lib/vendor/`. It would copy
  about 2,500 lines of built code into the repo to change about 30. The
  patch shows exactly what the site changed, and the test fails when the
  package moves under it.
- **Not done:** sending the fix upstream. That is Julian's call.

## 2026-10-09: globals.css split by area; device queries listed, not custom media

`app/globals.css` is now a list of imports from `app/styles/`, in the order
the rules had in one file, so the cascade is unchanged.

- Device queries are written out in each file, with one commented list at
  the top of `globals.css`. `@custom-media` was tried: Tailwind 4 resolves it
  only in its production pass (Lightning CSS with `optimize`), so under
  `next dev` the browser gets `@media (--name)` and matches nothing.
- Each file is a run of whole sections in their original order. Some areas
  (booking, phone and iPad passes) are still spread over more than one file,
  because moving a rule past another one can change which wins.
