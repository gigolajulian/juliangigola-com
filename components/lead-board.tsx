"use client";

import * as React from "react";
import { STAGES, type LeadSummary, type Stage } from "@/lib/leads";
import { cn } from "@/lib/utils";

/* ── the pipeline board ───────────────────────────────────────────
 * Julian (2026-11-08, board mock): "All open" as one column per stage,
 * Inquiry to Delivered, Lost left out. Desktop only. Each column shows
 * its count and the quotes entered on it. A card dropped on a column
 * sets that stage through the same PATCH the stage buttons send; the
 * stage buttons in the open lead stay the keyboard way to move one.
 * ─────────────────────────────────────────────────────────────── */

const COLUMNS: readonly Stage[] = STAGES.filter((s) => s !== "Lost");
/** Delivered keeps only the last month, so the column stays short; the sidebar's Delivered list has them all. */
const RECENT = 30 * 864e5;
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function LeadBoard({ leads, card, onMove }: { leads: LeadSummary[]; card: (l: LeadSummary) => React.ReactNode; onMove: (l: LeadSummary, stage: Stage) => void }) {
  const [over, setOver] = React.useState<Stage | null>(null);
  const dragged = React.useRef<LeadSummary | null>(null);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[repeat(7,minmax(168px,1fr))] overflow-x-auto">
      {COLUMNS.map((s) => {
        const rows = leads.filter((l) => l.stage === s && (s !== "Delivered" || Date.now() - Date.parse(l.stageAt) < RECENT));
        const quoted = rows.reduce((n, l) => n + (l.quote ?? 0), 0);
        return (
          <section
            key={s}
            aria-label={s}
            onDragOver={(e) => {
              if (!dragged.current) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== s) setOver(s);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === s ? null : o));
            }}
            onDrop={(e) => {
              e.preventDefault();
              const l = dragged.current;
              dragged.current = null;
              setOver(null);
              if (l && l.stage !== s) onMove(l, s);
            }}
            className={cn(
              "flex min-h-0 flex-col border-r border-border transition-colors duration-150 last:border-r-0",
              over === s && "bg-accent/[0.06] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--accent)_45%,transparent)]",
            )}
          >
            <p className="px-3 pb-1 pt-3 text-[13.5px] font-semibold">{s}{s === "Delivered" ? <span className="font-normal text-muted-foreground">, 30 d</span> : null}</p>
            <p className="flex justify-between border-b border-border px-3 pb-2.5 font-mono text-[12px] text-muted-foreground">
              <span>{rows.length}</span>
              <span>{quoted ? money(quoted) : null}</span>
            </p>
            <ul className="grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto p-2">
              {rows.map((l) => (
                <li
                  key={l.id}
                  draggable
                  onDragStart={(e) => {
                    dragged.current = l;
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", l.name);
                  }}
                  onDragEnd={() => { dragged.current = null; setOver(null); }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  {card(l)}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
