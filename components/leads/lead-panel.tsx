import { LayoutPanel, HStack, VStack, StackItem, Card } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Eyebrow } from "@/components/leads/desk-nav";
import { Next } from "@/components/leads/row";
import { ago, nextStep } from "@/lib/leads/lead-desk";
import { TZ } from "@/lib/time-zone";
import { shootTag, STAGES, type LeadSummary, type Stage as StageName } from "@/lib/leads/leads";

const ROAD: readonly StageName[] = STAGES.filter((s) => s !== "Lost");
export const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o });
export const date = (iso: string) => fmt({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

function Stage({ l }: { l: LeadSummary }) {
  const at = ROAD.indexOf(l.stage);
  return (
    <VStack gap={1}>
      <HStack gap={2} vAlign="center">
        <StackItem size="fill"><Text type="label">{l.stage}</Text></StackItem>
        {at >= 0 ? <Text type="code" size="xsm" color="secondary">{at + 1} of {ROAD.length}</Text> : null}
      </HStack>
      {at >= 0 ? <ProgressBar label="Stage" isLabelHidden value={at + 1} max={ROAD.length} /> : null}
    </VStack>
  );
}

/** The lead picked in the list, with its stage, its next step and its last words. */
export function OpenLeadPanel({ sel, waiting, open, snooze }: { sel: LeadSummary; waiting: boolean; open: () => void; snooze: () => void }) {
  return (
    <LayoutPanel width={400} hasDivider label="Open lead">
      <VStack gap={5}>
        <VStack gap={1}>
          <Eyebrow>{[sel.kind ? shootTag(sel.kind)?.toUpperCase() : null, sel.when ? date(sel.when) : null].filter(Boolean).join(" · ") || "LEAD"}</Eyebrow>
          <Heading level={2}>{sel.name}</Heading>
        </VStack>
        <Stage l={sel} />
        <Card variant="muted" padding={4}>
          <VStack gap={3}>
            <Eyebrow>NEXT</Eyebrow>
            {/* The step itself, large; the money flag and "waiting" read as the row does. */}
            {nextStep(sel) && !sel.flags?.length ? <Text type="large">{nextStep(sel)}</Text> : <Next l={sel} waiting={waiting} />}
            <HStack gap={2}>
              <Button label={nextStep(sel) ?? "Open lead"} variant="primary" onClick={open} />
              <Button label="Snooze" variant="ghost" onClick={snooze} />
            </HStack>
          </VStack>
        </Card>
        {sel.snippet ? (
          <VStack gap={2}>
            <Eyebrow>LAST MESSAGE · {ago(sel.lastAt).toUpperCase()} AGO</Eyebrow>
            <Text type="body">{sel.snippet}</Text>
          </VStack>
        ) : null}
        <Button label="Open lead" variant="secondary" onClick={open} />
      </VStack>
    </LayoutPanel>
  );
}
