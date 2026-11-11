"use client";

/* ── Calendar on Astryx ───────────────────────────────────────────
 * Julian (2026-11-10) approved the mock (claude.ai/artifact/WWQy2jVbaeTG7sdDKgGmU5,
 * #calendar and #availability): one Calendar page, two tabs.
 * Bookings: the week from the picked day, his leads' calls and sessions
 * beside the rest of hello@ and the calendars it reads (as LeadUpcoming).
 * Availability: pick a day or a run of days, block them or some hours,
 * unblock, see what is open and the Portraits starts left, and manage the
 * calendars it reads (as LeadCalendar). Both talk to /api/calendar.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Layout, LayoutContent, LayoutHeader, LayoutPanel, HStack, VStack, StackItem } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TimeInput } from "@astryxdesign/core/TimeInput";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { List, ListItem } from "@astryxdesign/core/List";
import { Calendar, type DateRange, type ISODateString } from "@astryxdesign/core/Calendar";
import { Token } from "@astryxdesign/core/Token";
import { Divider } from "@astryxdesign/core/Divider";
import { EVENTS, HOURS, TZ } from "@/lib/booking/booking-rules";
import { startsFor, zoned } from "@/lib/booking/slots";
import { errorText } from "@/lib/leads/lead-desk";
import type { LeadSummary } from "@/lib/leads/leads";
import { calendarCall, daysOf, openSpans, type Busy, type Ev, type Month } from "@/components/leads/lead-calendar";

type Size = "phone" | "mid" | "wide";
const dayOf = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(ms);
const plus = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
const ymd = (day: string) => day.split("-").map(Number) as [number, number, number];
const time = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(ms).replace(":00", "");
const range = (a: number, b: number) => `${time(a)} to ${time(b)}`;
const spoken = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const iso = (d: string) => d as ISODateString;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text type="code" size="xsm" color="secondary" weight="medium">{children}</Text>;
}

/** What /api/calendar has between two days, refetched on `tick`. */
function useRange(from: string, to: string, tick: number) {
  const [data, setData] = React.useState<Month | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    calendarCall<Month>({ query: `?from=${from}&to=${to}` }).then((o) => live && (setData(o), setError(null)), (e: unknown) => live && setError(errorText(e)));
    return () => void (live = false);
  }, [from, to, tick]);
  const byDay = React.useMemo(() => {
    const m = new Map<string, { events: Ev[]; busy: Busy[] }>();
    const at = (d: string) => m.get(d) ?? (m.set(d, { events: [], busy: [] }), m.get(d)!);
    for (const e of data?.events ?? []) for (const d of daysOf(e.start, e.end)) at(d).events.push(e);
    for (const b of data?.busy ?? []) for (const d of daysOf(b.start, b.end)) at(d).busy.push(b);
    return m;
  }, [data]);
  return { data, error, byDay };
}

export function CalendarAstryx({ leads, size, open, tab, setTab }: { leads: LeadSummary[]; size: Size; open: (l: LeadSummary) => void; tab: "bookings" | "availability"; setTab: (t: "bookings" | "availability") => void }) {
  const [now] = React.useState(() => Date.now());
  const today = dayOf(now);
  return (
    <Layout
      height="fill"
      defaultHasDividers
      header={
        <LayoutHeader>
          <VStack gap={3}>
            <VStack gap={0}><Eyebrow>{tab === "bookings" ? "CALLS AND SESSIONS · PACIFIC" : "WHAT THE BOOKING PAGE OFFERS"}</Eyebrow><Heading level={1} weight="bold">Calendar</Heading></VStack>
            <TabList value={tab} onChange={(v) => setTab(v as typeof tab)} hasDivider layout="hug">
              <Tab value="bookings" label="Bookings" />
              <Tab value="availability" label="Availability" />
            </TabList>
          </VStack>
        </LayoutHeader>
      }
      content={tab === "bookings" ? <Bookings leads={leads} size={size} open={open} today={today} /> : <Availability size={size} today={today} now={now} />}
    />
  );
}

/* ── Bookings: the week from the picked day ─────────────────────── */

