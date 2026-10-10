# Decisions

Dated decisions about how the site is built, and why. Newest first. Code
comments say what the code does; who asked for a change, when, and what
it replaced belongs here.

## 2026-10-09: Preview flags from the implementation plan

Motion and booking changes from the plan ship behind a query flag. Each is
read once, on mount, from `location.search`. Without the flag the site
behaves as before. A flag becomes the default only after Julian has tried
it on his own devices.

| Flag | Plan item | What it turns on | Where |
| --- | --- | --- | --- |
| `?debug` | 0.3 | fps, finger dots and a frame log. Nothing loads without it. | `components/debug-gate.tsx`, `components/debug-overlay.tsx` |
| `?wall=slow` | 1.1 | On a screen 1600px wide or more, the Inquiries wall drifts at half speed with bigger tiles. | `components/inquire-wall.tsx` |
| `?wall=still` | 1.1 | The wall eases to a stop while the form is in use, and the beam rests. | `components/inquire-wall.tsx`, `components/contact-beam.tsx` |
| `?notch` | 1.4 | A mouse notch moves the strip by its own ease instead of Lenis. | `components/strip/shared.ts` |
| `?cal` | 2.1 | Cal.com's calendar in place of the Google Calendar frame, where an event is set in `CAL_EVENTS`. | `components/cal-embed.tsx`, `lib/booking.ts` |

Older previews still in the code: `?flyout`, `?menu3d`, `?deal`, `?cards`,
`?peek`, `?stack=0`, `?fly`, `?lenis=0`, `?intro` and `?arrange`. Their
history is in the entries below.

## 2026-10-09: Plan items blocked or left partial

Not shipped on `plan-impl`, and what each one waits for:

- **1.6 Ghost title on the portfolio.** Needs a session on Julian's iPad
  with Web Inspector. No fix is written without a reproduction.
- **2.3 Remove Google Calendar.** Waits for 2.1 (`?cal`) to run live for a
  week. `CAL_EVENTS` in `lib/booking.ts` is empty until Julian sets up the
  Cal.com events.
- **2.6 Sessions dark flash.** Needs an iPad or iPhone session with
  `?debug` to catch it. The upright iPad orphan word was fixed in 3.2.
- **5.2 Core Web Vitals in Cloudflare Web Analytics.** Needs the Cloudflare
  dashboard.
- **5.3 Booking pages' structured data after Cal.com.** Waits for 2.3.
- **5.4 Splash in real Safari.** Needs Safari's remote automation turned on
  for `scripts/perf/safari.mjs` (0.1).

Partial, with what is left:

- **1.2** The glide-back after a flick made mid-glide is fixed. The
  spontaneous case from Julian's logs, with no rail or key first, did not
  reproduce.
- **1.3** A cold load of Event coverage on an iPad still has a first-second
  frame of 170 to 194ms: the server's markup paints every cell first.
- **1.5** The strip and deck loops stop at rest. `warp-text.tsx` still runs
  a loop at rest on desktop.
- **3.4** Line-mode wheel notches and the `linear()` fallbacks were checked
  in Chrome and WebKit only. Playwright's Firefox would not launch here.
- **3.5** A sideways swipe that starts on the Biography or Inquiries
  scrolling box does not move the strip (`overscroll-contain` on those
  boxes).
- Local `npm run perf` runs in WebKit only, since Chromium and Firefox are
  not installed on this machine. CI installs all three.

## 2026-10-09: One module for device queries

`lib/device.ts` names the pointer and window queries that scripts ask
(`fine`, `tablet`, `tabletUpright`, `tabletSideways`, `phone`,
`phoneUpright`, `wide`, `large`, `desk`). It gives `media()`, `matches()`
and one hook, `useDevice()`. The strings match the list at the top of
`app/globals.css`, so a script and a stylesheet agree about a device.

- Fine-pointer, tablet, phone and breakpoint checks in components read from
  it. Reduced-motion and colour-scheme checks stay inline, and so do the
  hero's layout queries in `hero-dials.tsx`.
- The lightbox asked `(min-width: 640px)`; it now asks `wide`,
  `(min-width: 40rem)`. That is the same width, since `rem` in a media
  query is always 16px.

## 2026-10-09: History out of code comments

