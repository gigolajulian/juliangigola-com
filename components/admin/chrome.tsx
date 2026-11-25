import * as React from "react";
import { Orb } from "@/components/effects/orb";
import type { Status } from "@/lib/admin/publish";
import { cn } from "@/lib/utils";
import { TABS, type View } from "@/components/admin/editor/tabs";
import type { FullView as Column } from "@/components/admin/editor/use-full-view";

/** The switch at the head of a column. Only where there are columns. */
export function FullSwitch({ which, full, setFull }: { which: Column; full: Column | null; setFull: (c: Column | null) => void }) {
  return (
    <div className="sticky top-0 z-10 flex justify-end bg-background pb-2 max-xl:hidden">
      <button
        type="button"
        onClick={() => setFull(full === which ? null : which)}
        aria-pressed={full === which}
        className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
      >
        {full === which ? "Close full screen" : "Full screen"}
      </button>
    </div>
  );
}

/** The tabs and Publish, pinned to the top of the work column, with the progress line on its lower edge. */
export function EditorBar({
  status,
  awaitingDeploy,
  view,
  setView,
  unread,
  moved,
  dirty,
  committed,
  sha,
  publish,
}: {
  status: Status;
  awaitingDeploy: boolean;
  view: View;
  setView: (v: View) => void;
  unread: number;
  moved: Set<View>;
  dirty: boolean;
  committed: boolean;
  sha: string | null;
  publish: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 bg-background">
      {/* The bar, on the edge of the chrome rather than in the flow.
       *
       * Absolutely positioned on the header's own bottom border, the way
       * a browser puts its loading bar on the edge of the toolbar: it
       * appears and disappears without moving a single thing on the page,
       * which a bar occupying a row cannot do, and a form that jumps two
       * pixels every time you publish is worse than no bar at all.
       *
       * Proportional while committing, because that is countable. A sweep
       * while the deploy runs, because it is not: Cloudflare cannot be
       * asked how far along it is, and a bar creeping to 80% of nothing
       * is a lie in the shape of the truth. */}
      {status.kind === "working" || awaitingDeploy ? (
        <div
          role="progressbar"
          aria-label={awaitingDeploy ? "Waiting for the deploy" : "Publishing"}
          aria-valuenow={status.kind === "working" && status.total ? status.done : undefined}
          aria-valuemax={status.kind === "working" && status.total ? status.total : undefined}
          className="pointer-events-none absolute inset-x-0 -bottom-px z-30 h-px overflow-hidden bg-border"
        >
          {status.kind === "working" && status.total ? (
            <span
              // `scaleX` from the left rather than `width`: a width
              // change lays the row out again on every tick, a scale is
              // a compositor-only move. Linear, because progress is a
              // constant rate and an ease on it reads as stalling.
              className="block h-full w-full origin-left bg-foreground transition-transform duration-300 ease-linear"
              style={{
                transform: `scaleX(${(status.done ?? 0) / status.total})`,
              }}
            />
          ) : (
            <span className="sweep block h-full w-1/4 bg-foreground" />
          )}
        </div>
      ) : null}
      {/* Wraps, and the publish group never shrinks.
       *
       * This row was one unwrapping line of six shrink-0 tab groups
       * followed by Publish, and Publish is the thing that gave. In the
       * three-column workbench the middle column is 609px at 1440x900
       * and this row wants 691, so the button sat from x=953 to x=1043
       * against a column ending at 961: eighty-two pixels of it outside
       * its own box, clipped, with no scrollbar to reach it. "I make a
       * change and Publish doesn't show up" was exactly that, and the
       * flag beside it was fine all along.
       *
       * Wrapping rather than scrolling the tabs. A scroller hides tabs
       * behind a gesture nobody knows is available; a second line costs
       * 36px on a tool that has the room, and everything stays visible
       * and in the same place. */}
      <nav className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-2" aria-label="Editor sections">
        {/* A segmented control rather than three underlined words.
         *
         * These are the three halves of the tool and the one thing you
         * press most, so they get a surface: an underline on a lowercase
         * word reads as a link among links, and at this size the selected
         * one was legible only by a 2px rule. Filled, the current view is
         * obvious from across the desk, which is the same argument the
         * hero index makes for `bg-secondary` on its current row. */}
        {TABS.map((group, g) => (
          <span key={g} className="flex max-w-full flex-wrap border border-border p-0.5">
            {group.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                aria-current={view === t.id ? "true" : undefined}
                className={cn(
                  "label px-3 py-1.5 transition-colors duration-200",
                  view === t.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hoverable:hover:bg-card hoverable:hover:text-foreground",
                )}
              >
                {t.label}
                {t.id === "inbox" && unread > 0 ? (
                  <span className="ml-1.5 inline-block bg-live px-1 tabular-nums text-background">
                    {unread}
                    <span className="sr-only"> unread</span>
                  </span>
                ) : null}
                {moved.has(t.id) ? (
                  <span aria-label=", unpublished edits" className="ml-1.5 inline-block h-1 w-1 bg-current align-middle" />
                ) : null}
              </button>
            ))}
          </span>
        ))}
        {/* Publish, where the work is.
         *
         * There is a second one at the foot of the column, and that is the
         * point: the middle column is its own scroller now, so the bottom
         * bar is only sticky to the bottom of a panel you may be nowhere
         * near. An edit made near the top, dragging a frame, refiling a
         * shoot, had no way to be committed without scrolling back down
         * to look for the button.
         *
         * Always present and disabled rather than appearing when it has
         * something to do: a control that materialises shifts the row it is
         * in and has to be noticed before it can be used, whereas a greyed
         * one is a permanent answer to "where do I publish this". The
         * `title` says which of the two reasons it is grey. */}
        {/* `shrink-0`, so if anything in this row has to give it is not
        the one control the row exists for. */}
        <span className="ml-auto flex shrink-0 items-center gap-3 self-center">
          {/* Three states, because there are three.
           *
           * "Unpublished" and "live" are not opposites with nothing in
           * between: committing to GitHub and the change reaching the
           * public site are a couple of minutes apart, and that gap is
           * the one that needs saying. So the middle state is its own, published, not yet live, and it is the
           * one carrying the sweep.
           *
           * A dot as well as the words. The state that decides whether
           * Publish does anything should be readable without reading, and
           * at `label` size six words of grey text beside a grey button
           * is not. Green only for live, never for committed: "your work
           * is safe" and "the world can see it" are different promises
           * and only one of them is what green means here.
           *
           * `aria-live` so the change is announced rather than only
           * coloured, the whole point of this label is a state change you
           * are not necessarily watching for. */}
          <span aria-live="polite" className="label flex items-center gap-2">
            {/* Julian: a thinking orb while it works, and while
                the deploy is watched for; the dot otherwise. */}
            {status.kind === "working" || awaitingDeploy ? (
              <Orb state={awaitingDeploy ? "searching" : "working"} size={20} />
            ) : (
              <span aria-hidden className={cn("block size-1.5 rounded-full", dirty || committed ? "bg-foreground" : "bg-live")} />
            )}
            {/* Each word is a new node when the state changes, so
              `emerge` fades it in, "published" is the one completion
              moment the workbench has. */}
            {dirty ? (
              <span className="emerge text-foreground">unpublished</span>
            ) : awaitingDeploy ? (
              <span className="emerge text-muted-foreground">published &middot; going live</span>
            ) : committed ? (
              // The watch gave up, or there was no `/BUILD_ID` to watch.
              // The commit happened; whether it landed is unknown, and
              // green would claim otherwise.
              <span className="emerge text-muted-foreground">published</span>
            ) : (
              // Nothing pending. Either a deploy was seen landing, or this
              // page has published nothing, and it was itself served by
              // the current build, so what is on screen is what the public
              // site has.
              <span className="emerge text-live">live</span>
            )}
          </span>
          <button
            type="button"
            onClick={publish}
            disabled={!sha || !dirty || status.kind === "working"}
            title={
              !sha
                ? "Connect the GitHub token at the foot of this column first"
                : !dirty
                  ? "Nothing to publish: the draft matches the live site"
                  : undefined
            }
            className="label border border-foreground bg-foreground px-4 py-2 text-background press hoverable:hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-50"
          >
            {status.kind === "working" ? "Publishing…" : "Publish"}
          </button>
        </span>
      </nav>
    </div>
  );
}
