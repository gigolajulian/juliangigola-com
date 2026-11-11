"use client";

/* ── Hours, Templates and This device on Astryx ───────────────────
 * The classic LeadHours (components/leads/lead-hours.tsx), TemplatesEditor
 * (templates.tsx) and the device block (setup.tsx: push, import from the
 * Inbox, sign out, plus Export CSV) rebuilt. Same endpoints and bodies:
 * /api/booking/hours GET and PUT, PATCH `{ templates }`, PATCH `{ push }`,
 * POST `{ backfill, dry }` and `{ importStripe, dry }`, GET /api/inbox?csv.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Layout, LayoutContent, LayoutHeader, HStack, VStack, StackItem, Card } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { Switch } from "@astryxdesign/core/Switch";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Divider } from "@astryxdesign/core/Divider";
import { SW_URL, swScope } from "@/components/leads/setup";
import { adminCall, authed, type Call, errorText, ymdPT } from "@/lib/leads/lead-desk";
import type { Template } from "@/lib/leads/lead-crm";
import type { Hours, Window } from "@/lib/booking/booking-rules";
import type { Stage } from "@/lib/leads/leads";

const PUSH_FLAG = "jg-leads-push";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMES = Array.from({ length: 33 }, (_, i) => 360 + i * 30);
const clock = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "AM" : "PM"}`;
const TIME_OPTS = TIMES.map((t) => ({ value: String(t), label: clock(t) }));
const DEFAULT_WINDOW: Window = [600, 1140];
const dateLabel = (d: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${d}T00:00:00Z`));

function Page({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <Layout
      height="fill"
      defaultHasDividers
      header={<LayoutHeader><VStack gap={0}><Text type="code" size="xsm" color="secondary" weight="medium">{eyebrow}</Text><Heading level={1} weight="bold">{title}</Heading></VStack></LayoutHeader>}
      content={<LayoutContent role="main" label={title} padding={4}><VStack gap={6} maxWidth={640}>{children}</VStack></LayoutContent>}
    />
  );
}

function Times({ w, set, label }: { w: Window; set: (w: Window) => void; label: string }) {
  return (
    <HStack gap={2} vAlign="center">
      <Selector label={`${label}, first start`} isLabelHidden size="sm" value={String(w[0])} options={TIME_OPTS} onChange={(v) => set([+v, Math.max(+v, w[1])])} />
      <Text type="code" size="sm" color="secondary">to</Text>
      <Selector label={`${label}, last start`} isLabelHidden size="sm" value={String(w[1])} options={TIME_OPTS} onChange={(v) => set([Math.min(w[0], +v), +v])} />
    </HStack>
  );
}

export function HoursAstryx() {
  const [hours, setHours] = React.useState<Hours | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [pick, setPick] = React.useState("");
  const call = React.useCallback(async (init?: RequestInit) => {
    const lock = "Could not reach the booking lock.";
    const { hours } = await adminCall<{ hours?: Hours }>("/api/booking/hours", init, lock);
    if (!hours) throw new Error(lock);
    return hours;
  }, []);
  React.useEffect(() => { call().then(setHours, (e) => setNote(String(e.message))); }, [call]);

  if (!hours) return <Page eyebrow="WHEN PEOPLE CAN BOOK" title="Hours"><Text type="code" size="sm" color="secondary">{note || "Loading hours"}</Text></Page>;
  const edit = (h: Hours) => { setHours(h); setNote("Not saved"); };
  const days = Object.entries(hours.days ?? {}).filter(([d]) => d >= ymdPT()).sort();
  const save = async () => {
    setBusy(true);
    try { setHours(await call({ method: "PUT", body: JSON.stringify(hours) })); setNote("Saved. The booking page uses it now."); }
    catch (e) { setNote((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Page eyebrow="WHEN PEOPLE CAN BOOK" title="Hours">
      <VStack gap={2}>
        <Heading level={2}>Every week, Pacific</Heading>
        {[3, 4, 5, 6, 0, 1, 2].map((i) => {
          const w = hours.week[i];
          const set = (x: Window | null) => edit({ ...hours, week: hours.week.map((y, j) => (j === i ? x : y)) });
          return (
            <HStack key={i} gap={3} vAlign="center" wrap="wrap">
              <StackItem size="fill"><Switch label={DAYS[i]} value={!!w} onChange={(on) => set(on ? DEFAULT_WINDOW : null)} /></StackItem>
              {w ? <Times w={w} set={set} label={DAYS[i]} /> : <Text type="code" size="sm" color="secondary">Closed</Text>}
            </HStack>
          );
        })}
      </VStack>
      <Divider />
      <VStack gap={2}>
        <Heading level={2}>Single dates</Heading>
        {days.map(([d, w]) => (
          <VStack key={d} gap={1}>
            <HStack gap={2} vAlign="center">
              <StackItem size="fill"><Text>{dateLabel(d)}{w ? "" : " · Closed"}</Text></StackItem>
              <Button label={w ? "Close" : "Open"} variant="ghost" size="sm" onClick={() => edit({ ...hours, days: { ...hours.days, [d]: w ? null : DEFAULT_WINDOW } })} />
              <Button label="Reset" variant="ghost" size="sm" onClick={() => edit({ ...hours, days: Object.fromEntries(days.filter(([x]) => x !== d)) })} />
            </HStack>
            {w ? <Times w={w} set={(x) => edit({ ...hours, days: { ...hours.days, [d]: x } })} label={dateLabel(d)} /> : null}
          </VStack>
        ))}
        <HStack gap={2} vAlign="end">
          <DateInput label="A date to change" size="sm" min={ymdPT() as never} value={(pick || undefined) as never} onChange={(v) => setPick(v ?? "")} />
          <Button label="Change this date" variant="secondary" size="sm" isDisabled={!pick} onClick={() => {
            const w = hours.week[new Date(`${pick}T00:00:00Z`).getUTCDay()];
            edit({ ...hours, days: { ...hours.days, [pick]: w ? null : DEFAULT_WINDOW } });
            setPick("");
          }} />
        </HStack>
        <Text type="supporting" color="secondary">A day you work turns closed; a day off opens 10 AM to 7 PM. Adjust after.</Text>
      </VStack>
      <HStack gap={3} vAlign="center">
        <Button label={busy ? "Saving" : "Save hours"} variant="primary" isDisabled={busy || note !== "Not saved"} onClick={save} />
        <Text type="code" size="sm" color="secondary" role="status">{note}</Text>
      </HStack>
    </Page>
  );
}

export function TemplatesAstryx({ call, templates, saved }: { call: Call; templates: Template[]; saved: (t: Template[]) => void }) {
  const [list, setList] = React.useState(templates);
  const [note, setNote] = React.useState<string | null>(null);
  const edit = (i: number, k: keyof Template) => (v: string) => setList(list.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  const save = () =>
    call<{ templates: Template[] }>({ method: "PATCH", body: JSON.stringify({ templates: list }) })
      .then((o) => { saved(o.templates); setList(o.templates); setNote("Saved."); })
      .catch((e: unknown) => setNote(errorText(e)));
  return (
    <Page eyebrow="SAVED REPLIES" title="Templates">
      <Text color="secondary">{"{first}, {name}, {kind} and {when} fill in for each lead."}</Text>
      {list.map((t, i) => (
        <Card key={t.id + i} padding={4}>
          <VStack gap={3}>
            <TextInput label="Name" value={t.name} onChange={edit(i, "name")} />
            <TextInput label="Subject" value={t.subject} onChange={edit(i, "subject")} />
            <TextArea label="Message" value={t.body} onChange={edit(i, "body")} rows={6} />
            <HStack><Button label="Remove" variant="ghost" size="sm" onClick={() => setList(list.filter((_, j) => j !== i))} /></HStack>
          </VStack>
        </Card>
      ))}
      <HStack gap={2}>
        <Button label="Add a template" variant="secondary" onClick={() => setList([...list, { id: `t${Date.now()}`, name: "New template", subject: "", body: "Hi {first},\n\n\n\nJulian" }])} />
        <Button label="Save templates" variant="primary" onClick={save} />
      </HStack>
      {note ? <Text type="code" size="sm" color="secondary" role="status">{note}</Text> : null}
    </Page>
  );
}

/** Every lead as a CSV file, through the same key as the rest of the desk. */
async function exportCsv(what: "leads" | "activity" = "leads") {
  const res = await fetch(what === "activity" ? "/api/inbox?csv=events" : "/api/inbox?csv", { headers: authed(), cache: "no-store" });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: `${what}-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

type Count = { people: number; added: number; updated: number; stages: Partial<Record<Stage, number>> };
type StripeCount = { payments: number; refunds: number; already: number; noEmail: number; people: number };

export function DeviceAstryx({ call, reload, signOut }: { call: Call; reload: () => void; signOut: () => void }) {
  // The desk renders only in the browser, so these read the page directly.
  const able = typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const [on, setOn] = React.useState<boolean | null>(null);
  const [note, setNote] = React.useState<string | null>(() =>
    able ? null : /iPhone|iPad/.test(navigator.userAgent) ? "Open the installed Leads app to turn these on." : "This browser cannot do notifications.",
  );
  const [count, setCount] = React.useState<Count | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [said, setSaid] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!able) return;
    navigator.serviceWorker.getRegistration(swScope()).then((r) => r?.pushManager.getSubscription()).then((s) => setOn(!!s)).catch(() => setOn(false));
  }, [able]);

  const turnOn = async () => {
    setNote(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setNote("Notifications are blocked for this app in Settings.");
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: swScope() });
      await navigator.serviceWorker.ready;
      const { key } = await call<{ key: string }>({ query: "?vapid" });
      const raw = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
      await call({ method: "PATCH", body: JSON.stringify({ push: sub.toJSON() }) });
      try { localStorage.setItem(PUSH_FLAG, "1"); } catch {}
      setOn(true);
    } catch (e) { setNote(errorText(e)); }
  };
  const turnOff = async () => {
    try {
      const sub = await (await navigator.serviceWorker.getRegistration(swScope()))?.pushManager.getSubscription();
      if (sub) {
        await call({ method: "PATCH", body: JSON.stringify({ push: { endpoint: sub.endpoint }, off: true }) });
        await sub.unsubscribe();
      }
      setOn(false);
    } catch (e) { setNote(errorText(e)); }
  };
  const sendTest = async () => {
    setNote("Sending.");
    try {
      const { devices } = await call<{ devices: number }>({ method: "PATCH", body: JSON.stringify({ test: true }) });
      setNote(devices ? `Arrives in 10 seconds on ${devices} ${devices === 1 ? "device" : "devices"}. Lock the phone now: no banner shows while the app is open.` : "No device is subscribed. Turn notifications off and on again here.");
    } catch (e) { setNote(errorText(e)); }
  };
  /** Counts first (a dry run), imports only on the second press. */
  const backfill = (dry: boolean) => {
    setBusy(true);
    setSaid(null);
    call<Count>({ method: "POST", body: JSON.stringify({ backfill: true, dry }) })
      .then((c) => {
        if (dry) return c.added + c.updated ? setCount(c) : setSaid("Everything in the Inbox is already here.");
        setCount(null);
        setSaid(`Imported: ${c.added} new, ${c.updated} updated.`);
        reload();
      })
      .catch((e: unknown) => setSaid(errorText(e)))
      .finally(() => setBusy(false));
  };
  const [money, setMoney] = React.useState<StripeCount | null>(null);
  const [paidSaid, setPaidSaid] = React.useState<string | null>(null);
  /** Same as the Inbox: counts first, imports on the second press. */
  const fromStripe = (dry: boolean) => {
    setBusy(true);
    setPaidSaid(null);
    call<StripeCount>({ method: "POST", body: JSON.stringify({ importStripe: true, dry }) })
      .then((c) => {
        if (dry) return c.payments + c.refunds ? setMoney(c) : setPaidSaid(`Every Stripe payment is already here (${c.already}).`);
        setMoney(null);
        setPaidSaid(`Imported: ${c.payments} payments, ${c.refunds} refunds.`);
        reload();
      })
      .catch((e: unknown) => setPaidSaid(errorText(e)))
      .finally(() => setBusy(false));
  };
  const by = count ? Object.entries(count.stages).map(([s, n]) => `${s} ${n}`).join(", ") : "";

  return (
    <Page eyebrow="THIS PHONE OR LAPTOP" title="This device">
      <VStack gap={2}>
        <Heading level={2}>Notifications</Heading>
        {on === null ? null : <Switch label="A new lead pings this device" value={on} onChange={(v) => (v ? turnOn() : turnOff())} />}
        {on ? <HStack><Button label="Send a test" variant="ghost" size="sm" onClick={sendTest} /></HStack> : null}
        {note ? <Text type="code" size="sm" color="secondary">{note}</Text> : null}
      </VStack>
      <Divider />
      <VStack gap={2}>
        <Heading level={2}>Import from the Inbox</Heading>
        {count ? (
          <>
            <Text>{count.added} new{by ? ` (${by})` : ""}, {count.updated} updated, from {count.people} {count.people === 1 ? "person" : "people"} in the Inbox.</Text>
            <HStack gap={2}><Button label="Import" variant="primary" size="sm" isDisabled={busy} onClick={() => backfill(false)} /><Button label="Cancel" variant="ghost" size="sm" isDisabled={busy} onClick={() => setCount(null)} /></HStack>
          </>
        ) : <HStack><Button label={busy ? "Counting" : "Count what is new"} variant="secondary" size="sm" isDisabled={busy} onClick={() => backfill(true)} /></HStack>}
        {said ? <Text type="code" size="sm" color="secondary">{said}</Text> : null}
      </VStack>
      <Divider />
      <VStack gap={2}>
        <Heading level={2}>Import past Stripe payments</Heading>
        {money ? (
          <>
            <Text>{money.payments} payments and {money.refunds} refunds to add, for {money.people} {money.people === 1 ? "person" : "people"}. {money.already} already here{money.noEmail ? `, ${money.noEmail} with no address skipped` : ""}.</Text>
            <HStack gap={2}><Button label="Import" variant="primary" size="sm" isDisabled={busy} onClick={() => fromStripe(false)} /><Button label="Cancel" variant="ghost" size="sm" isDisabled={busy} onClick={() => setMoney(null)} /></HStack>
          </>
        ) : <HStack><Button label={busy ? "Counting" : "Count what is new"} variant="secondary" size="sm" isDisabled={busy} onClick={() => fromStripe(true)} /></HStack>}
        {paidSaid ? <Text type="code" size="sm" color="secondary">{paidSaid}</Text> : null}
      </VStack>
      <Divider />
      <HStack gap={2}>
        <Button label="Clients CSV" variant="secondary" size="sm" onClick={() => exportCsv().catch((e: unknown) => alert(errorText(e)))} />
        <Button label="Activity CSV" variant="secondary" size="sm" onClick={() => exportCsv("activity").catch((e: unknown) => alert(errorText(e)))} />
        <Button label="Sign out on this device" variant="ghost" size="sm" onClick={signOut} />
      </HStack>
    </Page>
  );
}
