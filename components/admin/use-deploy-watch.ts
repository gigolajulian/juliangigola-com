import * as React from "react";

/* The deploy after a publish, watched until it lands (`admin-editor.tsx`). */
export function useDeployWatch() {
  /**
   * Whether the deploy carrying the last publish has landed.
   *
   * Committing to GitHub and the change being on the site are a couple of
   * minutes apart, and until now the editor said nothing about that gap —
   * "Committed" was the last word, and whether the public site had caught up
   * was something to go and check by hand.
   *
   * `/BUILD_ID` is a file Next emits and the Worker serves as a static asset,
   * so the build the site is running has a name this page can read. Recorded
   * on mount, polled after a publish, and when it differs the deploy has
   * landed. Strictly it means *a* new build is live rather than specifically
   * yours — but the only thing that triggers a build is a commit to `main`,
   * and you just made one.
   *
   * Null where it cannot be read at all. `next dev` does not serve the file,
   * so locally this stays null and the indicator simply never claims to be
   * live, which is better than claiming it wrongly.
   */
  const built = React.useRef<string | null>(null);
  /** Set the moment a publish succeeds, so the wait has something to watch. */
  const [awaitingDeploy, setAwaitingDeploy] = React.useState(false);
  /**
   * Whether this session committed something whose deploy is unconfirmed.
   *
   * Distinct from `live` so the label can stop short of claiming green. If the
   * watch times out, or `/BUILD_ID` cannot be read at all, the honest answer
   * is "committed, and I do not know whether it has landed" — which is what
   * "published" says and what "live" would not.
   */
  const [committed, setCommitted] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    // The effect body only reads; state is set in the callback, after the
    // request comes back, rather than synchronously during the effect.
    void fetch("/BUILD_ID", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .then((id) => {
        if (!cancelled) built.current = id?.trim() ?? null;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Polls for the deploy, and stops as soon as it lands.
   *
   * Ten seconds, because a Cloudflare build is minutes: a tighter loop would
   * be dozens of requests to learn nothing. It gives up after five minutes —
   * a build that has not landed by then has failed or queued, and a bar that
   * sweeps for ever is worse than one that stops and lets you look.
   */
  React.useEffect(() => {
    if (!awaitingDeploy || built.current === null) return;

    const started = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - started > 5 * 60_000) {
        setAwaitingDeploy(false);
        return;
      }
      void fetch("/BUILD_ID", { cache: "no-store" })
        .then((r) => (r.ok ? r.text() : null))
        .then((next) => {
          if (!next || next.trim() === built.current) return;
          built.current = next.trim();
          setCommitted(false);
          setAwaitingDeploy(false);
        })
        .catch(() => {});
    }, 10_000);
    return () => window.clearInterval(id);
  }, [awaitingDeploy]);

  return { built, awaitingDeploy, setAwaitingDeploy, committed, setCommitted };
}
