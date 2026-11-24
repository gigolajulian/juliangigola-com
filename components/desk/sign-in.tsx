"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { btn, primary } from "@/components/desk/chrome";
import { KEY_STORE, saveAdminKey, TOKEN_STORE } from "@/lib/admin/admin-github";
import { localGet } from "@/lib/storage";

/** The admin key, pasted once per device. On the iPhone the installed app keeps
    its own storage apart from Safari, so it asks once there too. A password
    field, so a password manager can fill it. */
export function SignIn({ onKey, wrong }: { onKey: (k: string) => void; wrong: boolean }) {
  const [adminKey, setAdminKey] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (adminKey.trim()) onKey(adminKey.trim());
      }}
      className="grid max-w-md gap-4 py-10 normal-case"
    >
      <h1 className="sr-only">Leads</h1>
      <label htmlFor="lead-key" className="text-[15px]">
        Admin key or GitHub token
      </label>
      <input
        id="lead-key"
        type="password"
        autoComplete="current-password"
        value={adminKey}
        onChange={(e) => setAdminKey(e.target.value)}
        className="min-h-12 rounded-[10px] border border-border bg-background px-4 text-base normal-case"
      />
      {wrong ? <p className="text-[15px] text-destructive">That was not accepted. Paste it again.</p> : null}
      <details className="text-[15px] text-muted-foreground">
        <summary className="flex size-11 cursor-pointer list-none items-center font-mono text-[15px]" aria-label="How to get one">
          ?
        </summary>
        <div className="grid gap-2 pt-2 leading-[1.55]">
          <p>Easiest: paste the same GitHub token I use for /admin on desktop.</p>
          <p>
            To make one on this phone: github.com, Settings, Developer settings, Fine-grained tokens, Generate new token. Repository access:
            only gigolajulian/juliangigola-com. Permissions: Contents, Read and write.
          </p>
          <p>It stays on this device only.</p>
        </div>
      </details>
      <button type="submit" className={cn(btn, primary, "justify-self-start")}>
        Open leads
      </button>
    </form>
  );
}

/** A desk's locked state: sign-in, marked wrong when a key or token is already kept (it was refused). `retry` loads the desk again after a key is kept. */
export function LockedGate({ retry }: { retry: () => void }) {
  return (
    <SignIn
      onKey={(k) => {
        saveAdminKey(k);
        retry();
      }}
      wrong={!!(localGet(KEY_STORE) || localGet(TOKEN_STORE))}
    />
  );
}