type Item = { at: number; end: number; lead?: LeadSummary; ev?: Ev; busy?: Busy };

function Bookings({ leads, size, open, today }: { leads: LeadSummary[]; size: Size; open: (l: LeadSummary) => void; today: string }) {
  const [pick, setPick] = React.useState(today);
  const to = plus(pick, 6);
  const { error, data, byDay } = useRange(pick, to, 0);
  const week = Array.from({ length: 7 }, (_, i) => plus(pick, i));
  // A booking's own calendar event is the lead's: shown once, as the lead.
  const items = (d: string): Item[] => {
    const mine = leads.filter((l) => l.when && dayOf(Date.parse(l.when)) === d).map((l) => ({ at: Date.parse(l.when!), end: Date.parse(l.when!), lead: l }));
    const taken = new Set(mine.map((i) => Math.round(i.at / 6e4)));
    const on = byDay.get(d);
    const evs = (on?.events ?? []).filter((e) => !taken.has(Math.round(Date.parse(e.start) / 6e4))).map((e) => ({ at: Date.parse(e.start), end: Date.parse(e.end), ev: e }));
    const busy = (on?.busy ?? []).map((b) => ({ at: Date.parse(b.start), end: Date.parse(b.end), busy: b }));
    return ([...mine, ...evs, ...busy] as Item[]).sort((a, b) => Number(!a.ev?.allDay) - Number(!b.ev?.allDay) || a.at - b.at);
  };
  const picker = (
    <VStack gap={3}>
      <Calendar value={iso(pick)} onChange={(d: ISODateString) => setPick(d)} hasVariableRowCount />
      <HStack><Button label="Today" variant="ghost" size="sm" onClick={() => setPick(today)} /></HStack>
      <Text type="supporting" color="secondary">Your leads in the accent; the rest of hello@ and the calendars it reads in grey.</Text>
    </VStack>
  );
  const list = (
    <VStack gap={5}>
      {error ? <Text color="secondary">Could not read the calendar: {error}. Leads only.</Text> : null}
      {!data && !error ? <Eyebrow>LOADING THE CALENDAR</Eyebrow> : null}
      {week.map((d) => {
        const its = items(d);
        return (
          <VStack key={d} gap={1}>
            <Eyebrow>{spoken(d).toUpperCase()}{d === today ? " · TODAY" : ""}</Eyebrow>
            {its.length ? (
              <List hasDividers>
                {its.map((it, i) => it.lead ? (
                  <ListItem key={`l${it.lead.id}`} onClick={() => open(it.lead!)} startContent={<Text type="code" size="sm" color="accent">{time(it.at)}</Text>} label={it.lead.name || it.lead.email} description={`${it.lead.stage === "Call booked" ? "Call" : it.lead.kind ?? "Session"} · ${it.lead.stage}`} />
                ) : it.ev ? (
                  <ListItem key={`e${i}`} startContent={<Text type="code" size="sm" color="secondary">{it.ev.allDay ? "All day" : time(it.at)}</Text>} label={<Text color="secondary">{it.ev.title}</Text>} description={it.ev.block ? "Blocked by you" : it.ev.booking ? "Booked on the site" : "On hello@"} />
                ) : (
                  <ListItem key={`b${i}`} startContent={<Text type="code" size="sm" color="secondary">{time(it.at)}</Text>} label={<Text color="secondary">Busy</Text>} description={`${it.busy!.label} · to ${time(it.end)}`} />
                ))}
              </List>
            ) : <Text type="supporting" color="secondary">Nothing</Text>}
          </VStack>
        );
      })}
    </VStack>
  );
  return size === "wide" ? (
    <Layout height="fill" content={<LayoutContent role="main" label="Bookings">{list}</LayoutContent>} end={<LayoutPanel width={340} hasDivider label="Pick a day">{picker}</LayoutPanel>} />
  ) : <LayoutContent role="main" label="Bookings"><VStack gap={5}>{picker}{list}</VStack></LayoutContent>;
}

/* ── Availability: block days or hours, the calendars it reads ──── */

