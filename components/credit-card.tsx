"use client";

import * as React from "react";
import { HoverCard } from "radix-ui";

/* ── who that is ──────────────────────────────────────────────────
 * A credit on a project page is a person's name and a link that takes the
 * visitor off the site. Held for a beat it says who they are first: their
 * face, their handle set large, and the way out under it.
 *
 * The photograph is ours, kept in `public/people` and written by /admin
 * when the person was added. Instagram is asked nothing at all from here:
 * its own picture addresses are signed and expire within days, so a page
 * that linked one would be printing broken circles a week later, and a
 * page that fetched one would be sending every visitor who happens to
 * hover a name to Instagram's servers.
 *
 * With no picture on file the circle is simply not there and the handle
 * carries the card. That is the common case until Julian has added a few,
 * and it has to read as a decision rather than as a hole.
 *
 * `HoverCard` from the unified `radix-ui` package the lightbox already
 * imports: pointer and keyboard only, by its own definition, so a phone
 * never opens one and the link behaves exactly as it always has.
 * ─────────────────────────────────────────────────────────────── */
/* A pointer that can hover, which is the whole premise. On a touch screen
   the tap is the link and the card would be a flash of something on its way
   to Instagram, so there is no card at all: the same rule `hoverable:` in
   `globals.css` applies to every other hover on the site. */
const HOVERS = "(hover: hover) and (pointer: fine)";
const subscribeHover = (onChange: () => void) => {
  const mq = window.matchMedia(HOVERS);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

export function CreditCard({
  handle,
  name,
  role,
  avatar,
  children,
}: {
  handle: string;
  name: string;
  role: string;
  /** A path under `public/`, or nothing. See `avatarFor` in `lib/work.ts`. */
  avatar?: string;
  /** The credit's own link, untouched. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const hovers = React.useSyncExternalStore(
    subscribeHover,
    () => window.matchMedia(HOVERS).matches,
    // The server draws the card's page; a phone corrects itself on
    // hydration, before anybody's finger has arrived.
    () => true,
  );

  /* Six of the harvested credits are the handle and nothing else, so the
     card would have printed "@anisajadee" twice, once large and once as
     the name under it. The line under the handle is only for a person who
     has a name of their own on file. */
  const named = name.replace(/^@/, "").toLowerCase() !== handle.toLowerCase();

  /* The credits sit inside a strip that can be dragged, and a card left
     hanging over a moving sequence is a card that has lost its anchor.
     Any movement of the scroller closes it. */
  React.useEffect(() => {
    if (!open) return;
    const shut = () => setOpen(false);
    const el = document.querySelector(".strip-scroll");
    el?.addEventListener("scroll", shut, { passive: true });
    return () => el?.removeEventListener("scroll", shut);
  }, [open]);

  if (!hovers) return children;

  return (
    <HoverCard.Root
      open={open}
      onOpenChange={setOpen}
      openDelay={200}
      closeDelay={80}
    >
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="start"
          sideOffset={10}
          collisionPadding={16}
          /* The pointer's own word is the link's; the card is not a
             control and asks for none. */
          data-ring=""
          className="z-50 w-[17rem] rounded-xl border border-border glass-surface bg-popover/90 p-4 text-popover-foreground shadow-xl"
          /* Out of the trigger it was opened from, rather than out of its
             own middle: the card belongs to the name it explains. */
          style={{
            transformOrigin: "var(--radix-hover-card-content-transform-origin)",
            animation: "jg-credit-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both",
          }}
        >
          <div className="flex items-start gap-3">
            {avatar ? (
              /* A plain `img`: 100px of JPEG that is already the size it is
                 drawn at has nothing to gain from a transformation, and a
                 face that has not arrived yet must not shift the words
                 beside it, so the box holds its place either way. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                width={56}
                height={56}
                loading="lazy"
                draggable={false}
                className="size-14 shrink-0 rounded-full object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <p className="font-display truncate text-xl uppercase leading-none tracking-[0]">
                @{handle}
              </p>
              <p className="label mt-1.5 truncate text-muted-foreground">
                {named ? name : ""}
                {named && role ? " · " : ""}
                {role}
              </p>
              {/* A line of words saying "Open on Instagram" that could not
                  be opened. The name that raises the card is a link, but a
                  pointer that has travelled into the card is already past
                  it, and this is what it arrives at. Julian found it.
                  Its own anchor, so pressing the words does what they say. */}
              <a
                href={`https://www.instagram.com/${handle}/`}
                target="_blank"
                rel="noreferrer"
                data-ring="Open"
                className="label mt-3 inline-block text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground focus-visible:text-foreground"
              >
                Open on Instagram &#8599;
              </a>
            </div>
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
