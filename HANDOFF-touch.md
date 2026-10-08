# Handoff: iPad / iPhone touch work (branch `cards-touch`)

Written 2026-10-08 on the Windows PC, to continue on the MacBook. Nothing here is live. Ships only when Julian says "push" or "ship it" (merge to main deploys via Workers Builds). **Delete this file from the branch before merging.**

## Done on this branch (built and checked on a local prod build at iPad Safari heights 1194x744 / 834x1100)

- **Portfolio strip no longer jumps back to a section start.** `components/strip.tsx`: the `#hash` aim is read once on arrival (`arrived` ref), not again when `count` changes.
- **Portfolio grid on an upright iPad is a vertical "sheet".** Covers about 369x461 (were 240x300). `useTablet()` + `sheet = grid && tablet` in `strip.tsx` turns off the deck, the rack pairing and the sideways machine; CSS under `.strip-grid[data-sheet]` in `app/globals.css`.
- **iPad landscape portfolio grid stays the sideways rack**, whole columns fitted (`work-shell.tsx` rack-fit effect, media query includes landscape).
- **iPad landscape header:** slimmer bar (~52px), 13px nav links, logo 1.75rem. Filter chips replaced by a drop-down (`.filter-trigger`, `.work-filter` glass panel, 3-column list).
- **iPad both orientations:** the filter button sits in the title row, left of the grid/strip toggle (`.head-glass` grid, `.filter-row`). Projects start at y≈133.
- **Upright iPad home hero shows the navbar logo** (`.home-wordmark`).
- **Inquiries on iPad:** landscape card fills the screen, message box takes the room, no inner scroll at heights 744/700/660; words column centered vertically. Portrait: text on top in two columns, form under it.
- **Commissions on a touch tablet: two taps.** First tap on a discipline shows its photos, second opens it in the portfolio (`components/services-screen.tsx`, `touched` ref; focus from touch ignored).

All of the CSS is in tablet media blocks: `(pointer: coarse) and (min-width: 40rem)` plus `orientation`.

## Next, in Julian's order

1. **Home screen swipe should feel like Safari.** The home page is one screen at a time sideways; the machine is in `components/strip.tsx` (see the "One screen at a time" prop around line 516, `SWIPE_LOCK = 380` around line 2182, and the `?swipe` preview flag around line 231). Problem from Julian's iPad recording: a swipe glides, stalls, then lurches to a screen; the next page comes in awkwardly. Plan (apple-design skill):
   - Prefer native `scroll-snap-type: x mandatory` + `scroll-snap-stop: always` on touch, so iOS gives its own momentum and rubber band. Drop the JS lock on touch if native snap holds one-screen-per-swipe.
   - If JS has to stay: track the finger 1:1, project the landing with velocity (`v/1000 * 0.998/(1-0.998)`), pick one screen from that, spring there with the release velocity, damping 1.0 (0.8 only after a flick), interruptible from the live position.
   - Put it behind a `?swipe2` flag until Julian approves. Big motion changes are never swapped in unasked.
2. **Same for the portfolio strip.**
3. **Ghost title on the portfolio** (UNDISPUTED with "-CAINE" painted over it on the iPad). Unresolved. Asked Julian to compare `?swipe&debug` vs `?debug`. Suspect iOS compositing. With the Mac, attach Safari Web Inspector to the real iPad and inspect the layers live.
4. Later: iPhone, MacBook, desktop and small-screen passes. Small: portrait Inquiries "Available to / Travel" wraps an orphan.

## Rules that apply (from Julian's profile)

- Touch, iPad or motion bugs: get a screen recording first, tile it with ffmpeg, ask "finger down or after lift". No fixes on reasoning alone.
- No em dashes anywhere. Short plain sentences.
- Never submit the contact form. Never print keys or tokens.
- Commit only real files. Debug helpers stay out (see below).

## Mac setup

```bash
git clone https://github.com/gigolajulian/juliangigola-com.git && cd juliangigola-com
git checkout cards-touch
npm ci
NEXT_PUBLIC_IMAGE_CDN=0 npx next build
npx next start -H 0.0.0.0 -p 3008
```

`NEXT_PUBLIC_IMAGE_CDN=0` is required or every photo 404s locally.

**iOS Simulator (real mobile Safari engine):** install Xcode, then

```bash
xcrun simctl boot "iPad Pro 11-inch (M4)"
open -a Simulator
xcrun simctl openurl booted http://localhost:3008
xcrun simctl io booted recordVideo ~/Desktop/sim.mov
```

Drags in the Simulator are mouse drags: close to an iPad, not exact. Final feel needs Julian's finger.

**Real iPad over USB:** iPad Settings > Apps > Safari > Advanced > Web Inspector on. Mac Safari > Settings > Advanced > "Show features for web developers". Then Develop menu > the iPad > the tab. Console, layers and JS on the live device.

**Real iPad over Wi-Fi (http on the LAN):** the production headers force https (`upgrade-insecure-requests` and HSTS in `next.config.ts`). On the PC this was worked around with an uncommitted gate: when `NEXT_PUBLIC_TOUCH_DEBUG=1`, drop `upgrade-insecure-requests` from the CSP and drop the `Strict-Transport-Security` header, and add `allowedDevOrigins: ["<mac LAN ip>"]`. Reapply locally if needed; never commit it.

## Not in the branch (PC only, uncommitted on purpose)

- `components/touch-debug.tsx` + `app/api/debug-log/route.ts` + its mount in `app/layout.tsx`: an on-screen touch log for the iPad, built with `NEXT_PUBLIC_TOUCH_DEBUG=1`. Safari Web Inspector replaces it on the Mac.
- The `next.config.ts` http gate above.
