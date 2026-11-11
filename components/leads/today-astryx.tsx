"use client";

/* ── Today on Astryx ──────────────────────────────────────────────
 * Julian (2026-11-10) approved the mock (claude.ai/artifact/WWQy2jVbaeTG7sdDKgGmU5,
 * #today): greeting and one line, four tiles (On you, This week, Stripe,
 * Visits), Your move, what falls due on paperwork, proofs and licences,
 * and the week Mon to Sun in the rail. Same numbers as the classic Today
 * (components/leads/today.tsx): lead summaries, /api/money, /api/traffic.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Layout, LayoutContent, LayoutHeader, LayoutPanel, HStack, VStack, StackItem, Card } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { List, ListItem } from "@astryxdesign/core/List";
import { Badge } from "@astryxdesign/core/Badge";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { isLate, paperDue, shootTag, type LeadSummary } from "@/lib/leads/leads";
import { adminCall, authed, ago, aside, at, cash, closed, inboxCall, needsMe, nextStep, now, pass, plusDays, renew, ymdPT } from "@/lib/leads/lead-desk";
import { balance, dayB, dueOf, overdue, usd } from "@/lib/leads/invoice";
import type { InvoiceRow } from "@/components/leads/invoices-astryx";
import { TZ } from "@/lib/booking/booking-rules";

/* Today's helpers, from the retired classic desk (`components/leads/today.tsx`). */
const clock = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(ms);
/** Where a move comes from, as the mock tags it. */
export const source = (l: LeadSummary) => (renew(l) ? "Licence" : paperDue(l, now()) ? "Paperwork" : l.stage === "Invoiced" || l.stage === "Selecting" ? "Proofs" : "Leads");
export const callOrShoot = (l: LeadSummary) => (l.stage === "Call booked" ? "Call" : shootTag(l.kind) ?? "Shoot");

export type DayEv = { small: string; text: string; who?: string; due?: boolean; l: LeadSummary };

/** Each Pacific day from `from` for `n` days, with what is on it. Moves with no date land today. */
export function daysOf(leads: LeadSummary[], from: string, n: number) {
  const today = ymdPT(now());
  const map = new Map<string, DayEv[]>();
  const put = (d: string, e: DayEv) => map.set(d, [...(map.get(d) ?? []), e]);
  for (const l of leads) {
    if (aside(l)) continue;
    const who = l.name || l.email;
    if (l.when && !closed(l.stage)) {
      const ms = Date.parse(l.when);
      put(ymdPT(ms), { small: `${clock(ms)} ${callOrShoot(l)}`, text: who, l });
    }
    const step = needsMe(l) ? nextStep(l) : null;
    if (step) put(today, { small: "Due", text: step, who, due: true, l });
    else if (l.due && Date.parse(l.due) > now()) put(ymdPT(Date.parse(l.due)), { small: "Reminder", text: l.dueText || "Your reminder", who, l });
  }
  return Array.from({ length: n }, (_, i) => plusDays(from, i)).map((d) => ({ d, today: d === today, evs: map.get(d) ?? [] }));
}

export type Spark = { visits: number; days: { key: string; n: number }[] };


type Size = "phone" | "mid" | "wide";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text type="code" size="xsm" color="secondary" weight="medium">{children}</Text>;
}

function Tile({ k, v, sub, onClick }: { k: string; v: React.ReactNode; sub: React.ReactNode; onClick?: () => void }) {
  return (
    <Card padding={4}>
      <VStack gap={1}>
        <Eyebrow>{k.toUpperCase()}</Eyebrow>
        <Heading level={2}>{v}</Heading>
        <Text type="code" size="sm" color="secondary">{sub}</Text>
        {onClick ? <StackItem><Button label="Open" variant="ghost" size="sm" onClick={onClick} /></StackItem> : null}
      </VStack>
    </Card>
  );
}

