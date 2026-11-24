"use client";

/* ── Today on Astryx ──────────────────────────────────────────────
 * Greeting and one line, four tiles (On you, This week, Stripe,
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
import { Divider } from "@astryxdesign/core/Divider";
import { About, joinParts, Age, Next } from "@/components/leads/row";
import { dueTasks, isLate, paperDue, shootTag, type LeadSummary, type TaskRow } from "@/lib/leads/leads";
import { dayShort } from "@/components/leads/plan";
import { ago, isSetAside, dateTimeLabel, centsLabel, isFinishedStage, deskCall, needsMe, nextStep, now, inFilter, plusDays, needsRenewal, ymdPT, type Size } from "@/lib/leads/lead-desk";
import { adminCall, authed } from "@/lib/admin/admin-call";
import { balance, shortDate, dueOf, overdue, usd } from "@/lib/leads/invoice";
import type { InvoiceRow } from "@/components/leads/invoices";
import { TZ } from "@/lib/time-zone";
import { proofApi, feed, type FeedItem, type ProofRow } from "@/lib/proofs/desk";

/* Today's helpers, from the retired classic desk. */
const clock = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(ms);
/** Where a move comes from, as the mock tags it. */
export const source = (l: LeadSummary) => (needsRenewal(l) ? "Licence" : paperDue(l, now()) ? "Paperwork" : l.stage === "Invoiced" || l.stage === "Selecting" ? "Proofs" : "Leads");
/** A date is a call while the call is booked, and stays one once it is done and the quote is out: a quoted lead cannot have shot yet. */
export const isCall = (l: LeadSummary) => l.stage === "Call booked" || (l.stage === "Quoted" && !!l.when && Date.parse(l.when) < now());
export const callOrShoot = (l: LeadSummary) => (isCall(l) ? "Call" : shootTag(l.kind) ?? "Shoot");

export type DayEv = { small: string; text: string; who?: string; due?: boolean; l: LeadSummary };

