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
import { TOKEN_STORE } from "@/lib/admin/admin-github";
import { isLate, shootTag, type LeadSummary } from "@/lib/leads/leads";
import { adminCall, ago, at, cash, needsMe, nextStep, now, pass, plusDays, ymdPT } from "@/lib/leads/lead-desk";
import { TZ } from "@/lib/booking/booking-rules";
import { callOrShoot, daysOf, source, type Spark } from "@/components/leads/today";

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
  // Traffic answers to the GitHub token only, as on /admin.
  const [traffic, setTraffic] = React.useState<Spark | string | null>(null);
  React.useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORE);
    if (!token) return queueMicrotask(() => setTraffic("GitHub token needed"));
    fetch("/api/traffic", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (r) => { const o = await r.json(); if (!r.ok) throw new Error(o.error); setTraffic(o); })
      .catch(() => setTraffic("Cloudflare did not answer"));
  }, []);
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
