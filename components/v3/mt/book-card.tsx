"use client";

import * as React from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { V3BookFlow } from "@/components/v3/book";
import { BOOK_ROWS, type BookRow } from "./data";
import { RowPhoto, detailOf } from "./book-online";

/* Spec 3.6: one fixed card (1040x636 at 1440x900) round the LIVE booking
   flow: `V3BookFlow` with its own picker, Cal.com events, Stripe deposit and
   copy, untouched. The card adds the photo panel, the five tabs, Close and
   the footer link; mtscroll.css lays the flow's rail, body and bar into the
   card. Radix Dialog: focus trap, Esc, click outside, focus back to the
   opener. Week first: the live picker opens on Month (use-picker.tsx), so
   the card presses its Week once per tab. */
const DETAILS: Partial<Record<BookRow["key"], string>> = { portraits: "/portraits", headshots: "/headshots", graduation: "/graduation-photos", "studio-digitals": "/model-digitals" };

function useWeekFirst(box: React.RefObject<HTMLDivElement | null>, key: string | null) {
  React.useEffect(() => {
    if (!key) return;
    let done = false;
    let mo: MutationObserver | null = null;
    const press = () => {
      const el = box.current;
      const wk = el?.querySelector<HTMLButtonElement>('.cal-top .seg button[aria-pressed="false"]:first-child');
      if (!el || done) return;
      if (el.querySelector(".cal.week")) done = true;
      else if (wk) {
        wk.click();
        done = true;
      }
      if (done) mo?.disconnect();
    };
    const t = setTimeout(() => {
      mo = new MutationObserver(press);
      if (box.current) mo.observe(box.current, { childList: true, subtree: true });
      press();
    }, 0);
    return () => {
      clearTimeout(t);
      mo?.disconnect();
    };
  }, [box, key]);
}

export function BookCard({ at, onTab, onClose, onBack }: { at: BookRow["key"] | null; onTab: (k: BookRow["key"]) => void; onClose: () => void; onBack: () => void }) {
  const r = BOOK_ROWS.find((x) => x.key === at) ?? BOOK_ROWS[0];
  const box = React.useRef<HTMLDivElement>(null);
  useWeekFirst(box, at);
  const lines = [r.len, r.what, r.ready ? `Ready in ${r.ready}` : null, r.price].filter(Boolean) as string[];
  return (
    <Dialog.Root open={!!at} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <div className="v3 contents">
          <Dialog.Overlay className="mt-dim mt-dim-b" data-lenis-prevent />
          <Dialog.Content className="mt-card mt-bk" data-lenis-prevent aria-describedby={undefined} onCloseAutoFocus={(e) => { e.preventDefault(); onBack(); }}>
            <span className="mt-handle" aria-hidden />
            <figure className="mt-bk-ph">
              {BOOK_ROWS.map((x) => <RowPhoto key={x.key} r={x} on={x.key === r.key} sizes="(max-width: 1023px) 100vw, 420px" />)}
              <figcaption>
                <b>{r.name}</b>
                <ul className="lbl">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
              </figcaption>
            </figure>
            <div className="mt-bk-form">
              <div className="mt-bk-band">
                <Dialog.Title className="mt-bk-t">{r.name}</Dialog.Title>
                <Dialog.Close className="mt-x" aria-label="Close">
                  <span aria-hidden>&times;</span>
                </Dialog.Close>
              </div>
              <div className="mt-bk-tabs" role="tablist" aria-label="Session">
                {BOOK_ROWS.map((x) => (
                  <button key={x.key} type="button" role="tab" aria-selected={x.key === r.key} onClick={() => onTab(x.key)}>
                    <b>{x.name}</b>
                    <span>{x.price}</span>
                  </button>
                ))}
              </div>
              <div className="mt-bk-flow" ref={box} role="tabpanel" aria-label={r.name}>
                {r.slug ? (
                  <V3BookFlow key={r.slug} slug={r.slug} tabs={false} />
                ) : (
                  /* Test shoot: no live session yet (no SESSIONS / EVENTS entry). The card keeps its place. */
                  <div className="flow mt-bk-none">
                    <div className="f-main">
                      <div className="f-body">
                        <p className="mt-detail">{detailOf(r)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {DETAILS[r.key] ? (
                <Link className="mt-link mt-bk-more" href={DETAILS[r.key]!}>More about {r.name.toLowerCase()}</Link>
              ) : null}
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
