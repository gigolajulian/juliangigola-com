"use client";

/* ── a gallery's password, before anything of it loads ────────────
 * A gallery can carry a password. The
 * server renders only this until the gate's cookie is right, so no frame
 * id or file name reaches the page first. The plain gate's card look
 * (proof.css), centered on an empty page. Paste and password managers work.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import Link from "next/link";

export function PassGate({ id, kind }: { id: string; kind: "proofs" | "photos" }) {
  const [value, setValue] = React.useState("");
  const [bad, setBad] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const field = React.useRef<HTMLInputElement>(null);
  const submit = async () => {
    if (!value) return setBad("Add the password.");
    setBusy(true);
    setBad(null);
    try {
      const res = await fetch(`/api/proof/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "unlock", password: value }) });
      if (res.ok) return location.reload();
      setBad(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not work. Try again.");
    } catch {
      setBad("No connection. Try again.");
    }
    setBusy(false);
    field.current?.focus();
  };
  return (
    <div className="proof">
      <header className="proof-top">
        <Link className="proof-word" href="/">Julian Gigola</Link>
      </header>
      <div className="proof-pass">
        {/* No `name` on the field: a tap before the script runs would put the password in the URL. */}
        <form className="proof-card" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div>
            <p className="proof-lab">{kind === "proofs" ? "Proofs" : "Your photos"} · Private</p>
            <h1>Enter the password.</h1>
          </div>
          <label>
            <span className="proof-lab">Password</span>
            <input ref={field} type={shown ? "text" : "password"} autoComplete="current-password" autoFocus required value={value} aria-invalid={!!bad || undefined} aria-describedby={bad ? "pass-err" : undefined}
              onChange={(e) => { setValue(e.target.value); setBad(null); }} />
          </label>
          <button type="button" className="proof-show" aria-pressed={shown} onClick={() => setShown((s) => !s)}>{shown ? "Hide" : "Show"} password</button>
          {bad ? <p id="pass-err" className="proof-err" role="alert">{bad}</p> : null}
          <button type="submit" className="proof-btn" disabled={busy} data-off={!value || undefined}>{busy ? "Checking" : `Open ${kind}`}</button>
          <p className="proof-mu">The password is in the email I sent, or ask me at <a href="mailto:hello@juliangigola.com" className="underline underline-offset-4">hello@juliangigola.com</a>.</p>
        </form>
      </div>
    </div>
  );
}

/** Closed or offline, in the gallery's own words. */
export function Shut({ offline }: { offline?: boolean }) {
  return (
    <main className="grid min-h-svh place-items-center px-6 font-mono text-[13px] text-muted-foreground">
      <p>
        {offline ? "This gallery is offline." : "This gallery closed."} <a href="mailto:hello@juliangigola.com" className="underline underline-offset-4">hello@juliangigola.com</a>
      </p>
    </main>
  );
}
