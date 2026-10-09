# Decisions

Dated decisions about how the site is built, and why. Newest first.

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
