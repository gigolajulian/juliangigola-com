"use client";

import * as React from "react";
import Link from "next/link";
import { TimePicker, type StepsSkin } from "@/components/booking/time-picker";

/* ── the booking calendar ────────────────────────────────────────
 * The site's own time picker (`time-picker.tsx`, times from
 * `app/api/slots`). If the times do not come, the visitor gets a way to
 * try again, Inquire and the address, in the box the picker would fill. * ─────────────────────────────────────────────────────────────── */

const EMAIL = "hello@juliangigola.com";

function TimesDown({ title, className, retry, again }: { title: string; className?: string; retry: () => void; again: boolean }) {
  return (
    <div role="region" aria-label={title} className={`times-down flex flex-col ${className ?? ""}`}>
      {/* In flow, so the v3 stepper (no fixed box) makes room for it. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
        {/* role=alert: a screen reader hears that the times failed, not silence. */}
        <p role="alert" className="max-w-[24rem] text-balance text-center text-sm normal-case leading-relaxed text-muted-foreground">
          Times didn&rsquo;t load. Try again, or send me an inquiry and I&rsquo;ll find a time with you.
        </p>
        {/* After a Try again that failed too, focus comes back here, not to the page top. */}
        <button type="button" onClick={retry} autoFocus={again} className="label inline-block action px-6 py-4 press active:scale-[0.97]">
          Try again
        </button>
        <Link
          prefetch={false}
          href="/contact/form"
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
    `skin`: the JG V3 stepper. */
export function BookTimes({ path, title, className, skin, startView }: { path: string; title: string; className?: string; skin?: StepsSkin; startView?: "week" | "month" }) {
  // Try again mounts a fresh picker, which asks for the times anew.
  const [tries, setTries] = React.useState(0);
  /* The picker reads the visitor's zone and clock, so until it has mounted it
     draws its empty box (`TimePicker`). It is the one element here from the
     server on: a <FlowShell> swapped for a <TimePicker> remounted the whole
     shell, photo and all, at hydration (LCP on /book, 2026-11-21). */
  const down = <TimesDown title={title} className={className} retry={() => setTries((n) => n + 1)} again={tries > 0} />;
  return <TimePicker key={tries} path={path} title={title} className={className} fallback={down} skin={skin} startView={startView} />;
}