function Availability({ size, today, now }: { size: Size; today: string; now: number }) {
  const [sel, setSel] = React.useState<DateRange>({ start: iso(today), end: iso(today) });
  const [start, setStart] = React.useState("10:00");
  const [end, setEnd] = React.useState("18:00");
  const [note, setNote] = React.useState("");
  const [tick, setTick] = React.useState(0);
  const [working, setWorking] = React.useState(false);
  const [fail, setFail] = React.useState<string | null>(null);
  // The picked month and the next, so blocks across a month end still list.
  const month = sel.start.slice(0, 7);
  const from = `${month}-01`;
  const to = plus(`${plus(`${month}-01`, 62).slice(0, 7)}-01`, -1);
  const { data, error, byDay } = useRange(from, to, tick);
  const day = sel.start;
  const many = sel.end > sel.start;
  const past = day < today;

  const post = async (body: unknown) => {
    setWorking(true);
    setFail(null);
    try {
      await calendarCall({ method: "POST", body: JSON.stringify(body) });
      setTick((t) => t + 1);
      return true;
    } catch (e) {
      setFail(errorText(e));
      return false;
    } finally {
      setWorking(false);
    }
  };

  const on = byDay.get(day);
  const events = on?.events ?? [];
  const busy = [...events.filter((e) => !e.free).map((e) => ({ start: Date.parse(e.start), end: Date.parse(e.end) })), ...(on?.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))];
  const spans = openSpans(day, busy, now);
  const startOf = (d: string) => zoned(...ymd(d), 0);
  const starts = startsFor(EVENTS.portraits, busy, startOf(day), startOf(plus(day, 1)), now);
  const blocks = (data?.events ?? []).filter((e) => e.block).sort((a, b) => a.start.localeCompare(b.start));
  const status = past ? "Past" : !HOURS[weekday(day)] ? "Closed" : spans.length ? `Open ${spans.map(([a, b]) => range(a, b)).join(", ")}` : "Nothing open";

  const picked = (
    <VStack gap={3}>
      <Eyebrow>{many ? `${spoken(sel.start).toUpperCase()} TO ${spoken(sel.end).toUpperCase()}` : spoken(day).toUpperCase()}</Eyebrow>
      {many ? null : <Text type="code" size="sm" color={status.startsWith("Open") ? "accent" : "secondary"}>{data ? status : "Reading the calendar"}</Text>}
      {!many && (events.length || on?.busy.length) ? (
        <List hasDividers>
          {events.map((e) => (
            <ListItem key={e.id} startContent={<Text type="code" size="sm" color="secondary">{e.allDay ? "All day" : time(Date.parse(e.start))}</Text>} label={e.title}
              description={e.block ? "Blocked from here" : e.booking ? "Booked on the site" : e.free ? "Marked free" : "On hello@"}
              endContent={e.block ? <Button label="Unblock" variant="ghost" size="sm" isDisabled={working} onClick={() => post({ unblock: e.id })} /> : undefined} />
          ))}
          {on?.busy.map((b, i) => <ListItem key={`b${i}`} startContent={<Text type="code" size="sm" color="secondary">{time(Date.parse(b.start))}</Text>} label="Busy" description={`${b.label} · read only, to ${time(Date.parse(b.end))}`} />)}
        </List>
      ) : null}
      {past ? null : (
        <VStack gap={3}>
          <TextInput label="Note" isOptional size="sm" value={note} onChange={(v) => setNote(v.slice(0, 80))} placeholder="Only you see it" />
          <HStack gap={2} wrap="wrap">
            <Button label={many ? "Block the days" : "Block the day"} variant="primary" size="sm" isDisabled={working} onClick={() => post({ block: { from: sel.start, to: sel.end, note: note || undefined } }).then((ok) => ok && setNote(""))} />
          </HStack>
          {many ? null : (
            <HStack gap={2} vAlign="end" wrap="wrap">
              <TimeInput label="From" size="sm" increment={15} value={start as never} onChange={(v) => setStart(v ?? "")} />
              <TimeInput label="To" size="sm" increment={15} value={end as never} onChange={(v) => setEnd(v ?? "")} />
              <Button label="Block these hours" variant="secondary" size="sm" isDisabled={working || !start || !end || end <= start} onClick={() => post({ block: { from: day, start, end, note: note || undefined } }).then((ok) => ok && setNote(""))} />
            </HStack>
          )}
        </VStack>
      )}
      {data && !past && !many && starts.length ? (
        <VStack gap={2}><Eyebrow>PORTRAITS STARTS LEFT</Eyebrow><HStack gap={1} wrap="wrap">{starts.map((s) => <Token key={s} label={time(s)} size="sm" />)}</HStack></VStack>
      ) : null}
      {fail ? <Text color="secondary" role="alert">{fail}</Text> : null}
    </VStack>
  );

  const reads = <Calendars extras={data?.extras} post={post} working={working} />;
  const main = (
    <VStack gap={6}>
      {error ? <Text color="secondary" role="alert">{error}</Text> : null}
      <HStack gap={6} vAlign="start" wrap="wrap">
        <Calendar mode="range" value={sel} onChange={(r: DateRange) => setSel(r)} min={iso(today)} numberOfMonths={size === "wide" ? 2 : 1} />
        <StackItem size="fill">{picked}</StackItem>
      </HStack>
      <VStack gap={1}>
        <Eyebrow>BLOCKED BY YOU · {blocks.length}</Eyebrow>
        {blocks.length ? (
          <List hasDividers>
            {blocks.map((e) => <ListItem key={e.id} label={e.allDay ? daysOf(e.start, e.end).map(spoken).filter((_, i, a) => i === 0 || i === a.length - 1).join(" to ") : `${spoken(dayOf(Date.parse(e.start)))}, ${range(Date.parse(e.start), Date.parse(e.end))}`} description={e.title} endContent={<Button label="Unblock" variant="ghost" size="sm" isDisabled={working} onClick={() => post({ unblock: e.id })} />} />)}
          </List>
        ) : <Text type="supporting" color="secondary">Nothing blocked these two months.</Text>}
      </VStack>
      {size === "wide" ? null : reads}
    </VStack>
  );
  return size === "wide" ? (
    <Layout height="fill" content={<LayoutContent role="main" label="Availability">{main}</LayoutContent>} end={<LayoutPanel width={340} hasDivider label="Calendars it reads">{reads}</LayoutPanel>} />
  ) : <LayoutContent role="main" label="Availability">{main}</LayoutContent>;
}

