# What changed on juliangigola.com

One entry per release, newest first, for anyone who uses the site: what changed for them, in a sentence or two. The
version is version.json's (set at each release to the same number as its tag);
`node scripts/check-version.mjs` fails when they disagree. Technical detail stays in the PRs.

## Unreleased

Behind the scenes: two library security patches.

In Safari on a standard screen, a mouse wheel now moves the home page as far per notch as everywhere else.

The Motion section on the home page is a short list of films: point at one to preview it, click to open it on the Motion page. The cover art slides in as you scroll, and a mouse wheel moves the home page further per notch.

The Motion section on the home page now shows the Ladera Granola film.

The name and tagline at the top of the home page are placed for each screen size, and the tagline stays on one line.

On a phone, the session packages on the booking page show dots under the cards, so you can see where you are as you swipe.

The Motion row on the home page now reads Director of Photography.

Booking, galleries and the contact form recover from a slow or failing service on their own, and the daily limit on
the contact form holds even when many messages arrive at once.

Films can show captions (the CC button or the c key), the About photos and the footer still stop turning while you
point at them or tab into them, and the booking time answers the Up and Down keys.

The booking time labels are easier to read, the film seek bar is easier to hit on a touch screen, and the light theme
looks the same whether you pick it on the site or your device does.

The opening splash on the home page runs lighter on phones and tablets: the photos stay sharp as they rush past.

Moving the pointer around the site does less work in the background.

The leads board scrolls with a trackpad again.