export function TodayAstryx({ leads, size, open, show }: { leads: LeadSummary[]; size: Size; open: (l: LeadSummary) => void; show: () => void }) {
  const today = ymdPT(now());
  const monday = plusDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const week = daysOf(leads, monday, 7);
  const moves = leads.filter(needsMe).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const late = moves.filter((l) => isLate(l, now())).length;
  const booked = week.filter((x) => x.d >= today).flatMap((x) => x.evs.filter((e) => !e.due && e.small !== "Reminder"));
  const calls = booked.filter((e) => e.l.stage === "Call booked").length;
  const shoots = booked.length - calls;
  const coming = leads.filter((l) => pass(l, "upcoming")).sort((a, b) => a.when!.localeCompare(b.when!));
  const nextShoot = coming.find((l) => l.stage !== "Call booked");
  const nextCall = coming.find((l) => l.stage === "Call booked");
  const weekday = (iso: string) => (ymdPT(Date.parse(iso)) === today ? "today" : new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(new Date(iso)));
  const line = [moves.length ? `${moves.length} on you` : null, nextShoot ? `a shoot ${weekday(nextShoot.when!)}` : null, nextCall ? `a call ${weekday(nextCall.when!)}` : null].filter(Boolean).join(", ");
  const hour = +new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now());
  const hello = hour >= 5 && hour < 12 ? "Morning" : hour >= 12 && hour < 18 ? "Afternoon" : "Evening";
  // Your move splits in two: replies and quotes, then what falls due on paperwork, proofs and licences.
  const leadMoves = moves.filter((l) => source(l) === "Leads");
  const dueMoves = moves.filter((l) => source(l) !== "Leads");

  const [money, setMoney] = React.useState<{ available?: number; pending?: number } | string | null>(null);
  React.useEffect(() => {
    adminCall<{ available?: number; pending?: number }>("/api/money").then(setMoney).catch(() => setMoney("Not connected"));
  }, []);
  // Traffic answers to the inbox key or the GitHub token, like the other admin routes.
  const [traffic, setTraffic] = React.useState<Spark | string | null>(null);
  React.useEffect(() => {
    if (!Object.keys(authed()).length) return queueMicrotask(() => setTraffic("Inbox key or GitHub token needed"));
    adminCall<Spark>("/api/traffic").then(setTraffic).catch(() => setTraffic("Cloudflare did not answer"));
  }, []);
  // Unpaid invoices past their due date, oldest due first.
  const [pastDue, setPastDue] = React.useState<InvoiceRow[]>([]);
  React.useEffect(() => {
    inboxCall<{ invoices: InvoiceRow[] }>({ query: "?invoices" })
      .then((o) => setPastDue(o.invoices.filter((i) => overdue(i, today)).sort((a, b) => dueOf(a).localeCompare(dueOf(b)))))
      .catch(() => {});
  }, [today]);
  const m = typeof money === "object" ? money : null;
  const t = typeof traffic === "object" ? traffic : null;

  const row = (l: LeadSummary) => (
    <ListItem
      key={l.id}
      align="first-line"
      onClick={() => open(l)}
      startContent={<StatusDot variant={l.unread ? "accent" : "neutral"} label={l.unread ? "New" : "Read"} />}
      label={<Text type="large" weight="semibold">{l.name || l.email}</Text>}
      description={
        <VStack gap={1}>
          <Eyebrow>{[l.kind ? shootTag(l.kind)?.toUpperCase() : null, l.stage.toUpperCase(), ago(l.lastAt).toUpperCase()].filter(Boolean).join(" · ")}</Eyebrow>
          {nextStep(l) ? <Text type="code" size="sm" color="accent">{nextStep(l)} →</Text> : null}
        </VStack>
      }
    />
  );

  const rail = (
    <VStack gap={4}>
      <Heading level={2}>This week</Heading>
      <VStack gap={3}>
        {week.map(({ d, today: isToday, evs }) => (
          <HStack key={d} gap={3} vAlign="start">
            <VStack gap={0} width={40}>
              <Eyebrow>{new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase()}</Eyebrow>
              <Text type="large" weight={isToday ? "bold" : undefined} color={isToday ? "accent" : undefined}>{+d.slice(8)}</Text>
            </VStack>
            <StackItem size="fill">
              <VStack gap={1}>
                {evs.length ? evs.map((e, i) => (
                  <Button key={i} variant="ghost" size="sm" onClick={() => open(e.l)}
                    label={`${e.small} · ${e.text}${e.who && e.who !== e.text ? `, ${e.who}` : ""}`} />
                )) : <Text type="supporting" color="secondary">Nothing</Text>}
              </VStack>
            </StackItem>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );

  return (
    <Layout
      height="fill"
      defaultHasDividers
      header={
        <LayoutHeader>
          <VStack gap={0}>
            <Eyebrow>{new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(now()).toUpperCase()}</Eyebrow>
            <Heading level={1} weight="bold">{hello}, Julian.</Heading>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent role="main" label="Today" padding={4}>
          <VStack gap={6}>
            <Text type="large" color="secondary">{line ? `${line[0].toUpperCase()}${line.slice(1)}.` : "Nothing on the books this week."}</Text>
            <Grid columns={{ minWidth: 170 }} gap={3}>
              <Tile k="On you" v={String(moves.length)} sub={late ? `${late} late` : "none late"} onClick={() => show()} />
              <Tile k="This week" v={`${shoots} ${shoots === 1 ? "shoot" : "shoots"}`} sub={`${calls} ${calls === 1 ? "call" : "calls"}`} />
              <Tile k="Stripe" v={m ? cash(m.available ?? 0) : "–"} sub={m ? `${cash(m.pending ?? 0)} on the way` : typeof money === "string" ? money : "Asking Stripe"} />
              <Tile k="Visits, 7 d" v={t ? t.visits.toLocaleString("en-US") : "–"} sub={t ? "Cloudflare" : typeof traffic === "string" ? traffic : "Asking Cloudflare"} />
            </Grid>
            <VStack gap={1}>
              <HStack vAlign="center"><StackItem size="fill"><Eyebrow>YOUR MOVE · {leadMoves.length}</Eyebrow></StackItem><Button label="All leads" variant="ghost" size="sm" onClick={() => show()} /></HStack>
              {leadMoves.length ? <List hasDividers>{leadMoves.slice(0, 6).map(row)}</List> : <Text type="supporting" color="secondary">Nothing waiting on you.</Text>}
            </VStack>
            {pastDue.length ? (
              <VStack gap={1}>
                <Eyebrow>OVERDUE · {pastDue.length}</Eyebrow>
                <List hasDividers>
                  {pastDue.map((i) => {
                    const l = leads.find((x) => x.id === i.lead);
                    return <ListItem key={i.no} onClick={l ? () => open(l) : undefined} label={`${i.name}, invoice ${i.no}`} description={`${usd(balance(i))} was due ${dayB(dueOf(i), true)}${i.sentAt ? "" : " · not sent"}`} endContent={<Badge label="Overdue" variant="error" />} />;
                  })}
                </List>
              </VStack>
            ) : null}
            {dueMoves.length ? (
              <VStack gap={1}>
                <Eyebrow>DUE · PAPERWORK, PROOFS, LICENCES</Eyebrow>
                <List hasDividers>
                  {dueMoves.map((l) => (
                    <ListItem key={l.id} onClick={() => open(l)} label={nextStep(l) ?? l.stage} description={`${l.name || l.email}${l.when ? ` · ${callOrShoot(l)} ${at(l.when)}` : ""}`} endContent={<Badge label={source(l)} variant={source(l) === "Proofs" ? "blue" : "neutral"} />} />
                  ))}
                </List>
              </VStack>
            ) : null}
            {size === "wide" ? null : rail}
          </VStack>
        </LayoutContent>
      }
      end={size === "wide" ? <LayoutPanel width={340} hasDivider label="This week">{rail}</LayoutPanel> : undefined}
    />
  );
}
