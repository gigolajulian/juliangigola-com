import * as React from "react";
import { Orb } from "@/components/effects/orb";
import type { Status } from "@/lib/admin/publish";
import { inputClass } from "@/components/admin/admin-fields";
import { REPO } from "@/lib/admin/admin-github";
import { cn } from "@/lib/utils";

/* The token box and the status line under the editor (`admin-editor.tsx`). */

export function Connect({
  token,
  setToken,
  onConnect,
  status,
}: {
  token: string;
  setToken: (v: string) => void;
  onConnect: () => void;
  status: Status;
}) {
  return (
    <div className="mt-12 max-w-prose">
      <ol className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <li>
          <span className="text-foreground">1.</span> Open{" "}
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            GitHub&rsquo;s fine-grained token page
          </a>
          .
        </li>
        <li>
          <span className="text-foreground">2.</span> Repository access:{" "}
          <em>Only select repositories</em> &rarr; <code>juliangigola-com</code>
          . Permissions: <em>Contents</em> &rarr; <em>Read and write</em>.
          Nothing else. That is the only thing this page does.
        </li>
        <li>
          <span className="text-foreground">3.</span> Give it an expiry you are
          happy with, then paste it below. It is kept in this browser only, and
          sent only to GitHub.
        </li>
      </ol>

      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onConnect();
        }}
      >
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_…"
          autoComplete="off"
          spellCheck={false}
          aria-label="GitHub token"
          className={cn(inputClass, "font-mono")}
        />
        <button
          type="submit"
          disabled={!token.trim() || status.kind === "working"}
          className="label self-start border border-foreground bg-foreground px-6 py-4 text-background press hoverable:hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          {status.kind === "working" ? "Connecting…" : "Connect"}
        </button>
        <StatusLine status={status} />
      </form>
    </div>
  );
}

export function StatusLine({ status }: { status: Status }) {
  if (status.kind === "idle") return null;

  return (
    <p
      // Announced, because the outcome of a publish is the whole point and it
      // happens away from where the pointer is.
      role="status"
      className={cn(
        "flex items-center gap-2 text-sm",
        status.kind === "error" ? "text-accent" : "text-muted-foreground",
      )}
    >
      {status.kind === "working" ? <Orb state="connecting" size={20} /> : null}
      {status.message}
      {status.kind === "saved" ? (
        <>
          {" "}
          <a
            // Workers Builds, not GitHub Actions — the workflow file is gone
            // and deploys are driven from the Cloudflare side now.
            href={`https://github.com/${REPO.owner}/${REPO.repo}/commits/${REPO.branch}`}
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            Watch the deploy
          </a>
        </>
      ) : null}
    </p>
  );
}
