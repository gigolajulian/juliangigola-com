"use client";

import * as React from "react";
import Link from "next/link";
import { TimePicker, type V3Book } from "@/components/time-picker";
import { DenseTimePicker } from "@/components/time-picker-dense";
import { isPaid } from "@/lib/paid";

/* ── the booking calendar ────────────────────────────────────────
 * The site's own time picker (`time-picker.tsx`, times from
 * `app/api/slots`). If the times do not come, the visitor gets a way to
 * try again, Inquire and the address, in the box the picker would fill.
 * Cal.com's calendar used to stand in here; it is gone (Julian, 2026-11-05).
 * ─────────────────────────────────────────────────────────────── */

const EMAIL = "hello@juliangigola.com";

function TimesDown({ title, className, retry }: { title: string; className?: string; retry: () => void }) {
  return (
    <div role="region" aria-label={title} className={`times-down relative ${className ?? ""}`}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
        <p className="max-w-[24rem] text-balance text-center text-sm normal-case leading-relaxed text-muted-foreground">
          Times didn&rsquo;t load. Try again, or send me an inquiry and I&rsquo;ll find a time with you.
        </p>
        <button type="button" onClick={retry} className="label inline-block action px-6 py-4 press active:scale-[0.97]">
          Try again
        </button>
        <Link
          prefetch={false}
          href="/#contact"
          className="inline-block border-b border-border text-sm uppercase leading-none tracking-[0.04em] transition-colors duration-200 hoverable:hover:border-current"
        >
          Inquire
        </Link>
        <a href={`mailto:${EMAIL}`} className="text-sm normal-case text-muted-foreground underline decoration-border underline-offset-4 hoverable:hover:decoration-current">
          {EMAIL}
        </a>
      </div>
    </div>
  );
}

/** The site's own time picker for `path`. `className` sizes the box.
    `v3`: the JG V3 stepper; `?dense` keeps its own look inside it. */
export function CalEmbed({ path, title, className, v3 }: { path: string; title: string; className?: string; v3?: V3Book }) {
  /* `?dense`: the tighter picker while it is tried (time-picker-dense.tsx). */
  const [dense, setDense] = React.useState<boolean | null>(null);
  // Try again mounts a fresh picker, which asks for the times anew.
  const [tries, setTries] = React.useState(0);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDense(new URLSearchParams(window.location.search).has("dense"));
  }, []);
  const paid = isPaid(path.split("/")[1]);
  const wrap = (body: React.ReactNode) => (v3 ? v3.shell({ steps: [], at: 1, head: paid ? "Book a session" : v3.name === "Consultation" ? "Book a consultation" : "Book a call", body, sum: [] }) : body);
  if (dense === null) return wrap(<div aria-label={title} className={className} />);
  const down = <TimesDown title={title} className={className} retry={() => setTries((n) => n + 1)} />;
  // `?dense` has no deposit step: a paid session keeps the main picker.
  return dense && !paid ? (
    wrap(<DenseTimePicker key={tries} path={path} title={title} className={className} fallback={down} />)
  ) : (
    <TimePicker key={tries} path={path} title={title} className={className} fallback={down} v3={v3} />
  );
}
