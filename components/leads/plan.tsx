"use client";

/* ── the shoot plan and tasks on a lead ───────────────────────────
 * From CRMO (Julian's mock, claude.ai/artifact/UYkrekcCJeo6yrwUo41Mts):
 * the shoot itself beside the client and the date. Plan: brief, up to four
 * of his frames, the Cosmos board as a link (never fetched), the shot list
 * and the call sheet. Tasks: the prep under the one next step, each with a
 * day and who does it; ticking one writes a line to the timeline (server).
 * Both save whole through the lead's PATCH, as People does.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { HStack, VStack, StackItem } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Selector } from "@astryxdesign/core/Selector";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Badge } from "@astryxdesign/core/Badge";
import { Divider } from "@astryxdesign/core/Divider";
import { Kbd } from "@astryxdesign/core/Kbd";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import type { Person, ShootPlan, Task } from "@/lib/leads/leads";
import { now, ymdPT } from "@/lib/leads/lead-desk";
import { errorText } from "@/lib/utils";

const XGlyph = (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true" {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
/** "2026-12-02" as "Dec 2". */
export const dayShort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const nameOf = (people: Person[], who?: string) => (who ? people.find((p) => p.email === who)?.name.split(" ")[0] ?? who : "You");

/** A save that reports its own error, as People does. */
function useSave<T>(onSave: (v: T) => Promise<unknown>) {
  const [error, setError] = React.useState<string | null>(null);
  // One save at a time: each builds on the list as the server last returned it, so a second tick must wait.
  const [pending, setPending] = React.useState(false);
  const save = (v: T, then?: () => void) => {
    setPending(true);
    return onSave(v).then(() => { setError(null); then?.(); }, (e: unknown) => setError(errorText(e))).finally(() => setPending(false));
  };
  return { error, save, pending };
}

export function PlanSection({ plan, people, isDisabled, phone, onSave }: { plan?: ShootPlan; people: Person[]; isDisabled?: boolean; phone?: boolean; onSave: (p: ShootPlan | null) => Promise<unknown> }) {
  const [editing, setEditing] = React.useState(false);
  const { error, save, pending } = useSave(onSave);
  const p = plan ?? {};
  const sh = p.sheet ?? {};
  const team = people.filter((x) => sh.team?.includes(x.email));
  const sheetRows: [string, string | undefined][] = [["Call", sh.call], ["Shoot", sh.window], ["Where", sh.place], ["Team", team.map((x) => `${x.role ? `${x.role} ` : ""}${x.name}`).join(" · ") || undefined], ["Bring", sh.bring]];
  const hasSheet = sheetRows.some(([, v]) => v);
  return (
    <VStack gap={4}>
      <HStack gap={2} vAlign="center">
        <StackItem size="fill"><Heading level={2}>Shoot plan</Heading></StackItem>
        {editing ? null : <Button label={plan ? "Edit" : "Make a plan"} variant="ghost" size="sm" isDisabled={isDisabled} onClick={() => setEditing(true)} />}
      </HStack>
      {editing ? (
        <PlanForm plan={p} people={people} error={error} onSave={(v) => save(v, () => setEditing(false))} onClear={plan ? () => save(null, () => setEditing(false)) : undefined} onCancel={() => setEditing(false)} />
      ) : !plan ? (
        <Text type="supporting" color="secondary">The brief, a few of your frames, the Cosmos board, the shot list and the call sheet for the day.</Text>
      ) : (
        <>
          {p.brief ? <Text type="large">{p.brief}</Text> : null}
          {p.refs?.length ? (
            <Grid columns={4} gap={2} style={{ maxWidth: 560 }}>
              {p.refs.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "4 / 5", objectFit: "cover", display: "block", borderRadius: 4, background: "var(--color-background-muted)" }} />
              ))}
            </Grid>
          ) : null}
          {p.cosmos ? (
            <HStack gap={3} vAlign="center">
              <StackItem size="fill">
                <VStack gap={0}>
                  <Text type="label">Cosmos board</Text>
                  <Text type="code" size="sm" color="secondary" maxLines={1}>{p.cosmos.replace(/^https:\/\/(www\.)?/, "")}</Text>
                </VStack>
              </StackItem>
              <Button label="Open" variant="secondary" size="sm" href={p.cosmos} target="_blank" rel="noreferrer" />
            </HStack>
          ) : null}
          {p.shots?.length || hasSheet ? (
            <Grid columns={phone || !p.shots?.length || !hasSheet ? 1 : 2} gap={5}>
              {p.shots?.length ? (
                <VStack gap={2}>
                  <Text type="label" color="secondary">Shot list</Text>
                  {p.shots.map((s, i) => (
                    <HStack key={i} gap={2} vAlign="center">
                      <CheckboxInput label={s.text} isLabelHidden value={!!s.done} isDisabled={isDisabled || pending}
                        onChange={(on) => save({ ...p, shots: p.shots!.map((x, j) => (j === i ? { text: x.text, ...(on ? { done: true } : {}) } : x)) })} />
                      <Text color={s.done ? "secondary" : "primary"}>{s.done ? <s>{s.text}</s> : s.text}</Text>
                    </HStack>
                  ))}
                </VStack>
              ) : null}
              {hasSheet ? (
                <VStack gap={2}>
                  <Text type="label" color="secondary">Call sheet</Text>
                  <MetadataList>{sheetRows.filter(([, v]) => v).map(([k, v]) => <MetadataListItem key={k} label={k}>{v}</MetadataListItem>)}</MetadataList>
                </VStack>
              ) : null}
            </Grid>
          ) : null}
          {error ? <Text type="code" size="sm" color="secondary" role="alert">{error}</Text> : null}
        </>
      )}
    </VStack>
  );
}

