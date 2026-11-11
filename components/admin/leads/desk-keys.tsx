"use client";

import * as React from "react";
import { type LeadSummary } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { LEAD_KEYS, leadKey, typingIn } from "@/lib/lead-keys";
import { kindOf } from "@/components/admin/leads/shared";
import { type Filter, matches } from "@/lib/lead-desk";

/**
 * Julian (2026-11-08): keyboard shortcuts. List keys live here, on capture so
 * an open overlay can keep them from the lead; the lead's own keys live in
 * Detail. Nothing renders until a key opens it, so the phone never sees it.
 */
function DeskKeys({ leads, shown, open, setOpen, jump, pick, refresh }: { leads: LeadSummary[]; shown: LeadSummary[]; open: string | null; setOpen: (id: string | null) => void; jump: (l: LeadSummary) => void; pick: (f: Filter) => void; refresh: () => void }) {
  const [palette, setPalette] = React.useState(false);
  const [help, setHelp] = React.useState(false);
  // Where the open lead sat: once read, it can drop out of Your move, and J / K go on from its place.
  const row = React.useRef(-1);
  React.useEffect(() => {
    const i = shown.findIndex((l) => l.id === open);
    if (i >= 0 || !open) row.current = i;
  });
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const k = leadKey(e, typingIn(e.target), false);
      if (palette) {
        // Its own field takes the rest; Cmd K again closes it.
        if (k?.do === "palette") { e.preventDefault(); setPalette(false); }
        return;
      }
      if (help) {
        if (!k) return;
        e.preventDefault();
        if (k.do === "close" || k.do === "help") setHelp(false);
        return;
      }
      if (!k) return;
      if (k.do === "palette") setPalette(true);
      else if (k.do === "help") setHelp(true);
      else if (k.do === "new") pick("new");
      else if (k.do === "refresh") refresh();
      else if (k.do === "move") {
        const i = shown.findIndex((l) => l.id === open);
        // Gone from the list: the row below has slid into its place, so J stays put.
        const to = i >= 0 ? i + k.by : row.current < 0 ? 0 : row.current + (k.by < 0 ? -1 : 0);
        const next = shown[Math.min(shown.length - 1, Math.max(0, to))];
        if (!next?.id) return;
        setOpen(next.id);
        document.querySelector(`[data-lead="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: "nearest" });
      } else return;
      e.preventDefault();
    };
    addEventListener("keydown", on, true);
    return () => removeEventListener("keydown", on, true);
  });
  if (palette) return <Palette leads={leads} close={() => setPalette(false)} go={jump} />;
  if (!help) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={() => setHelp(false)} className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto mt-[16vh] w-[min(420px,calc(100%-32px))] rounded-[14px] border border-border bg-background p-5 shadow-2xl">
        <p className="pb-3 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">Shortcuts</p>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2.5 text-[14.5px]">
          {LEAD_KEYS.map(([k, t]) => (
            <React.Fragment key={k}><dt>{t}</dt><dd className="text-right font-mono text-[12.5px] text-muted-foreground">{k}</dd></React.Fragment>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Cmd K: jump to any lead by name, email or type of shoot. */
function Palette({ leads, close, go }: { leads: LeadSummary[]; close: () => void; go: (l: LeadSummary) => void }) {
  const [q, setQ] = React.useState("");
  const [at, setAt] = React.useState(0);
  const words = q.trim().toLowerCase();
  const hits = leads.filter((l) => !l.trashedAt && matches(l, words)).sort((a, b) => b.lastAt.localeCompare(a.lastAt)).slice(0, 8);
  const choose = (l?: LeadSummary) => { if (!l) return; close(); go(l); };
  return (
    <div role="dialog" aria-modal="true" aria-label="Jump to a lead" onMouseDown={(e) => e.target === e.currentTarget && close()} className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto mt-[16vh] w-[min(520px,calc(100%-32px))] overflow-hidden rounded-[14px] border border-border bg-background shadow-2xl">
        <input
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setAt(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            else if (e.key === "ArrowDown") setAt((i) => Math.min(hits.length - 1, i + 1));
            else if (e.key === "ArrowUp") setAt((i) => Math.max(0, i - 1));
            else if (e.key === "Enter") choose(hits[at]);
            else return;
            e.preventDefault();
          }}
          placeholder="Jump to a lead"
          aria-label="Jump to a lead"
          className="min-h-12 w-full border-b border-border bg-transparent px-4 text-[15px] outline-none placeholder:text-muted-foreground"
        />
        {hits.length ? (
          <ul className="max-h-[50vh] overflow-y-auto py-1">
            {hits.map((l, i) => (
              <li key={l.id}>
                <button type="button" onMouseEnter={() => setAt(i)} onClick={() => choose(l)} aria-current={i === at ? "true" : undefined} className={cn("flex w-full items-baseline gap-3 px-4 py-2.5 text-left", i === at && "bg-card shadow-[inset_3px_0_0_var(--accent)]")}>
                  <span className="truncate text-[15px] font-medium">{l.name}</span>
                  <span className="truncate font-mono text-[12px] text-muted-foreground">{[kindOf(l.kind), l.email].filter(Boolean).join(" · ")}</span>
                  <span className="ml-auto shrink-0 font-mono text-[12px] text-muted-foreground">{l.stage}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-[14.5px] text-muted-foreground">Nothing matches.</p>
        )}
      </div>
    </div>
  );
}

export { DeskKeys };
