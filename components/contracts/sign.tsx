"use client";

/* ── /contract/<id>: the client reads and signs ───────────────────
 * Julian (2026-11-15): Format's contract, on the site. The text, who it is
 * between, then their full name, their email and "I agree". The page posts
 * back the hash of the text it showed (`lib/contracts/contract.ts`). Same
 * proof.css as the delivery gate. Signed, it shows the record and Print.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import Link from "next/link";
import { isEmail } from "@/lib/proofs/proof";
import type { PublicContract } from "@/lib/contracts/contract";

const when = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", dateStyle: "long", timeStyle: "short" }).format(new Date(iso));

export function ContractSign({ id, initial }: { id: string; initial: PublicContract }) {
  const [signed, setSigned] = React.useState(initial.signed);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState(initial.to.email ?? "");
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const ready = name.trim().length >= 2 && isEmail(email) && agree;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return setErr(!agree ? "Tick I agree to sign." : name.trim().length < 2 ? "Type your full name." : "That email does not look right.");
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/contract/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), email: email.trim(), agree, hash: initial.hash }) });
      const o = (await r.json().catch(() => ({}))) as { signed?: PublicContract["signed"]; error?: string };
      if (o.signed) setSigned(o.signed);
      else setErr(o.error ?? "That did not go through. Try again.");
    } catch {
      setErr("You look offline. Try again when you are back online.");
    } finally {
      setBusy(false);
    }
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
            <p>Signed by <b>{signed.name}</b> on {when(signed.at)}.</p>
            <p>SHA-256 of this text: {signed.hash}</p>
            <p>A copy is in your email.</p>
            <p className="ctr-print" style={{ marginTop: 24 }}><button type="button" className="proof-btn ghost" onClick={() => print()}>Print or save as PDF</button></p>
          </div>
        ) : (
          // No `name` on the fields: a tap before the script runs would put them in the URL.
          <form className="ctr-sign" onSubmit={submit} noValidate>
            <p className="proof-mu" style={{ margin: 0 }}>Type your full name to sign. It counts as your signature.</p>
            <label>
              <span className="proof-lab">Full name</span>
              <input autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} />
            </label>
            <label>
              <span className="proof-lab">Your email</span>
              <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} />
            </label>
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