function PlanForm({ plan, people, error, onSave, onClear, onCancel }: { plan: ShootPlan; people: Person[]; error: string | null; onSave: (p: ShootPlan) => void; onClear?: () => void; onCancel: () => void }) {
  const sh = plan.sheet ?? {};
  const [d, setD] = React.useState({
    brief: plan.brief ?? "",
    refs: (plan.refs ?? []).join("\n"),
    cosmos: plan.cosmos ?? "",
    shots: (plan.shots ?? []).map((s) => s.text).join("\n"),
    call: sh.call ?? "",
    window: sh.window ?? "",
    place: sh.place ?? "",
    bring: sh.bring ?? "",
  });
  const [team, setTeam] = React.useState<string[]>(sh.team ?? []);
  const set = (k: keyof typeof d) => (v: string) => setD({ ...d, [k]: v });
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const submit = () => onSave({
    brief: d.brief,
    refs: lines(d.refs),
    cosmos: d.cosmos,
    // A shot already ticked stays ticked when its words did not change.
    shots: lines(d.shots).map((text) => ({ text, ...(plan.shots?.find((s) => s.text === text)?.done ? { done: true } : {}) })),
    sheet: { call: d.call, window: d.window, place: d.place, bring: d.bring, team },
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onCancel(); } }}>
      <VStack gap={3}>
        <TextArea label="Brief" value={d.brief} onChange={set("brief")} rows={3} placeholder="One hard light, grey seamless, red gel on the face for the cover." />
        <TextArea label="Your frames" description="Up to four, one link a line, from juliangigola.com/work/." value={d.refs} onChange={set("refs")} rows={4} placeholder="/work/sian/02.jpg" />
        <TextInput label="Cosmos board" description="Kept as a link." size="sm" value={d.cosmos} onChange={set("cosmos")} placeholder="cosmos.so/juliangigola/board" autoComplete="off" />
        <TextArea label="Shot list" description="One shot a line." value={d.shots} onChange={set("shots")} rows={4} placeholder="Cover: red gel, close, chin up" />
        <Divider />
        <Text type="label" color="secondary">Call sheet</Text>
        <HStack gap={2} wrap="wrap">
          <TextInput label="Call" size="sm" value={d.call} onChange={set("call")} placeholder="9:15" width={120} autoComplete="off" />
          <StackItem size="fill"><TextInput label="Shoot" size="sm" value={d.window} onChange={set("window")} placeholder="10:00 to 1:00" autoComplete="off" /></StackItem>
        </HStack>
        <TextInput label="Where" size="sm" value={d.place} onChange={set("place")} placeholder="Studio, San Jose" autoComplete="off" />
        <TextInput label="Bring" size="sm" value={d.bring} onChange={set("bring")} placeholder="2 leather looks, rings" autoComplete="off" />
        {people.length ? (
          <VStack gap={1}>
            <Text type="label" color="secondary">Team</Text>
            {people.map((x) => (
              <CheckboxInput key={x.email} label={`${x.name}${x.role ? `, ${x.role}` : ""}`} size="sm" value={team.includes(x.email)}
                onChange={(on) => setTeam(on ? [...team, x.email] : team.filter((e) => e !== x.email))} />
            ))}
          </VStack>
        ) : <Text type="supporting" color="secondary">Add people to the lead to put them on the call sheet.</Text>}
        {error ? <Text type="code" size="sm" color="secondary" role="alert">{error}</Text> : null}
        <HStack gap={2}>
          <Button label="Save plan" variant="primary" size="sm" type="submit" />
          <Button label="Cancel" variant="ghost" size="sm" onClick={onCancel} />
          <StackItem size="fill" />
          {onClear ? <Button label="Clear plan" variant="ghost" size="sm" onClick={onClear} /> : null}
        </HStack>
      </VStack>
    </form>
  );
}