/** Each Pacific day from `from` for `n` days, with what is on it. Moves with no date land today. */
export function daysOf(leads: LeadSummary[], from: string, n: number) {
  const today = ymdPT(now());
  const map = new Map<string, DayEv[]>();
  const put = (d: string, e: DayEv) => map.set(d, [...(map.get(d) ?? []), e]);
  for (const l of leads) {
    if (isSetAside(l)) continue;
    const who = l.name || l.email;
    if (l.when && !isFinishedStage(l.stage)) {
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



function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text type="code" size="xsm" color="secondary" weight="medium">{children}</Text>;
}

/** One number of the strip: the figure, then what it counts. Four share one row, phone included. */
function Stat({ v, sub }: { v: React.ReactNode; sub: React.ReactNode }) {
  return (
    <VStack gap={0.5}>
      <Text type="large" weight="bold" hasTabularNumbers textWrap="nowrap">{v}</Text>
      <Text type="supporting" size="xsm" maxLines={1}>{sub}</Text>
    </VStack>
  );
}
const many = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const Title = ({ children, count }: { children: React.ReactNode; count?: React.ReactNode }) => (
  <HStack gap={2} vAlign="center"><Text type="label" weight="semibold">{children}</Text>{count != null ? <Text type="supporting">{count}</Text> : null}</HStack>
);

export function TodayDesk({ leads, size, open, show }: { leads: LeadSummary[]; size: Size; open: (l: LeadSummary) => void; show: () => void }) {
  const today = ymdPT(now());
  const monday = plusDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const week = daysOf(leads, monday, 7);
  const moves = leads.filter(needsMe).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const late = moves.filter((l) => isLate(l, now())).length;
  // the whole week, days already past included: the card under it lists them, and a call done on Saturday is still this week's call
  const booked = week.flatMap((x) => x.evs.filter((e) => !e.due && e.small !== "Reminder"));
  const calls = booked.filter((e) => isCall(e.l)).length;
  const shoots = booked.length - calls;
  const coming = leads.filter((l) => inFilter(l, "upcoming")).sort((a, b) => a.when!.localeCompare(b.when!));
  const nextShoot = coming.find((l) => l.stage !== "Call booked");
  const nextCall = coming.find((l) => l.stage === "Call booked");
  const weekday = (iso: string) => (ymdPT(Date.parse(iso)) === today ? "today" : new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(new Date(iso)));
  const line = [moves.length ? `${moves.length} on you${late ? `, ${late} late` : ""}` : null, nextShoot ? `a shoot ${weekday(nextShoot.when!)}` : null, nextCall ? `a call ${weekday(nextCall.when!)}` : null].filter(Boolean).join(", ");
  const hour = +new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now());
  const hello = hour >= 5 && hour < 12 ? "Morning" : hour >= 12 && hour < 18 ? "Afternoon" : "Evening";
  // Your move splits in two: replies and quotes, then what falls due on paperwork, proofs and licences.
  const leadMoves = moves.filter((l) => source(l) === "Leads");
  const dueMoves = moves.filter((l) => source(l) !== "Leads");

  const [money, setMoney] = React.useState<{ available?: number; pending?: number } | string | null>(null);
  React.useEffect(() => {
    adminCall<{ available?: number; pending?: number }>("/api/money").then(setMoney).catch(() => setMoney("Not connected"));
  }, []);
  // Traffic answers to the admin key or the GitHub token, like the other admin routes.
  const [traffic, setTraffic] = React.useState<Spark | string | null>(null);
  React.useEffect(() => {
    if (!Object.keys(authed()).length) return queueMicrotask(() => setTraffic("Inbox key or GitHub token needed"));
    adminCall<Spark>("/api/traffic").then(setTraffic).catch(() => setTraffic("Cloudflare did not answer"));
  }, []);
  // Unpaid invoices past their due date, oldest due first.
  const [pastDue, setPastDue] = React.useState<InvoiceRow[]>([]);
  React.useEffect(() => {
    deskCall<{ invoices: InvoiceRow[] }>({ path: "/invoices" })
      .then((o) => setPastDue(o.invoices.filter((i) => overdue(i, today)).sort((a, b) => dueOf(a).localeCompare(dueOf(b)))))
      .catch(() => {});
  }, [today]);
  // Gallery activity across every gallery, from the proofs list (never `?token=`, which marks selects as pulled).
  const [acts, setActs] = React.useState<FeedItem[] | null>(null);
  React.useEffect(() => {
    proofApi<{ proofs: ProofRow[] }>({ query: "?list" }).then((o) => setActs(feed(o.proofs))).catch(() => setActs([]));
  }, []);
  // Every lead's open tasks (`?tasks`), due within a week or late; leads put aside are left out, as Your move leaves them.
  const [taskRows, setTaskRows] = React.useState<TaskRow[] | string | null>(null);
  React.useEffect(() => {
    deskCall<{ tasks: TaskRow[] }>({ path: "/tasks" }).then((o) => setTaskRows(o.tasks ?? [])).catch(() => setTaskRows("Tasks did not load"));
  }, []);
  const due = dueTasks((Array.isArray(taskRows) ? taskRows : []).filter((t) => leads.some((l) => l.id === t.lead && !isSetAside(l))), today);
  const lateBy = (d: string) => Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${d}T12:00:00Z`)) / 864e5);
  const whenDue = (d: string) => (d === today ? "Today" : d === plusDays(today, 1) ? "Tomorrow" : new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }));
  const m = typeof money === "object" ? money : null;
  const t = typeof traffic === "object" ? traffic : null;

  const row = (l: LeadSummary) => (
    <ListItem
      key={l.id}
      align="first-line"
      onClick={() => open(l)}
      startContent={<StatusDot variant={l.unread ? "accent" : "neutral"} label={l.unread ? "New" : "Read"} />}
      label={<HStack gap={2} vAlign="center"><StackItem size="fill"><Text type="large" weight="semibold">{l.name || l.email}</Text></StackItem><Age l={l} /></HStack>}
      description={
        <VStack gap={1}>
          <About>{joinParts([l.kind ? shootTag(l.kind) : null, l.stage])}</About>
          <Next l={l} />
        </VStack>
      }
    />
  );

  /* The week as one card: seven day cells, then what is booked or set as a reminder. The steps that are
   * due (`e.due`) are the Your move list itself, so they are not repeated here. */
  const dayName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const agenda = week.flatMap(({ d, today: isToday, evs }) => evs.filter((e) => !e.due).map((e) => ({ d, isToday, e })));
  const rail = (
    <VStack gap={2}>
      <Title count={`${many(shoots, "shoot")}, ${many(calls, "call")}`}>This week</Title>
      <Card padding={0}>
        <VStack gap={0}>
          <Grid columns={7} gap={0}>
            {week.map(({ d, today: isToday, evs }) => {
              const on = evs.filter((e) => !e.due).length;
              return (
                <VStack key={d} gap={1} hAlign="center" padding={2}>
                  <Text type="code" size="2xs" weight="medium" color={isToday ? "accent" : "secondary"}>{isToday ? "TODAY" : dayName(d).toUpperCase()}</Text>
                  <Text type="large" weight="bold" hasTabularNumbers color={isToday ? "accent" : d < today ? "disabled" : "primary"}>{+d.slice(8)}</Text>
                  {on ? <StatusDot variant="accent" label={`${on} on ${dayName(d)}`} /> : <Text type="code" size="2xs" color="disabled">·</Text>}
                </VStack>
              );
            })}
          </Grid>
          <Divider />
          {agenda.length ? (
            <List hasDividers>
              {agenda.map(({ d, isToday, e }, i) => (
                <ListItem key={i} onClick={() => open(e.l)}
                  label={`${e.text}${e.who && e.who !== e.text ? `, ${e.who}` : ""}`}
                  description={`${isToday ? "Today" : `${dayName(d)} ${+d.slice(8)}`} · ${e.small}`} />
              ))}
            </List>
          ) : <VStack padding={3}><Text type="supporting" color="secondary">Nothing booked this week.</Text></VStack>}
        </VStack>
      </Card>
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
            <Card padding={3}>
              <Grid columns={size === "phone" ? 2 : 5} gap={2}>
                <Stat v={moves.length} sub="on you" />
                <Stat v={Array.isArray(taskRows) ? due.length : "–"} sub={typeof taskRows === "string" ? taskRows : !taskRows ? "Asking for tasks" : due.some((x) => x.late) ? `tasks due, ${due.filter((x) => x.late).length} late` : "tasks due"} />
                <Stat v={shoots || !calls ? many(shoots, "shoot") : many(calls, "call")} sub={shoots && calls ? `and ${many(calls, "call")}` : "this week"} />
                <Stat v={m ? centsLabel(m.available ?? 0) : "–"} sub={m ? (m.pending ? `${centsLabel(m.pending)} on the way` : "Stripe") : typeof money === "string" ? money : "Asking Stripe"} />
                {/* a phone keeps four tiles, two by two; visits stay on Numbers > Traffic there */}
                {size === "phone" ? null : <Stat v={t ? t.visits.toLocaleString("en-US") : "–"} sub={t ? "visits, 7 d" : typeof traffic === "string" ? traffic : "Asking Cloudflare"} />}
              </Grid>
            </Card>
            {size === "phone" ? rail : null}
            {due.length ? (
              <VStack gap={1}>
                <Title count={due.length}>Tasks due</Title>
                <List hasDividers>
                  {due.map((x) => {
                    const l = leads.find((y) => y.id === x.lead);
                    return <ListItem key={`${x.lead}-${x.id}`} onClick={l ? () => open(l) : undefined} label={x.text} description={x.name}
                      endContent={x.late ? <Badge label={lateBy(x.due!) === 1 ? "1 day late" : `${lateBy(x.due!)} days late`} variant="warning" /> : <Text type="code" size="sm" color="secondary" textWrap="nowrap">{x.due! <= plusDays(today, 6) ? whenDue(x.due!) : dayShort(x.due!)}</Text>} />;
                  })}
                </List>
              </VStack>
            ) : null}
            <VStack gap={1}>
              <HStack vAlign="center"><StackItem size="fill"><Title count={leadMoves.length}>Your move</Title></StackItem><Button label="All leads" variant="ghost" onClick={() => show()} /></HStack>
              {leadMoves.length ? <List hasDividers>{leadMoves.map(row)}</List> : <Text type="supporting" color="secondary">Nothing waiting on you.</Text>}
            </VStack>
            {pastDue.length ? (
              <VStack gap={1}>
                <Title count={pastDue.length}>Overdue</Title>
                <List hasDividers>
                  {pastDue.map((i) => {
                    const l = leads.find((x) => x.id === i.lead);
                    return <ListItem key={i.no} onClick={l ? () => open(l) : undefined} label={`${i.name}, invoice ${i.no}`} description={`${usd(balance(i))} was due ${shortDate(dueOf(i), true)}${i.sentAt ? "" : " · not sent"}`} endContent={<Badge label="Overdue" variant="error" />} />;
                  })}
                </List>
              </VStack>
            ) : null}
            {dueMoves.length ? (
              <VStack gap={1}>
                {/* a number, so Your move and Due add up to "on you" above; each row badges its own kind */}
                <Title count={dueMoves.length}>Due</Title>
                <List hasDividers>
                  {dueMoves.map((l) => (
                    <ListItem key={l.id} onClick={() => open(l)} label={nextStep(l) ?? l.stage} description={`${l.name || l.email}${l.when ? ` · ${callOrShoot(l)} ${dateTimeLabel(l.when)}` : ""}`} endContent={<Badge label={source(l)} variant={source(l) === "Proofs" ? "blue" : "neutral"} />} />
                  ))}
                </List>
              </VStack>
            ) : null}
            <VStack gap={1}>
              <Eyebrow>GALLERY ACTIVITY</Eyebrow>
              {acts?.length ? (
                <List hasDividers>
                  {acts.map((a, i) => {
                    const l = leads.find((x) => x.email.toLowerCase() === a.email);
                    return <ListItem key={`${a.token}-${a.email}-${a.at}-${i}`} onClick={l ? () => open(l) : undefined} label={`${a.who} ${a.what}`} description={`${a.gallery} · ${ago(a.at)}`} />;
                  })}
                </List>
              ) : <Text type="supporting" color="secondary">{acts ? "No gallery activity yet." : "Loading galleries"}</Text>}
            </VStack>
          </VStack>
        </LayoutContent>
      }
      end={size === "phone" ? undefined : <LayoutPanel width={size === "wide" ? 340 : 320} hasDivider label="This week">{rail}</LayoutPanel>}
    />
  );
}