function Calendars({ extras, post, working }: { extras?: Month["extras"]; post: (b: unknown) => Promise<boolean>; working: boolean }) {
  const [label, setLabel] = React.useState("");
  const [src, setSrc] = React.useState("");
  return (
    <VStack gap={4}>
      <Heading level={2}>Calendars it reads</Heading>
      <List hasDividers>
        <ListItem label="hello@juliangigola.com" description="Google · bookings and blocks go here" />
        {extras?.map((x) => (
          <ListItem key={x.label} label={x.label} description={`${x.ics ? "ICS" : "Google"} · ${x.failed ? "could not read it, skipped" : "read only"}`} endContent={<Button label="Remove" variant="ghost" size="sm" isDisabled={working} onClick={() => post({ drop: x.label })} />} />
        ))}
      </List>
      <form onSubmit={(e) => { e.preventDefault(); post({ extra: { label, src } }).then((ok) => ok && (setLabel(""), setSrc(""))); }}>
        <VStack gap={2}>
          <TextInput label="Name" size="sm" value={label} onChange={(v) => setLabel(v.slice(0, 40))} />
          <TextInput label="Google calendar id or ICS link" size="sm" value={src} onChange={setSrc} />
          <HStack><Button label="Add" variant="secondary" size="sm" type="submit" isDisabled={working || !label.trim() || !src.trim()} /></HStack>
        </VStack>
      </form>
      <Divider />
      <Text type="supporting" color="secondary">A Google calendar needs sharing with hello@ (free/busy is enough). These only take times away; nothing is written to them.</Text>
    </VStack>
  );
}