Dated notes in comments ("Julian, 2026-10-04: ...", "critique,
2026-10-03", "measured 2026-10-07") moved here, under "History" below.
The comments keep what the code does and why it has to; the dates, who
asked and the wording of the ask are here.

- Undated attributions ("Julian: ...") are still in about 700 comment
  lines. They have no date to file under, so they were left for now.
- `components/admin-editor.tsx` keeps "As of 2026-09-12": it is a warning
  about the current Cloudflare Access policy, not history.
- Many comments still name `globals.css` for rules that now live in
  `app/styles/*.css`. `globals.css` is still the entry point, so they were
  left as they are.

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

## History

Notes moved out of code comments, by date, newest first. Each names the
file the note was in. "(Julian)" marks a change Julian asked for or
reported; a quote after "Julian:" is his wording, as the comment had it.
"From the critique", "the audit" and the named passes are review sessions.

### 2026-10-09

- `components/strip/keyboard.ts`: The strip's keys listened on the scroller alone, so with a cover or a link inside it focused the arrows did nothing.
- `components/strip/lenis.ts`: Firefox's mouse reports lines, and Lenis counts a line as 16.7px, so a notch of three carried 150px against the 360 of a notch anywhere else, and on a paged strip that is under the fifth of a screen `settle` asks for: the page never turned.
- `components/strip/paging.ts`: The strip's own scroll settle fired 20ms after Lenis's, before Lenis had written a frame, and the two pulled two ways: a trackpad swipe of a quarter screen slid back to the screen it left and then jumped a whole screen on in one frame (Chrome and WebKit, 1440 wide, at 1.25x, 1.5x and 2x).
- `components/strip/prefetch.ts`: Arriving on a discipline, WebKit painted the photographs two and three screens off as well as the ones in view, in the same frame: one block of 200 to 390ms on Event coverage at 1440.
- `components/strip/rail.tsx`: A pointer left resting on the rail kept this loop going for as long as it stayed there, 120 callbacks a second with nothing to do (measured on /portfolio).
- `components/strip/shared.ts`: Preview (`?notch`): a mouse notch moves the strip by its own ease, as a trackpad does, rather than by Lenis's.
- `components/strip/touch.ts`: A glide the rail or a key had set going kept writing `scrollLeft` under the finger, and `sync` left its target where it was, so after the lift the strip ran on and then glided back to that target with nothing touching it: 300 to 1100px back in 19 of 20 flicks made mid-glide (WebKit, iPad size).
- `components/strip/touch.ts`: A slow phone hands the moves over far apart: on a mid-range Android (Chrome, 4x CPU throttle) a swipe's last two came 102ms apart, the tenth of a second held only the last, the speed read nought and a swipe of a third of a screen went back.

### 2026-10-08

- `app/contact/actions.ts`: Picked frames are shown under their links. From 2026-10-05 to 2026-10-08 none was attached, because the Worker never answered its own `/cdn-cgi/image/` address; the file is now read from the static assets.
- `app/picks.json/route.ts`: The picker by look rather than discipline. Julian: a simple way for them to pick the look they are going for.
- `app/picks.json/route.ts`: Events and Cover art are kinds of work rather than looks, and are kept whole. (Julian)
- `app/styles/contact.css`: Flat scales, not a step toward the eye in 3D: drawn once at its size and lifted by `translateZ`, the form stayed soft in focus. (Julian)
- `app/styles/contact.css`: The screen behind the inquiry form is dimmed, not blurred. Julian: no blur on form select.
- `app/styles/contact.css`: Not while the strip moves: lifted and turned mid-deal, the card showed what the deck had under it. (Julian)
- `app/styles/cover.css`: Two animations, not one: the fade (opacity and blur) on its own, and `--os` held at 1 beside it.
- `app/styles/devices.css`: Smaller nav links and a thinner bar for more room for the work, and the twelve chips replaced by the drop-down the phone has (`.work-filter` above, `filter-trigger` in `work-shell.tsx`). (Julian)
- `app/styles/devices.css`: An iPad held upright: the bar's name stays on the homepage's cover too, as it does under `lg` on any other screen. (Julian)
- `app/styles/devices.css`: The drop-down's button on the line with the title and the view icons, so its own row goes and the work has the height. (Julian)
- `app/styles/devices.css`: The form fits the whole page either way. (Julian)
- `app/styles/devices.css`: The card is fitted to the screen, so there is nothing below it to reach; but the wall behind runs on under the rail (`--under`), and in a scroller those 90px were there to scroll to. Julian: Inquiries still scrolls up and down.
- `app/styles/devices.css`: The card as tall as what is in it, in the middle of the screen. Julian: smaller, and room for what people add.
- `app/styles/devices.css`: Upright the Inquiries screen is a scroller of its own, so the wall's overhang under the rail (`--under`) is clipped out of sight there anyway, and all it did was give the screen 90px more to scroll to. Julian: it still scrolls up and down.
- `app/styles/devices.css`: An iPad held sideways reads the page's name under the rail rather than over it. (Julian)
- `app/styles/glass.css`: "Up next" stands on the page's own wash at every width, not on a card of its own. Julian: match background.
- `app/styles/pointer.css`: In the photo picker the frames are small and close together: a smaller dot, so it does not cover the one it is over. (Julian)
- `app/styles/portfolio.css`: Closer again: 32px to the first cover with the strip's 16px gap. (Julian)
- `app/styles/portfolio.css`: A discipline's own page lays its name where the portfolio's first spine stands: 88px in, 32px to the first cover with the strip's gap, and on the page's wash rather than a ground of its own. Julian: no box, match the headers and margins of All.
- `app/styles/splash.css`: The rise and its mask as two animations: the rise alone is a transform the GPU runs, where in one set of keyframes with `--lift-clip` Safari ran both on the main thread.
- `app/styles/strip.css`: An iPad held sideways: the line a third thinner. (Julian)
- `app/styles/strip.css`: The strip's covers the same way, larger on a large screen, where the one-line cap of 3rem set SAGO small on a cover 870px wide. (Julian)
- `app/styles/strip.css`: One size along the strip, from its height, not each cover's width: sized by width, SAGO and DIESEL beside it sat on different lines. (Julian)
- `app/styles/strip.css`: On an iPad held upright the grid runs down instead (`useTablet`). Julian: the rack's covers were too small.
- `app/styles/work-view.css`: No fade: a picture shows as soon as it lands. (Julian)
- `app/styles/work-view.css`: The ask at the end of the work ("Have a project in mind?") is in the section titles' Archivo. (Julian)
- `app/styles/work-view.css`: More room before the name inside its card. (Julian)
- `app/styles/work-view.css`: The page's own colour, and carried left across the room before it: in a slide the chapter going under showed through that room as a dark bar riding the card's edge. (Julian)
- `components/card-tilt.tsx`: The card's own middle, from wherever its origin is: the deck (`lib/deck.ts`) moves a portfolio cell's origin to the screen's middle for its recede, and turned about that the tilt threw the card wide across its neighbours. (Julian)
- `components/contact-beam.tsx`: Two laps and then rest, on every screen. (Julian)
- `components/contact-form.tsx`: A chosen kind of shoot is inverted. (Julian)
- `components/cover-faces.tsx`: Image Transformations size it to the cell now (`image-loader.ts`); the 800px copy was stretched to 1750 device px in the tall rows and read as low resolution. (Julian)
- `components/cover-float.tsx`: Home on the homepage's rail; a booking page keeps Cover. (Julian)
- `components/focus-field.tsx`: Never over the inquiry form: picking a kind of shoot blurred the screen round it. (Julian)
- `components/inquire-wall.tsx`: Scaled out so more of the work shows (1.25 to 0.85), and no more than 24 photographs loaded for it however wide the screen, so it stays light. (Julian)
- `components/project-strip.tsx`: On a discipline's own page too. Julian: show up next.
- `components/reference-picks.tsx`: Four a row, three on a phone. (Julian)
- `components/reference-picks.tsx`: A little larger under the hand: it can be picked. (Julian)
- `components/reference-picks.tsx`: Sleeves are square, and shown whole. (Julian)
- `components/reference-picks.tsx`: The page's rail, stood upright: a hairline track, the ink filling down it as the photographs go by. Julian: the site's own scroll bar.
- `components/services-screen.tsx`: A finger has no hover: the first tap on a row puts its frames on the table, a second one opens it. Julian: iPad sideways.
- `components/strip.tsx`: The first photographs it opens on, as its page will ask for them, fetched with the page so its card comes in with them. (Julian)
- `components/strip/lead.ts`: Preview (`?cards`): the next discipline's card comes over this one under the hand, as the chapters do on All, rather than on its own in 640ms.
- `components/strip/lead.ts`: A swipe that led on (`touchX`, where the finger is) drives it the same way for as long as the finger stays down, and it plays out on the lift. Julian: the slide follows the finger.
- `components/strip/lenis.ts`: Eased again here it cost a frame loop and a layout a frame, and a home page swipe ran at 31ms a frame against 20 without it (WebKit, 1440 wide).
- `components/strip/media.ts`: An upright iPad's grid is a sheet that runs down; held sideways it keeps the rack. Julian: the rack's covers were too small there, 210px across.
- `components/strip/shared.ts`: The wheel's push past the end before it leads on: halved from 300. Julian: less resistance.
- `components/strip/shared.ts`: Shorter than the wheel's, because a wheel notch is worth tens of pixels and a finger is worth the distance it actually moved. 80px, then 50. Julian: less resistance.
- `components/strip/touch.ts`: The paged strip's touch lift is reworked from recordings and logs of Julian's iPad.
- `components/strip/use-reader.ts`: The arrival's address is read on arrival only. Read again when the held-back sections mounted (`count`), it was the address the strip had since written for the section in view, and the next re-lay threw the row back to that section's start Seen on Julian's iPad: a swipe through Editorial jumped to its title card.
- `components/strip/wheel.ts`: An open dialog keeps its own wheel: the reference picker sits in the form, so inside the strip, and its photographs could not be scrolled. (Julian)
- `components/work-shell.tsx`: Preview (`?cards`): each discipline drawn as one card, its name and its projects (`globals.css`, `data-cards`).
- `lib/deck.ts`: Dealt again once the galleries' walls are laid out (`strip-relaid`, `strip.tsx`) or held-back sections arrive: from Event coverage on, the first wall, every chapter stood somewhere else than the deal had measured, and the stack stopped working there. (Julian)
- `lib/inbox.ts`: `inline`: the picks attached inline as `cid:pick-<index>`, shown under their link in the HTML copy; one that would not fetch is the link alone. (Julian)

### 2026-10-07

- `app/layout.tsx`: Endless is the header face: the logo, the titles, the section titles and the nav. (Julian)
- `app/layout.tsx`: The wordmark stays Inter Tight Black: the logo and the name on the cover. (Julian)
- `app/page.tsx`: The nine campaigns he wants up front; Oakley x Nike and Kala x Sharks picked for the hard light. (Julian)
- `app/picks.json/route.ts`: Covers only, one a project, and no two looks side by side: the portfolio's order, but each next cover is whichever of the next few in line sits furthest in colour from the last two. (Julian)
- `app/styles/cover.css`: A big screen, wide and short (1.75 to 2.2 to 1: a 13 or 16 inch laptop in a browser): its own layout, `SHORT` on "Photo layout, wide short". (Julian)
- `app/styles/cover.css`: Never under nine tenths of their size, however far a short wide window shrinks the middle. Julian: unreadable.
- `app/styles/cover.css`: The location one line, centred, from a tablet up. Julian: it broke onto two lines off the middle on an iPad.
- `app/styles/glass.css`: The buttons in the nav's face, Endless. (Julian)
- `app/styles/header.css`: Each screen carries a ground of its own down under the glass, as a shadow its own height below it, so the one it slides over never shows through the rail and footer. Julian: the screen coming over has to be under the footer, the bottom right black.
- `app/styles/home.css`: 7rem at the least: at 6 a short laptop (1515 by 785) set the title 19px under the bar. (Julian)
- `app/styles/pointer.css`: Arranging the cover (the 3D view, drag to arrange): the system's own pointer, not the mark. (Julian)
- `app/styles/portfolio.css`: Its name stands on the page's margin and the first frame follows at the same distance as every other discipline's. (Julian)
- `app/styles/strip-motion.css`: And past the last letter: set tight, a Black face's final stroke runs beyond its advance, and the clip cut the S off INQUIRIES. (Julian)
- `app/styles/strip-motion.css`: The film runs on under the footer, and the footer is glass over it: it was the one band the reel did not reach. (Julian)
- `app/styles/strip.css`: Larger, and a long name runs to two lines rather than shrinking to fit one. (Julian)
- `app/styles/tokens.css`: Body text is Endless, the titles' face; labels and buttons keep the mono. (Julian)
- `app/styles/utilities.css`: The small details stay in the mono: labels, captions, counts, buttons. (Julian)
- `app/styles/work-view.css`: The headers of the screens (Biography, Commissions, Sessions, the footer's ask) in the wordmark's face, Inter Tight Black. (Julian)
- `app/styles/work-view.css`: A card under the hand gets no focus ring. Julian: the accent frame showed on a click.
- `app/styles/work-view.css`: The vertical discipline name comes up at once: no wait before the first word, a quicker rise. Julian: reduce the delay.
- `app/styles/work-view.css`: The colour page's covers tip toward the pointer as the portfolio's do (`card-tilt.tsx`). (Julian)
- `components/hero-dials.tsx`: `?arrange` opens straight into arranging, in 3D, the layout for the window's own shape. (Julian)
- `components/pointer-mark.tsx`: In the top layer, so a modal dialog does not cover it. Julian: the dot went under the work picker.
- `components/pointer-mark.tsx`: A slight trail behind the hand: the dot closes on it with a 30ms time constant. Julian: "just a slight bit of delay".
- `components/project-strip.tsx`: Whether the frames past the first screen are fetched at once (the sideways strip) or as the page reaches them (a phone, where the page stacks ten screens tall and SAGO was 1.35MB of frames on arrival, measured).
- `components/strip.tsx`: For a page that cannot hand a `counter` across from the server. Julian: the homepage.
- `components/strip/arrival.ts`: The photographs arrive from the middle of the window out, the nearest first. (Julian)
- `components/strip/stacked.ts`: The dev build re-renders enough to hide that; production did not (measured).
- `components/strip/use-reader.ts`: The arrival's aim is spent once the visitor chooses a place. Left standing, the next re-lay of the row set the strip back on the cell the address named when this effect last ran: Julian pressed Inquiries, Sessions, then Biography, and the glide to Biography was thrown back toward Sessions a few frames in, the bar lighting Sessions.
- `components/vectorscope.tsx`: With no colour chosen, the work by how hard it hits: dark frames with one hard, saturated light first, scored off the covers and checked by eye. (Julian)
- `components/vectorscope.tsx`: Vectorscope results four across, two down, larger. Julian: less grid.
- `components/work-cells.tsx`: No "All projects"; the chips narrow the page. Julian: not needed.
- `components/work-shell.tsx`: The line sits on the pane's hairline and slides there, thinner, in place of the liquid under the chip. (Julian)
- `components/work-shell.tsx`: Where the chip comes to rest, not where its spring has it now: read mid-flight, the push from the chip lit before was still on it and the line landed off the words. (Julian)
- `lib/cover-slots.ts`: The wide and short cover layout (`SHORT`), for a laptop at 1515 by 785 where the large field ran its bottom row under the rail. Arranged by Julian in the 3D view (`?arrange`).

### 2026-10-06

- `app/layout.tsx`: The share card is the wordmark on black, Julian's pick; it was the eye mark before that, and the cover photograph before that.
- `app/portfolio/[slug]/page.tsx`: The discipline where the client would only repeat the name (SAGO, for SAGO), as the grid's caption does. (Julian)
- `app/styles/splash.css`: The splash sweep never stops. Julian: held back to what had loaded, it stuttered.
- `app/styles/splash.css`: One blink, before the sweep is half way. Julian: one is enough; it was two, the second 84 to 90% across.
- `app/styles/splash.css`: The cover photographs set off with the lift, not after it. Julian: after it was too late.
- `app/styles/strip.css`: The quiet footer on an iPhone: more air above the rule and under the line, clear of Safari's bar. Julian: squashed.
- `app/styles/transitions.css`: Behind the opening, the first cover photograph sets off the moment the panel lifts. Julian: the photographs popped in too late.
- `components/cover-float.tsx`: The third (I Wanna Be a Human, top middle) leads, ahead of the rest. (Julian)
- `components/intro.tsx`: Preview (`?deal=ripple|rise|sweep`): other landing orders, from where each frame actually sits.
- `components/intro.tsx`: The opening is a fixed 3s from the first paint, and the sweep never stops. Julian: "not smooth, make it 3s".
- `components/intro.tsx`: One blink, before the sweep's edge reaches the eye; it was two. (Julian)
- `components/intro.tsx`: The eye fades out before the panel lifts, so the sheet leaves empty. (Julian)
- `components/intro.tsx`: The photographs set off with the lift, not after it (they popped in too late). (Julian)
- `components/project-strip.tsx`: Stacked down a phone it is the foot of the page: air above and below so the name is not pressed on the footer's rule. (Julian)
- `components/site-footer.tsx`: On a phone both lines start on the left, the legal one first. (Julian)
- `components/site-footer.tsx`: On a phone, at the line's right end. (Julian)
- `lib/work.ts`: A credit by role, unless it only repeats the project's own name (SAGO, credited to SAGO): under the name, that line said the same thing twice. From the polish pass.

### 2026-10-05

- `app/api/traffic/route.ts`: Held in a const: the check above does not narrow `env` inside `gql`, which failed the production type check.
- `app/api/traffic/route.ts`: Bing refuses Cloudflare's shared servers outright, so the Agentic OS dashboard on Julian's PC asks it instead.
- `app/contact/actions.ts`: Picked frames are attached to the enquiry email. (Julian)
- `app/styles/contact.css`: Further forward (was 44px, now about 1.05x) and a step toward the middle, as on hover, still clear of the text on the left. (Julian)
- `app/styles/contact.css`: The edge's line and glow quieter under the pointer. (Julian)
- `app/styles/contact.css`: The inquiry card in focus: bigger, and a step toward the middle. (Julian)
- `app/styles/devices.css`: Thicker than the head's pane: names are read off this one, and a dark frame under the glass took them below 4.5:1. From the audit.
- `app/styles/devices.css`: Measured on production, throttled phone, three runs each: LCP 3.5s to 2.7s, style 1.35s to 0.98s. From the optimize pass.
- `app/styles/devices.css`: The form's edge: a thin white line and its glow that travel round the form on the beam's lap. (Julian)
- `app/styles/devices.css`: The reference picker pops out of the inquiry form as a glass panel. (Julian)
- `app/styles/devices.css`: Colour from the photos in the All portfolio bar, tastefully. (Julian)
- `app/styles/devices.css`: The names on the colours at full strength: the grey at 60% read about 2.5:1 on them. From the audit.
- `app/styles/header.css`: From a tablet up as well: the portfolio's title row and the bar are one pane of the homepage's glass, with one hairline under both. Julian: integrate the head into the navbar.
- `app/styles/header.css`: Room under the chips before the pane's hairline. Julian: some space under the filter.
- `app/styles/home.css`: About's label is "Biography" since the menu names changed; the old "About" here left its steps hidden for good. (Julian saw it)
- `components/admin-inbox.tsx`: The references an enquiry arrived with: their uploads, fetched with the inbox's credentials since they are theirs and private, and his own frames they picked, which are public. (Julian)
- `components/admin-inbox.tsx`: Only what actually loads is shown: a broken tile, or a heading over none, says nothing. (Julian)
- `components/contact-beam.tsx`: A white line and its glow that go round the form, never sitting still: the beam is the whole effect, wider and brighter (a static line and halo on the card were tried and taken off). (Julian)
- `components/contact-beam.tsx`: The beam slower: a lap in six seconds, was four. (Julian)
- `components/contact-form.tsx`: The address on the left, the button on the right, the sentence off the screen (still read out with the button). (Julian)
- `components/contact-form.tsx`: Said, not only shown: the faint "Optional" placeholder is a look, so the label carries the fact. (Julian)
- `components/contact-form.tsx`: Form placeholders fainter; they were 60%. (Julian)
- `components/contact-screen.tsx`: The questions' wall behind Inquiries is inert: not to be clicked there. (Julian)
- `components/cover-float.tsx`: Preview (`?deal=new`, `data-deal`): the frames arrive top to bottom, as one even wave (Julian: top, then the middle, then the bottom, with harmony).
- `components/inquire-wall.tsx`: A third slower (was 24). (Julian)
- `components/liquid.tsx`: Every item measures its target as it mounts and the engine goes on measuring for thirty frames, which on a phone was a full restyle of the page in the middle of hydration. From the optimize pass.
- `components/reference-picks.tsx`: References on the inquiry: uploads, and frames picked from the work. (Julian)
- `components/site-header.tsx`: Both read before either is written: a write to the root's style and then a read restyled the whole page a second time, 140ms on a throttled phone. From the optimize pass.
- `components/site-header.tsx`: Glass over the homepage's photographs (`.site-bar[data-home]`), and the same depth on the portfolio. Julian: match it.
- `components/site-header.tsx`: The ink line under the nav goes; the lit name is a touch larger instead. (Julian)
- `components/strip-page.tsx`: The clamp hides overflow, and with it the button's reach past its 20px: taps a few pixels off it missed. From the audit.
- `components/vectorscope.tsx`: The vectorscope more accurate, and not so many: the hue reach tighter, the strongest first. (Julian)
- `components/vectorscope.tsx`: How many projects a colour shows is the room's, not a number: as many 4:5 covers as fit beside the panel without a scroll, three rows (two on a short screen), and the columns that leaves, from three to eight. Julian: 6 by 3 on a big screen, 5 by 3 at 1440.
- `components/vectorscope.tsx`: The work in the colour fills the screen and does not scroll. (Julian)
- `components/vectorscope.tsx`: No stack under a vectorscope cover. Julian did not like how the edges looked.
- `components/work-cells.tsx`: Films have no samples to take a colour from, so the rail is given one that sits with the rest: a muted violet between Event coverage's indigo and Cover art's red. (Julian)
- `components/work-filter.tsx`: 70, not 45: on the glass the faded names fell under 4.5:1, the site menu's level in the light. From the audit.
- `components/work-filter.tsx`: Two to a row on a phone, set to the column so the longest, Brand Campaigns, fits whole: one size for all of them, 17px at most. (Julian)
- `components/work-filter.tsx`: At the name's own strength: faded again under a faded name it fell to 2.7:1. From the audit.
- `components/work-filter.tsx`: Quieter by size, not by fading: smaller and set to the cap height of the name. (Julian)
- `components/work-shell.tsx`: A line under the lit chip's words, as the navbar has under its page: the words' width less the chip's padding, grown with the chip's swell, at the foot of the chip as it is drawn. Julian: once the chips joined the bar's pane.
- `components/work-shell.tsx`: The vectorscope button in both views; from strip view it turns the page to grid first. This undid grid-only from 2026-10-04. (Julian)

### 2026-10-04

- `app/book/page.tsx`: book.juliangigola.com becomes a Cloudflare redirect to /book. (Julian)
- `app/layout.tsx`: A phone on its side is asked to stand it up: the site is laid out for a phone upright. (Julian)
- `app/page.tsx`: Every upright frame at one 4:5, so a 3:4 among them does not leave a row of mismatched cards. Julian: do the ratios match?
- `app/page.tsx`: Editorial is his own pick of covers, in his order, cut to one 4:5 so the rows are even. (Julian)
- `app/page.tsx`: Numbered, not its name on every frame. (Julian)
- `app/page.tsx`: Above Commissions on a phone: the names that vouch for the work before the work. (Julian)
- `app/page.tsx`: About before Sessions, as in the bar. (Julian)
- `app/styles/contact.css`: And the Commissions table's tilt: the card under the pointer lifts, tips toward it (`card-tilt.tsx` writes where the hand is), casts a shadow away from the side that lifts. Julian: the same hover on the portfolio's projects.
- `app/styles/contact.css`: Focus that follows the pointer across a gallery. (Julian)
- `app/styles/contact.css`: Eased in and out (smoothstep), so neither edge of the falloff shows as a line. Julian: shorter, smoother.
- `app/styles/contact.css`: The navbar's name grows under the pointer, round its own middle so it swells in place: from the link's left edge it slid down and to the right. (Julian)
- `app/styles/contact.css`: And it turns white with a thin outline in the ink, faded in. (Julian)
- `app/styles/contact.css`: No line now, on either ground; the edge stays transparent, kept so the two states still blend. Julian: no outline.
- `app/styles/contact.css`: White vanished into the light ground: there it turns the grey of the nav's words instead. (Julian)
- `app/styles/contact.css`: And the page itself takes the inverted calendar's grey, so the frame sits in it rather than as a lighter slab on near black. (Julian)
- `app/styles/devices.css`: On a phone on its side the site is not at its best, so the screen says so. (Julian)
- `app/styles/devices.css`: The title is the filter, so the list drops from under it rather than sliding in from the side and pushing the page away. (Julian)
- `app/styles/devices.css`: The menu and the phone's filter drop-down are the glass themselves and open over the page, which stays where it is: no push, no frosting of the page around them. (Julian)
- `app/styles/header.css`: And on a phone held upright, the bar and the head are one pane: the bar lets go of its own glass and its rule, and the head's glass reaches up behind it to the top of the screen. (Julian)
- `app/styles/header.css`: Preview, `?menu3d=1`: on a phone the page pushed aside swings back in perspective about the edge it shares with the drawer, the drawer turns in on its way, the glass over the page is lighter, and closing is the same movement backwards: the same lengths, the names leaving from the foot up. (Julian)
- `app/styles/header.css`: Inertia: the swing carries a little past and settles back, the slide only just, so the page's edge and the drawer's stay together. (Julian)
- `app/styles/header.css`: In the light the names standing back went pale grey on the pale ground: darker there, the one you are on still the darkest. (Julian)
- `app/styles/home.css`: The cards stand a little off the table, a few pixels toward the viewer with a soft shadow under them, and the one under the pointer tips toward it on every axis (`--rx`, `--ry`, `--rz`, written by `services-screen.tsx`). (Julian)
- `app/styles/home.css`: Realism: each card has its own perspective, so it turns about its own centre instead of warping toward the sheet's vanishing point; small angles; it follows the pointer quickly and settles slowly; the shadow falls away from the tilt. (Julian)
- `app/styles/home.css`: The Commissions cards' tilt has no glare. Julian: it read as a glow round the pointer.
- `app/styles/home.css`: No shadow at rest; the same shape, clear, so it fades in rather than snaps. Julian: only on hover.
- `app/styles/home.css`: Up off the table toward the viewer. Julian: more lift.
- `app/styles/home.css`: Fades in rather than snapping on. Julian: smoothly.
- `app/styles/home.css`: Room for it: the lifted card grows a few pixels past the 6px gutter, so its neighbours ease aside by half that, the ones before it back, the ones after it on, the rows above up and the rows below down, and settle again when it does. (Julian)
- `app/styles/pointer.css`: Over a text field: the dot draws itself out into a caret, a thin upright bar, on the same curve as every change of size, and rounds back up on the way out. Julian: a custom icon for the form.
- `app/styles/portfolio.css`: Then the margins of the discipline's own page, where "All projects" leads: the page's 40px before the name, 64px from it to the first cover with the strip's 16px gap.
- `app/styles/splash.css`: The layer's own colour is the panel's, which is the page's, and the ground the panel sweeps across is painted over it short of the top and bottom (below): Safari on an iPhone takes the colour of the bands round the page from what is at the window's edge, and Julian asked for them black in dark and light in light, not the ground.
- `app/styles/splash.css`: The bands only where Safari on an iPhone or iPad reads them: everywhere else they were a stripe across the top and foot of the opening. From the audit.
- `app/styles/splash.css`: The cover photographs set off after the splash lift: their blur on nine cards at once dropped frames from it on a cold start.
- `app/styles/strip-motion.css`: A variable, so the hover's shadow can carry it too. Julian: the hover shadow had replaced it and the chapter behind showed.
- `app/styles/strip.css`: The running head comes in from the left as the cover goes. (Julian)
- `components/book-picker.tsx`: One window, no vertical scroll: the footer's single line and the page held to the screen, as the portfolio is (`[data-quiet-footer]`, globals.css). (Julian)
- `components/book-picker.tsx`: As tall as Google's page is, and no taller, in what the window leaves it: only a short one makes it scroll. Julian: shorter, then a bit longer so it never scrolls inside itself.
- `components/card-tilt.tsx`: The Commissions table's cards (`.light-cell`), and the same on the portfolio's projects. (Julian)
- `components/contact-form.tsx`: Focus is the rule under the field darkening, to 40% ink. Julian: lower.
- `components/cover-cell.tsx`: No zoom under the pointer. Julian: none anywhere.
- `components/focus-field.tsx`: A hover that spans the gallery. (Julian)
- `components/focus-field.tsx`: The menu's names too, and on a phone under the finger as well as under a mouse. Julian: the press in the menu should soften the others the way the pointer does over Commissions.
- `components/focus-field.tsx`: On the portfolio the discipline names between the runs stay sharp: each one in view is cut out of the mask. (Julian)
- `components/focus-field.tsx`: The clearing is a little wider than the frame under the pointer, so a wide frame and a small one each come into focus whole. Julian: wider than the half it was, then wider again.
- `components/hero-dials.tsx`: No swell under the pointer. Julian: no hover zoom anywhere.
- `components/nav-fly.ts`: The name pressed in the menu, or in the bar on a desktop, should travel into the heading of the screen it opens. (Julian)
- `components/page-transition.tsx`: Going back needs its animation too. (Julian)
- `components/pointer-mark.tsx`: A press that leaves the page: let go of whatever it is on at once, so the dot eases back to rest as the page changes, and the next page sets it afresh. Julian: a Commissions row or photograph kept its arrow over the page it opened.
- `components/pointer-mark.tsx`: Over a row of the Commissions list the dot grows and an arrow pointing on is cut out of it. (Julian)
- `components/services-screen.tsx`: Heading right toward the table, a row takes over only once the hand has stayed on it. Julian: a film opened the wrong part of the portfolio.
- `components/services-screen.tsx`: The drop stands proud of its row, the text unchanged: 8px over and under (with the ground's own -inset-y-2). (Julian)
- `components/services-screen.tsx`: Under a finger: the disciplines as frames, two across, the picture leading and the name on its slate, as the portfolio's own cards are. Julian: the names and the pictures too small in a list.
- `components/services-screen.tsx`: Not under a finger, where it sat against the buttons. (Julian)
- `components/sessions-screen.tsx`: Under a finger, the first tap opens a row and the next goes to its page; a mouse has opened it already by pointing. (Julian)
- `components/sessions-screen.tsx`: The slate every photograph on the site carries (`cover-cell.tsx`, the Commissions table): the rate over the name, on a fall of shade. Julian: match the rest.
- `components/sessions-screen.tsx`: The booking page fetched on the pointer, so the press has nothing to wait for. (Julian)
- `components/site-header.tsx`: The logo grows under the pointer (`.logo-grow`). (Julian)
- `components/site-header.tsx`: Every nav slot the same length, the longest name's and a margin. (Julian)
- `components/site-header.tsx`: Nav names in one register, plural nouns like Commissions: Biography, Inquiries.
- `components/site-menu.tsx`: The menu's names are sized to the drawer. They were 12vw of the window and ran out past the drawer's edge on every phone and iPad. (Julian)
- `components/site-menu.tsx`: The theme toggle sits on the menu's left margin. (Julian)
- `components/strip-page.tsx`: On a phone the title is also the way to the other filters. Julian: the drop-down beside the title, not a box under it.
- `components/strip-page.tsx`: Where the title is the filter: the title centred, the views stacked at the right under the burger. (Julian)
- `components/strip/stacked.ts`: Its own name, so only the navbar's wordmark reads it, not the running heads of the stacked pages. Julian: the name in the bar on an iPhone once the hero is passed.
- `components/strip/use-reader.ts`: The sliding eye read a third of the way in early on the homepage and lit Biography with Sessions filling the screen. (Julian)
- `components/strip/use-reader.ts`: A link straight to a cell in the rack re-aims on each re-lay until the visitor moves. Julian: every film on the homepage opened Event coverage.
- `components/video-grid.tsx`: The last two words held together, so a long title never leaves one alone on its second line. Julian: "Iranian Americans of / Silicon Valley".
- `components/video-grid.tsx`: No zoom under the pointer. Julian: none anywhere.
- `components/work-cells.tsx`: The last two words held together, so a title that wraps never leaves one alone. Julian: "Iranian Americans of / Silicon Valley".
- `components/work-shell.tsx`: On a phone the two views side by side under the burger, small, grid on the right: the one you are in bright, the other back. (Julian)
- `components/work-shell.tsx`: The bar's glass, not the ground, so the work passes under it frosted. (Julian)
- `components/work-shell.tsx`: No count beside the portfolio's title. (Julian)
- `components/work-shell.tsx`: The lit chip's plate is back, in full ink, and its count is knocked out of it.
- `lib/videos.ts`: The client as a credit, unless the title already names them: "Pear VC Campaign" under "Pear VC" said it twice. (Julian)

### 2026-10-03

- `app/[service]/page.tsx`: A session carries its gallery as a screen of its own: the frames chosen for it where the gallery is large (`picks`, `lib/booking.ts`), all of it where it fits in four rows of five, and otherwise fourteen, taken in turn from each of the discipline's projects or spread through the one gallery. (Julian)
- `app/page.tsx`: The Cover Art table shows Julian's sleeves, in his order.
- `app/page.tsx`: Compared by that frame, a cover and the frame it was cut from count as one picture: Event coverage showed its first photograph twice. (Julian)
- `app/page.tsx`: A photograph behind each door on the last screen. From the critique: the screen that asks was the only one without work on it.
- `app/page.tsx`: The work door's photograph, Julian's pick: Valgur, the two knights and the lightning.
- `app/page.tsx`: The sessions door's photograph, Julian's pick: Sago, standing in the tall grass.
- `app/page.tsx`: A discipline's frames for the Commissions table, up to twelve: its projects' covers, the films for Motion, his picked sleeves for Cover Art. (Julian)
- `app/page.tsx`: Extra frames beside a project's cover on the Commissions table. (Julian)
- `app/page.tsx`: The Commissions table shows covers only. (Julian)
- `app/page.tsx`: What each discipline is, one line under its name. Julian: a short description of each, in place of the credit names.
- `app/page.tsx`: A preview of the portfolio, not all of it: the disciplines as an index beside one large photograph, and the way on to the portfolio (`services-screen.tsx`). (Julian)
- `app/page.tsx`: The wall behind Inquire, where it was behind the last screen's doors, and none of it a picture the page already shows. (Julian)
- `app/page.tsx`: The second door, forward rather than back: it sent a private client back to Sessions, a screen behind them with Sessions in the bar as well. From the audit.
- `app/styles/contact.css`: The hover the Commissions table and the portfolio have. Julian: the same on the sessions.
- `app/styles/contact.css`: Primaries solid under a finger. From the critique.
- `app/styles/contact.css`: The last screen's doors, each over a photograph. From the critique.
- `app/styles/contact.css`: A field lifts under the pointer and stays up while it is being typed in. (Julian)
- `app/styles/contact.css`: The card grows toward you under the pointer, and once somebody starts typing it comes forward into focus while the rest of the screen steps back, so the form is the one thing in front of them until they press Inquire. (Julian)
- `app/styles/contact.css`: The same on /portfolio, strip and grid. (Julian)
- `app/styles/cover.css`: The second door read as disabled, a hairline on the dark. (Julian)
- `app/styles/drift-wall.css`: A cover flow, turned away on the edge that meets the picture, so the outer edge recedes. (Julian)
- `app/styles/drift-wall.css`: The wall's cards: glass, not blur. (Julian)
- `app/styles/glass.css`: Sessions' button, alone with no liquid under it: its glass at 72% ink over the dark screen read grey, as if it could not be pressed. From the critique.
- `app/styles/home.css`: The one authored moment is the deal. (Julian, /impeccable animate)
- `app/styles/home.css`: Commissions table: nothing moves under the pointer, the slate rises over the photograph. Julian: the lift and the push were messy across frames of different shapes.
- `app/styles/home.css`: The slate: a fall of shadow across the foot with the name on it, not a line of text on the photo. Julian: the same for #work.
- `app/styles/strip-motion.css`: And the ground with it: the light theme's glow stayed behind the footer, the one strip the film does not reach, and read as a grey band. (Julian)
- `app/styles/strip.css`: The slate's title: the films' size, as large as the length lets it be.
- `app/styles/tokens.css`: Set left everywhere. (Julian, audit)
- `app/styles/ultrawide.css`: Any short window, not only a wide one: at 1280x720 the send button sat under the end of its own box. From the critique.
- `app/styles/ultrawide.css`: White ink over the row turned it inside out, a bright card on the dark screen; Julian wanted it lower key.
- `app/styles/ultrawide.css`: The ink on the session rows becomes liquid.
- `components/DriftWall.tsx`: As many as the wall needs and no more: enough a column that its copies are never in view together, at most the six a phone column takes. (Julian)
- `components/about-screen.tsx`: Where the window is too short for it all, these words scroll inside themselves, not the column, so the facts and the buttons under them stay on the screen.
- `components/about-screen.tsx`: The four steps appear in order as About arrives (`.about-step`, globals.css). (Julian)
- `components/contact-beam.tsx`: The beam brighter: full strength, the glow past the library's 1.3. (Julian)
- `components/contact-form.tsx`: Nothing picked until the visitor picks: a private client from the nav landed on Editorial. From the critique.
- `components/contact-form.tsx`: Book a session landed on the commission desk, the session pushed into the date field. (Julian, critique)
- `components/contact-screen.tsx`: One name for the screen, as the nav says it. (Julian)
- `components/contact-screen.tsx`: On a phone the column dissolves into the screen's own column, so the address and the handles can follow the form rather than stand between the ask and it. From the critique: the name field was 530px down.
- `components/contact-screen.tsx`: The homepage's head, unless the visitor came to book a session. From the critique.
- `components/contact-sheet.tsx`: The session's gallery as a screen of the page that books it, so the work, the questions and the booking are one page. (Julian, overdrive)
- `components/contact-sheet.tsx`: The white-backdrop headshots are framed from the waist, the black from the shoulders, and side by side the first read as zoomed out. (Julian)
- `components/contact-sheet.tsx`: Beside the words from a laptop up; under them on an upright tablet, where side by side left the sheet a postage stamp (the live QA, iPad).
- `components/cover-cell.tsx`: The films' slate on every project. (Julian)
- `components/credit-card.tsx`: Who they are, a weight under bold, the role on a line of its own ("Julian Gigola · Phot…" was cut), then the handle, a weight lighter, right over the way out to it. (Julian)
- `components/lightbox.tsx`: Whole, never cropped, the 3D made elite, and not crowding the picture ("too close"). (Julian)
- `components/local-questions.tsx`: Behind it, the session's own photographs on the drifting wall the homepage's ask has. (Julian)
- `components/local-questions.tsx`: A rack focus, as a lens pulls it: with the pointer on the words the wall behind them is soft; off the words, over the photographs, the wall comes sharp and up and the words go soft. (Julian, delight)
- `components/services-screen.tsx`: A preview of the portfolio, not the whole of it. (Julian)
- `components/services-screen.tsx`: The rows' hover in liquid, as Sessions has it. (Julian)
- `components/services-screen.tsx`: A pitch, not a list heading. Julian: less of a menu.
- `components/services-screen.tsx`: The art director's verb first, the whole portfolio beside it. From the critique: it was nowhere before About.
- `components/sessions-screen.tsx`: The edge of the row the pointer came in by, which the ink fills from, and the one it left by, which it drains to: over the top it pours down, in from the side it runs across. (Julian)
- `components/sessions-screen.tsx`: The ink in liquid, the filter bar's. (Julian)
- `components/sessions-screen.tsx`: The content starts below the header at every height, and is centred only while it fits: at 1440x840 the open list ran up under the bar. From the critique.
- `components/sessions-screen.tsx`: The rows appear in order as Sessions arrives, as About's steps do (`.session-step`, globals.css). (Julian)
- `components/sessions-screen.tsx`: The button says Book a session; said beside it as well, the pair read as a stutter. From the critique.
- `components/sessions-screen.tsx`: Julian's words in its place; "Bookings" since Commissions became the art directors' screen in the nav. From the critique.
- `components/site-footer.tsx`: No label over the heading: the heading carries itself. From the critique.
- `components/site-header.tsx`: Nav order: Commissions first, the two audiences side by side. (Julian)
- `components/site-header.tsx`: An ink line runs under the lit nav name, and once out to the wordmark. Removed on 2026-10-05.
- `components/video-grid.tsx`: Along a strip: no plate. Julian: "slate".
- `lib/booking.ts`: The frames its work screen shows, where the gallery is too large to show whole: chosen, not sampled. (Julian)
- `lib/booking.ts`: Only the frames that read as digitals: plain ground, standing or close, no styling. (Julian)
- `lib/content.ts`: A frame pulled from the film itself, kept with the app. Julian: Pear VC's still at 3:09.
- `lib/videos.ts`: Julian's pick: the opening aerial over the interchange, a 1920 still from his own export of the reel, kept with the app.
- `lib/work.ts`: The same wall for one kind of session, behind its booking page's questions: every frame of its gallery, or of every project in its discipline, each opening the project it is from. (Julian)
- `lib/work.ts`: Julian's order for the homepage's Commissions: event coverage in, Chroma out.

### 2026-10-02

- `app/[service]/page.tsx`: Built from the homepage's own screens: its floating cover with this service's photographs and title, the testimonials, the details and questions on one screen, and the form, set to this service. (Julian)
- `app/[service]/page.tsx`: Prerendered, and rendered on request where the prerendered copy is not there: a Workers preview upload carries no cache, and `dynamicParams = false` turned every miss into a 404.
- `app/[service]/page.tsx`: Headshot 09 stays in the gallery, not on the cover. (Julian)
- `app/portfolio/[slug]/page.tsx`: Padded to a 26px target and pulled back by as much. From the UI/UX review.
- `app/robots.ts`: Google-Extended is off the list at Julian's ask so Gemini can recommend the site.
- `app/styles/cover.css`: Lifted from #77756f (4.3:1) to clear 4.5:1 on the whole ground, the glow in the middle included. From the UI/UX review.
- `app/styles/cover.css`: A booking page's title runs to three lines where the name is one, and on ultrawide reached up into the top row of photographs: lower there. (Julian)
- `app/styles/header.css`: And the photographs themselves go, not only their overflow: on Julian's machine (Chrome, D3D11, 2321x1334 at 1.5) the frames of a buried hero were still composited where they lie unburied, under the glass, and the clip, the scale and `will-change` each made no difference; the tint over them read as a cool grey band the height of the rail on every other screen.
- `app/styles/portfolio.css`: The card came in as the strip and the page landed as the grid. (Julian)
- `app/styles/portfolio.css`: The way in ("All projects") stands at the foot on the name's right, where the name starts reading. Julian: after a spell above it.
- `app/styles/portfolio.css`: Space between "All projects" and the first cover, which the next screen's shadow also falls across. 88px, then closer to the first project twice.
- `app/styles/portfolio.css`: The first spine 88px off the left edge: the strip's own 40px and this. Julian: 32px, 64px, then wider again.
- `app/styles/portfolio.css`: The card runs on down under the glass, as the screens' own pictures do, or the last screen's wall showed through the pane below it; and the homepage's rail gives way as it comes, so the pane never reads Inquire over the portfolio. (Julian)
- `app/styles/portfolio.css`: The door that stacks the portfolio over the homepage becomes the default; `?stack=0` keeps the door before it. Julian: the portfolio stacks over the home, not under it.
- `app/styles/strip-motion.css`: A cover with no partner in the rack stands over an empty row, and the chapter behind showed through the hole. Julian: Artist Presskit's seven.
- `app/styles/tokens.css`: Never a word broken at the line's end ("accu-rate"). (Julian)
- `app/styles/work-view.css`: The homepage's ask over the wall: the muted lines ("hello@", "Next", the line under the question, the doors' lines) were faint over a bright tile, under 4.5:1 on a phone in either theme. From the scroll-craft contrast pass.
- `components/client-marks.tsx`: A logo is a picture with no words in it: the name as text, the logo's alt, so a search engine reads who the client is. (Julian)
- `components/cover-float.tsx`: A booking page's title is a sentence, not a name: longer lines. (Julian)
- `components/credit-card.tsx`: The card is poured out of the name. (Julian, overdrive)
- `components/credit-card.tsx`: One liquid for the whole list (`CreditList`), mounted only while a card is open: a group that is not there measures nothing, so the credits cost no frames while scrolling. From the audit.
- `components/lead-window.tsx`: The card came in as the strip and the page landed as the grid, and the grid's own covers came in white. (Julian)
- `components/legal.tsx`: Focusable: from `sm` up the clause scrolls in its own column, and with nothing in it to take the focus a keyboard could not scroll it (WCAG 2.1.1, the audit).
- `components/liquid-pair.tsx`: Each liquid runs a loop of its own that wakes on any scroll on the page and measures its buttons every frame, and the homepage has five: on the way back from the portfolio they were set up inside the page swap and then measured every frame of the strip's travel, the largest cost of both crossings. From the scroll-craft pass.
- `components/liquid.tsx`: The library renders its items into `<g>`s through React portals, React hangs its event listeners on every portal container, and Chrome makes an SVG element with focus listeners keyboard focusable: a Tab through the hero's buttons stopped on an invisible group with no name and no ring after "See the work". From the UI/UX review.
- `components/local-questions.tsx`: The session's price and turnaround, and what was the Details screen, beside the questions: one screen for both. (Julian)
- `components/local-questions.tsx`: The old Details screen, folded the way the questions are and opened by pointing. (Julian)
- `components/local-questions.tsx`: A mouse opens it by pointing. (Julian)
- `components/photo-notice.tsx`: The photo notice set smaller. (Julian)
- `components/pointer-mark.tsx`: The pointer dot has momentum, not lag. (Julian)
- `components/project-strip.tsx`: The role a shade under the name, and both readable: the role at the muted grey (4.5:1 and up), the name lifted above it. (Julian)
- `components/sessions-screen.tsx`: Anywhere in the row goes to the booking page, bar its own links: a click on the row is a click on its name, the link a keyboard and a reader get, so it goes the way every link on the site goes. (Julian)
- `components/sessions-screen.tsx`: A session with a booking page goes there on a click; pointing still opens it here. (Julian)
- `components/sessions-screen.tsx`: Session details friendlier: the words in their own case, not the page's capitals, and more air between them. (Julian)
- `components/sessions-screen.tsx`: Book a session at the card's bottom right, the page's link on the left; under it where the column is too narrow for both, still at the right. (Julian)
- `components/site-footer.tsx`: The cities in the region, read out but not shown: Julian wanted the footer back to the region alone, with the cities still on the page for a search engine.
- `components/strip/deck.tsx`: A deck of screens (the homepage) mounts the one it lands on: coming back from the portfolio, the second screen's eight covers and logos were built inside the swap, while the screen held for 300ms. From the scroll-craft pass.
- `components/strip/deck.tsx`: Held-back sections were counted wrong. Coming back from the portfolio, that asked for more sections at every idle slot without end, and each one dealt the deck again: the hero lost its `data-buried` and its photographs showed under the glass as a grey band, and the paging lost its places and the wheel stuck. (Julian)
- `components/strip/deck.tsx`: A strip that keeps moving never rests for the idle path above, and ran on past openings with nothing behind them. (Julian)
- `components/strip/lenis.ts`: Not Lenis's `allowNestedScroll`, which read the computed style of everything under the pointer and laid the page out again for it: 20 to 35ms on the first notch of a push on the portfolio, the lag into the way back home. From the scroll-craft pass.
- `components/strip/lenis.ts`: Lenis watches the strip's box, not how far it scrolls, so the sections that arrive after a crossing (`defer`) never reached it: the wheel stopped at the second screen. (Julian)
- `components/strip/motion.ts`: The pull's layout is read with the rest, once a push, not on every notch of it: asked for after the pull's writes, it laid the homepage out again each notch. From the scroll-craft pass: 25ms a notch at full speed.
- `components/strip/rack.ts`: Coming through the door into the grid, Artist Presskit and Portraits stood where Editorial belonged. (Julian)
- `lib/alt-text.ts`: Written alt text starts with the photographs on the booking pages' covers.
- `lib/booking.ts`: Booking pages, "no vertical pages", San Jose and San Francisco mainly, "I can travel to any of those, LA and NY too", and "I don't need separate pages for each" city. (Julian)
- `lib/deck.ts`: The same at the other end: at a fractional width (150% zoom) a covered screen read 0.9997 covered and was never `data-buried`, and the hero's photographs showed under the footer's glass as a grey band. (Julian)
- `lib/seo.ts`: San Francisco and San Jose carry the most searches, and are the two markets every title names. Julian: "also market in San Jose".
- `lib/seo.ts`: The Bay Area as he means it runs to Santa Cruz. (Julian)
- `lib/seo.ts`: "Commercial" gave way to San Jose, where a search for a music video director finds only directories.
- `lib/seo.ts`: Structured data names LA and NY as places he travels to. Julian: "I can travel to ... LA and NY too".
- `lib/work.ts`: What the project page says about a photograph, as a sentence for its alt: the project, its discipline, who photographed it, who is in it and who it was for. Julian: the discipline and the credits.

### 2026-10-01

- `app/page.tsx`: The two doors split the screen under the bar, not behind it. (Julian, layout)
- `app/portfolio/(index)/page.tsx`: Scrolling back past the start goes home, to the hero, not to the last screen it left by.
- `app/styles/cover.css`: Chrome rasterises a layer inside the turned, perspective space at one pixel per CSS pixel, not the screen's two, so a 2x screen got a picture stretched to twice its raster (measured: SSIM 0.77 against the same file drawn flat).
- `app/styles/glass.css`: The play mark on a film (`video-grid.tsx`): a disc of clear glass, not a tile of the bar's frosted kind. Julian: circular, liquid glass, less background.
- `app/styles/header.css`: A screen's ground under the glass only while it is on top. Once the next one covers it (`data-buried`, `lib/deck.ts`) nothing covered the photos under the glass, which blurred them into a grey band over the footer of every other screen. Julian: both themes.
- `app/styles/header.css`: The menu's backdrop blur goes from four pixels to ten: Julian asked for a blur behind the menu, so four was not being seen.
- `app/styles/home.css`: About's portrait leads. (Julian, bolder)
- `app/styles/portfolio.css`: Spines: names stand up their cell, as the window's word does. (Julian)
- `app/styles/portfolio.css`: Spines and the window's word made the default, only where the work runs sideways. (Julian)
- `app/styles/strip-motion.css`: A slight shadow under a screen as it comes in, for the depth. (Julian)
- `app/styles/strip-motion.css`: Contact's title as wide as its column, on one line (two lines at the cover's scale were too big). (Julian)
- `app/styles/strip-motion.css`: Then: large, across, and over two lines when it is long (Julian: I WANNA BE A HUMAN in two lines).
- `components/contact-form.tsx`: The form lives on the homepage, so it is mounted long before a session's Inquire is pressed: Graduation landed here on Editorial, asking for a publication and an issue date.
- `components/contact-screen.tsx`: A sentence to a line where there is room. Where there is not, each sentence wraps balanced and set left: it was justified, and "project." stood on a line of its own. Julian: one word doesn't need a whole line.
- `components/intro.tsx`: The lift should reveal the hero. (Julian)
- `components/lead-window.tsx`: Past the last screen of the homepage, a peek of the portfolio, so the visitor knows it is opening. (Julian)
- `components/project-strip.tsx`: Not "Photographer: Julian Gigola" on a discipline that is a gallery (Places, Automotive, Event coverage): one of his own sets, not a job with a crew. Julian: the projects keep it.
- `components/sessions-screen.tsx`: The private client's verb, not the art director's. (Julian)
- `components/site-header.tsx`: The theme toggle is in the bar on a desktop only; under the burger it is in the menu (`site-menu.tsx`), at Julian's ask, so the bar holds the name and the burger and nothing else.
- `components/site-header.tsx`: Nav order: Portfolio last. (Julian)
- `components/site-menu.tsx`: The theme toggle moves out of the bar on a phone and an iPad and into the menu, at the foot. (Julian)
- `components/strip/cue.ts`: The page itself shows there is more. (Julian)
- `components/strip/deck.tsx`: Only the discipline being shown and the next. (Julian)
- `components/strip/paging.ts`: The site should scale smoothly while the window is dragged. (Julian)
- `lib/deck.ts`: A preview at `?flyout=1`: the deck the other way round. (Julian)
- `lib/deck.ts`: A slight shadow under a screen as it comes in (`deal-shade`).
- `lib/gl-warm.ts`: Except the shaders' own logs: asking for one still waited 53ms in Chrome, mid page crossing, so OGL is told they are empty.
- `lib/seo.ts`: The site should turn searches into bookings, in Google and Bing and in ChatGPT, Claude, Gemini and Perplexity. (Julian)
- `lib/work-view.ts`: The strip, for everybody who has not said otherwise; it is what the homepage's window shows (`lead-window.tsx`). (Julian)

### 2026-09-30

- `app/sitemap.ts`: Julian: "add lastmod dates and images to the sitemap".
- `app/styles/header.css`: The tint and the hairline are this layer's too: a tint each met where the footer's 38.19px ran into a `--foot` rounded to 38, and the sliver of both read as a line across the glass. Julian: still two panels.
- `app/styles/strip-motion.css`: A project's title on one line, and larger. (Julian)
- `components/page-transition.tsx`: Portfolio leads the bar, so the homepage's own screens (Sessions, About, Contact) sit to its right; only the wordmark's home is to its left. (Julian)
- `lib/work.ts`: Cover art has one again: its rack under the filters, scrolling sideways like every other discipline, rather than a page of its own scrolling down. (Julian)

### 2026-09-29

- `app/portfolio/(index)/discipline/[slug]/page.tsx`: Its own folder rather than a share of `/portfolio/[slug]` with the projects, but served at `/portfolio/<slug>` all the same: a rewrite in `next.config.ts` sends each listing's address here. Julian: the disciplines sit beside the projects, not under /portfolio/category/.
- `app/styles/home.css`: About's block in the middle of its screen. Julian marked it on his mockup.
- `app/styles/strip.css`: The index has about a hundred, and arriving at it did all of them before the zoom could start: the longest freeze on an iPad went from ~360ms to ~230ms (4x throttle).
- `app/styles/strip.css`: The rack is keyed off `data-rack`, not `[style*="--rack-w"]`: that selector made Chrome restyle a whole subtree on every inline style write, 22ms on /portfolio per write (measured).
- `components/about-screen.tsx`: A screen of the homepage (Julian: About and Contact on the home page, /about redirects to /#about), laid out from Julian's mockup: the words, the facts, the services and the ask on the left; a photograph from a set in the middle; how a commission runs on the right, a step a row.
- `components/about-screen.tsx`: The client marks along the foot of About are gone; his own words only. (Julian)
- `components/about-screen.tsx`: The photograph in the middle: Julian's own pick, him on stone steps under a tree.
- `components/about-screen.tsx`: About's text is Julian's own words.
- `components/contact-beam.tsx`: Mono: Julian took the colors off the form.
- `components/cover-space.tsx`: On a phone or an iPad the cover's space holds still. It followed the device's tilt there, until Julian took the gyroscope off the homepage.
- `components/sessions-screen.tsx`: A screen of the homepage, from Julian's design (Sessions Preview v2), and the only place sessions live since /sessions went (it redirects here).
- `components/sessions-screen.tsx`: With three columns the photograph sits further right (its margin, from about 1600px wide) and larger (to 56rem tall); the list keeps the plain gap after it, half the space it had. (Julian, red boxes)
- `components/sessions-screen.tsx`: Says what the count is, not the title again. (Julian)
- `lib/utils.ts`: A discipline and a project are both /portfolio/<slug>, so the address cannot tell them apart; the filter drawer, mounted on every /portfolio page, marks its links that are filters (`work-filter.tsx`). (Julian)
- `lib/work.ts`: Straight under /portfolio, like the projects, not under /portfolio/category/. (Julian)

### 2026-09-26

- `app/robots.ts`: AI search is let in, at Julian's ask: OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, DuckAssistBot, MistralAI-User and Meta-ExternalFetcher fetch a page to answer a question and cite it, and are off this list.