export function TaskSection({ tasks, people, isDisabled, adding, setAdding, keys, onSave }: { tasks: Task[]; people: Person[]; isDisabled?: boolean; adding: boolean; setAdding: (on: boolean) => void; keys?: boolean; onSave: (t: Task[]) => Promise<unknown> }) {
  const { error, save, pending } = useSave(onSave);
  const today = ymdPT(now());
  const done = tasks.filter((t) => t.doneAt).length;
  // Open first, by day; done ones sink to the end.
  const shown = [...tasks].sort((a, b) => (+!!a.doneAt - +!!b.doneAt) || (a.due ?? "9").localeCompare(b.due ?? "9"));
  return (
    <VStack gap={3}>
      <HStack gap={2} vAlign="center">
        <StackItem size="fill"><Heading level={2}>Tasks</Heading></StackItem>
        {tasks.length ? <Text type="code" size="sm" color="secondary">{done} of {tasks.length} done</Text> : null}
      </HStack>
      {!tasks.length && !adding ? <Text type="supporting" color="secondary">Prep for the shoot, each with a day and who does it. Due ones show on Today.</Text> : null}
      {shown.length ? (
        <VStack gap={0}>
          {shown.map((t, i) => {
            const late = !t.doneAt && !!t.due && t.due < today;
            return (
              <React.Fragment key={t.id}>
                {i ? <Divider /> : null}
                <HStack gap={3} vAlign="center" padding={2} style={{ paddingInline: 0, minHeight: 44 }}>
                  <CheckboxInput label={t.text} isLabelHidden value={!!t.doneAt} isDisabled={isDisabled || pending}
                    onChange={(on) => save(tasks.map((x) => (x.id === t.id ? { ...x, doneAt: on ? new Date().toISOString() : undefined } : x)))} />
                  <StackItem size="fill"><Text color={t.doneAt ? "secondary" : "primary"}>{t.doneAt ? <s>{t.text}</s> : t.text}</Text></StackItem>
                  {/* who and when keep their width; the task's words wrap instead */}
                  <HStack gap={2} vAlign="center" style={{ flexShrink: 0 }}>
                    <Badge label={nameOf(people, t.who)} variant="neutral" />
                    {t.due ? (late ? <Badge label={`${dayShort(t.due)}, late`} variant="warning" /> : <Text type="code" size="sm" color="secondary" textWrap="nowrap">{dayShort(t.due)}</Text>) : null}
                  </HStack>
                  <IconButton label={`Remove ${t.text}`} variant="ghost" size="sm" isDisabled={isDisabled || pending} icon={<Icon icon={XGlyph} />} onClick={() => save(tasks.filter((x) => x.id !== t.id))} />
                </HStack>
              </React.Fragment>
            );
          })}
        </VStack>
      ) : null}
      {adding ? (
        <TaskForm people={people} onAdd={(t) => save([...tasks, t], () => setAdding(false))} onCancel={() => setAdding(false)} />
      ) : (
        <HStack gap={2} vAlign="center">
          <Button label="Add a task" variant="secondary" size="sm" isDisabled={isDisabled} onClick={() => setAdding(true)} />
          {keys ? <Kbd keys="t" /> : null}
        </HStack>
      )}
      {error ? <Text type="code" size="sm" color="secondary" role="alert">{error}</Text> : null}
    </VStack>
  );
}

const ME = "you";

function TaskForm({ people, onAdd, onCancel }: { people: Person[]; onAdd: (t: Task) => void; onCancel: () => void }) {
  const [text, setText] = React.useState("");
  const [due, setDue] = React.useState("");
  const [who, setWho] = React.useState(ME);
  // Opened from the Cmd K palette, the palette hands focus back to the page as it closes: take it after that, and bring the form into view.
  const form = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    const t = setTimeout(() => { form.current?.scrollIntoView({ block: "nearest" }); form.current?.querySelector("input")?.focus(); }, 80);
    return () => clearTimeout(t);
  }, []);
  return (
    <form ref={form} onSubmit={(e) => { e.preventDefault(); if (text.trim()) onAdd({ id: Math.random().toString(36).slice(2, 10), text: text.trim(), ...(due ? { due } : {}), ...(who !== ME ? { who } : {}) }); }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onCancel(); } }}>
      <HStack gap={2} vAlign="end" wrap="wrap">
        <StackItem size="fill"><TextInput label="Task" size="sm" value={text} onChange={(v) => setText(v.slice(0, 80))} placeholder="Rent red gel and snoot" autoComplete="off" hasAutoFocus /></StackItem>
        <DateInput label="Due" size="sm" value={(due || undefined) as never} onChange={(v) => setDue(v ?? "")} />
        {people.length ? <Selector label="Who" size="sm" value={who} onChange={(v) => setWho(v ?? ME)} options={[{ value: ME, label: "You" }, ...people.map((p) => ({ value: p.email, label: p.name }))]} /> : null}
        <Button label="Add" variant="primary" size="sm" type="submit" isDisabled={!text.trim()} />
        <Button label="Cancel" variant="ghost" size="sm" onClick={onCancel} />
      </HStack>
    </form>
  );
}
