"use client";

/* ── /contract/<id>: the client reads and signs ───────────────────
 * A contract, signed on the site. The text, who it is
 * between, then their full name, their email, a drawn signature (or the
 * typed name, for keyboard only) and "I agree". The page posts
 * back the hash of the text it showed (`lib/contracts/contract.ts`). Same
 * proof.css as the delivery gate. Signed, it shows the record and Print.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import Link from "next/link";
import { isEmail } from "@/lib/utils";
import { isFullName, type PublicContract } from "@/lib/contracts/contract";
import { SignPad } from "@/components/contracts/sign-pad";
import { postJson } from "@/lib/http";
import { TZ } from "@/lib/time-zone";

const when = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, dateStyle: "long", timeStyle: "short" }).format(new Date(iso));

export function ContractSign({ id, initial }: { id: string; initial: PublicContract }) {
  const [signed, setSigned] = React.useState(initial.signed);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState(initial.to.email ?? "");
  const [agree, setAgree] = React.useState(false);
  const [mark, setMark] = React.useState<string | null>(null);
  const [typed, setTyped] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const full = isFullName(name.trim());
  const ready = full && (typed || !!mark) && isEmail(email) && agree;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return setErr(!full ? "Type your first and last name." : !typed && !mark ? "Sign in the box." : !isEmail(email) ? "That email does not look right." : "Tick I agree to sign.");
    setBusy(true);
    setErr(null);
    const r = await postJson<{ signed?: PublicContract["signed"] }>(`/api/contract/${id}`, { name: name.trim(), email: email.trim(), agree, hash: initial.hash, ...(typed ? { typed: true } : { mark }) });
    if (r.ok && r.data?.signed) setSigned(r.data.signed);
    else if (r.status === 0) setErr("You look offline. Try again when you are back online.");
    else setErr((!r.ok && r.error) || "That did not go through. Try again.");
    setBusy(false);
  };

  return (
    <div className="proof">
      <header className="proof-top">
        <Link className="proof-word" href="/">Julian Gigola</Link>
        <span />
        <p className="proof-meta">{signed ? <b>Signed</b> : "Contract"}</p>
      </header>
      <div className="proof-intro">
        <p className="proof-lab">Contract</p>
        <h1>{signed ? "Signed." : "Your contract."}</h1>
      </div>
      <main className="ctr">
        <div className="ctr-who">
          <p><b>From</b>{initial.from.map((l, i) => <React.Fragment key={i}>{l}<br /></React.Fragment>)}</p>
          <p><b>For</b>{[initial.to.name, initial.to.email, initial.to.address].filter(Boolean).map((l, i) => <React.Fragment key={i}>{l}<br /></React.Fragment>)}</p>
        </div>
        <div className="ctr-text">{initial.text}</div>
        {signed ? (
          <div className="ctr-done" role="status">
            <div className="ctr-mark">
              {signed.mark ? <svg viewBox="0 0 600 200" role="img" aria-label={`Signature of ${signed.name}`}><path d={signed.mark} /></svg> : <i>{signed.name}</i>}
            </div>
            <p>Signed by <b>{signed.name}</b> on {when(signed.at)}.</p>
            <p>SHA-256 of this text: {signed.hash}</p>
            <p>A copy is in your email.</p>
            <p className="ctr-print" style={{ marginTop: 24 }}><button type="button" className="proof-btn ghost" onClick={() => print()}>Print or save as PDF</button></p>
          </div>
        ) : (
          // No `name` on the fields: a tap before the script runs would put them in the URL.
          <form className="ctr-sign" onSubmit={submit} noValidate>
            <label>
              <span className="proof-lab">Full name</span>
              <input autoComplete="name" placeholder="First and last name" value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} />
            </label>
            <label>
              <span className="proof-lab">Your email</span>
              <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} />
            </label>
            <div className="ctr-sigf">
              <span className="proof-lab">Signature</span>
              {typed ? (
                <div className="ctr-pad ctr-typed"><i>{name.trim() || "Your name"}</i></div>
              ) : (
                <SignPad onChange={(m) => { setMark(m); setErr(null); }} />
              )}
              <button type="button" className="ctr-alt" onClick={() => { setTyped(!typed); setErr(null); }}>{typed ? "Draw it instead" : "Can't draw? Use your typed name"}</button>
            </div>
            <label className="ctr-agree">
              <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErr(null); }} />
              <span>I agree to this contract.</span>
            </label>
            {err ? <p className="proof-err" role="alert">{err}</p> : null}
            <button type="submit" className="proof-btn" data-off={!ready || busy || undefined}>{busy ? "Signing" : "Sign"}</button>
          </form>
        )}
      </main>
    </div>
  );
}
