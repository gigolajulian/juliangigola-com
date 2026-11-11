"use client";

/* ── the board on Astryx ──────────────────────────────────────────
 * Julian (2026-11-10) approved the mock (claude.ai/artifact/WWQy2jVbaeTG7sdDKgGmU5,
 * #board): one column per stage, Inquiry to Delivered, a card per lead.
 * The drag is the classic LeadBoard's (components/leads/lead-board.tsx):
 * a card dropped on a column sends the same stage PATCH. Delivered keeps
 * the last 30 days. The lead page's stage picker is the keyboard way.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { HStack, VStack, StackItem, Card } from "@astryxdesign/core/Layout";
import { ScrollableArea } from "@astryxdesign/core/ScrollableArea";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { STAGES, shootTag, type LeadSummary, type Stage } from "@/lib/leads/leads";
import { money, nextStep } from "@/lib/leads/lead-desk";

const COLUMNS: readonly Stage[] = STAGES.filter((s) => s !== "Lost");
const RECENT = 30 * 864e5;

export function BoardAstryx({ leads, onMove, open }: { leads: LeadSummary[]; onMove: (l: LeadSummary, stage: Stage) => void; open: (l: LeadSummary) => void }) {
  const [over, setOver] = React.useState<Stage | null>(null);
  const dragged = React.useRef<LeadSummary | null>(null);
  // Read once: "the last 30 days" does not need to move while the board is open.
  const [now] = React.useState(() => Date.now());

  return (
    <ScrollableArea axis="inline" label="Board">
      <HStack gap={3} vAlign="start">
        {COLUMNS.map((s) => {
          const rows = leads.filter((l) => l.stage === s && (s !== "Delivered" || now - Date.parse(l.stageAt) < RECENT));
          const quoted = rows.reduce((n, l) => n + (l.quote ?? 0), 0);
          return (
            // Native drop targets: the drag events live on plain elements.
            <section
              key={s}
              aria-label={s}
              onDragOver={(e) => {
                if (!dragged.current) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== s) setOver(s);
              }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === s ? null : o)); }}
              onDrop={(e) => {
                e.preventDefault();
                const l = dragged.current;
                dragged.current = null;
                setOver(null);
                if (l && l.stage !== s) onMove(l, s);
              }}
              style={{ width: 210, flexShrink: 0, borderRadius: 10, outline: over === s ? "1px solid var(--color-accent)" : "none", outlineOffset: 2 }}
            >
              <VStack gap={2}>
                <HStack vAlign="center">
                  <StackItem size="fill"><Text type="code" size="xsm" color="secondary" weight="medium">{s.toUpperCase()}{s === "Delivered" ? " · 30 D" : ""}</Text></StackItem>
                  <Text type="code" size="xsm" color="secondary">{rows.length}{quoted ? ` · ${money(quoted)}` : ""}</Text>
                </HStack>
                {rows.map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={(e) => { dragged.current = l; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.name); }}
                    onDragEnd={() => { dragged.current = null; setOver(null); }}
                    style={{ cursor: "grab" }}
                  >
                    <Card padding={3}>
                      <VStack gap={1}>
                        <Text type="label">{l.name || l.email}</Text>
                        <Text type="code" size="xsm" color="secondary">{[l.kind ? shootTag(l.kind)?.toUpperCase() : null, l.quote ? money(l.quote) : null].filter(Boolean).join(" · ") || " "}</Text>
                        {nextStep(l) ? <Text type="code" size="sm" color="accent">{nextStep(l)} →</Text> : null}
                        <StackItem><Button label="Open" variant="ghost" size="sm" onClick={() => open(l)} /></StackItem>
                      </VStack>
                    </Card>
                  </div>
                ))}
                {rows.length ? null : <Text type="supporting" color="secondary">Drop here</Text>}
              </VStack>
            </section>
          );
        })}
      </HStack>
    </ScrollableArea>
  );
}
