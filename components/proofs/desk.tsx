"use client";

/* ── the proofs desk on Astryx, opt-in ────────────────────────────
 * Julian (2026-11-09): the same try as the leads desk, for the
 * proofs desk. /admin/proofs since 2026-11-11, so Astryx's CSS never
 * reaches the client's proof page or the classic desk. Same API as the
 * classic desk (/api/proof): list, open one, see the picks, create,
 * send, copy the link, and close a draft. Activity is components/proofs/activity.tsx.
 * ─────────────────────────────────────────────────────────────── */

import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import * as React from "react";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { Layout, LayoutContent, LayoutPanel } from "@astryxdesign/core/Layout";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { List, ListItem } from "@astryxdesign/core/List";
import { Heading, Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Switch } from "@astryxdesign/core/Switch";
import { Card } from "@astryxdesign/core/Card";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { KEY_STORE } from "@/lib/admin/admin-github";
import { SignIn } from "@/components/leads/setup";
import { api, closed, status, type Row } from "@/lib/proof-desk";
import { ActivityDesk } from "@/components/proofs/activity";
import { errorText, stampPT } from "@/lib/leads/lead-desk";
import { TOKEN_STORE } from "@/lib/admin/admin-github";
import { extras, stage, STAGES } from "@/lib/proofs";

const CLASSIC = "/admin";
const frame = (p: Row, id: string) => `/proof/${p.token}/f/${id}`;

function Tile({ k, v }: { k: string; v: string }) {
  return (
    <Card variant="muted" padding={3} width="100%">
      <VStack gap={1}>
        <Text type="supporting">{k}</Text>
        <Text type="large" weight="semibold" hasTabularNumbers>{v}</Text>
      </VStack>
    </Card>
  );
}

/** `embedded`: drawn inside the leads desk (its Theme and nav), with no shell of its own. */
export function ProofsDesk({ embedded = false }: { embedded?: boolean } = {}) {
  const [list, setList] = React.useState<Row[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sel, setSel] = React.useState<string | null>(null);
  const [making, setMaking] = React.useState(false);
  const [wide, setWide] = React.useState(false);
  const load = React.useCallback(() => {
    api<{ proofs: Row[] }>({ query: "?list" }).then((o) => setList(o.proofs)).catch((e: unknown) => setError(errorText(e)));
  }, []);
  React.useEffect(load, [load]);
  // Same as the leads desk: follow html[data-theme], light only when it says light, read before Theme mounts.
  const [mode, setMode] = React.useState<"light" | "dark" | null>(null);
  React.useEffect(() => {
    const read = () => setMode(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    read();
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, { attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, []);
  React.useEffect(() => {
    const mq = matchMedia("(min-width: 1024px)");
    const set = () => setWide(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  if (error === "Not authorized." || error?.startsWith("GitHub did not accept"))
    return (
      <SignIn
        onKey={(k) => {
          if (/^(ghp_|github_pat_)/.test(k)) {
            localStorage.setItem(TOKEN_STORE, k);
            localStorage.removeItem(KEY_STORE);
          } else localStorage.setItem(KEY_STORE, k);
          setError(null);
          load();
        }}
        wrong={!!(localStorage.getItem(KEY_STORE) || localStorage.getItem(TOKEN_STORE))}
      />
    );

  const all = list ?? [];
  const open = all.filter((p) => !closed(p));
  const waiting = open.filter((p) => p.sentAt && !p.submittedAt).length;
  const toPull = all.filter((p) => p.submittedAt && !p.pulledAt).length;
  const cur = all.find((p) => p.token === sel) ?? (wide ? all[0] : undefined);

  const nav = (
    <SideNav header={<SideNavHeading heading="Proofs" subheading="Julian Gigola" />} topContent={<Button label="New gallery" variant="primary" width="100%" onClick={() => { setMaking(true); setSel(null); }} />}>
      <SideNavSection title="Desk" isHeaderHidden>
        <SideNavItem label="Galleries" isSelected endContent={<Text type="supporting" hasTabularNumbers>{open.length}</Text>} />
        <SideNavItem label="Leads" href="/admin/leads" />
      </SideNavSection>
      <SideNavSection title="Setup" isHeaderHidden>
        <SideNavItem label="Pages and work" href={CLASSIC} />
      </SideNavSection>
    </SideNav>
  );

  const galleries = (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text type="supporting">New galleries arrive from Lightroom Publish</Text>
        <Heading level={1}>{list ? (waiting ? `${waiting} waiting on clients` : "Nothing waiting on clients") : "Loading galleries"}</Heading>
      </VStack>
      {error ? <Text color="secondary">{error}</Text> : null}
      <HStack gap={wide ? 3 : 2}>
        <Tile k="Open" v={String(open.length)} />
        <Tile k="Closed" v={String(all.length - open.length)} />
        <Tile k="To pull" v={String(toPull)} />
      </HStack>
      {!wide ? <Button label="New gallery" variant="primary" width="100%" onClick={() => setMaking(true)} /> : null}
      {making ? <NewGallery done={(t) => { setMaking(false); if (t) { setSel(t); load(); } }} /> : null}
      <List hasDividers edge="outset">
        {all.map((p) => (
          <ListItem
            key={p.token}
            isSelected={p.token === cur?.token}
            onClick={() => { setSel(p.token); setMaking(false); }}
            startContent={<Thumbnail src={p.frames[0] ? frame(p, p.frames[0].id) : undefined} alt="" label={p.name} />}
            label={p.name}
            description={[`${p.frames.length} frames`, p.viewers ? ((n) => `${n} ${n === 1 ? "email" : "emails"}`)(Object.keys(p.viewers).length) : null, p.sentAt ? `sent ${stampPT(p.sentAt)}` : null].filter(Boolean).join(" · ")}
            endContent={<Badge label={status(p)} variant={p.submittedAt && !p.pulledAt ? "blue" : "gray"} />}
          />
        ))}
      </List>
      {list && !all.length ? <Text type="supporting">No galleries yet. Publish a collection from Lightroom under Client proofs.</Text> : null}
    </VStack>
  );

  const detail = cur ? <Gallery key={cur.token} p={cur} changed={load} onBack={wide ? undefined : () => setSel(null)} gone={() => { setSel(null); load(); }} /> : null;

  const body = wide ? (
    <Layout
      height="fill"
      start={embedded ? undefined : nav}
      content={<LayoutContent padding={6} label="Galleries">{galleries}</LayoutContent>}
      end={<LayoutPanel width={560} padding={6} hasDivider label="Gallery">{detail ?? <Text type="supporting">Pick a gallery to see it here.</Text>}</LayoutPanel>}
    />
  ) : (
    <VStack gap={4}>{detail ?? galleries}</VStack>
  );
  if (embedded) return wide ? body : <Layout height="fill" content={<LayoutContent padding={4} label="Proofs">{body}</LayoutContent>} />;
  if (!mode) return null;
  return (
    <Theme theme={neutralTheme} mode={mode}>
      {/* The site sets mono capitals everywhere; Astryx sets its own type here, in the site's text face. */}
      {/* The site's global `button, ::placeholder` caps (and h2, h3) reach Astryx buttons, rows and titles: here, not in globals.css, so public CSS stays the same. */}
      <style>{`[data-astryx-desk="proofs"] :is(button,h2,h3),[data-astryx-desk="proofs"] ::placeholder{text-transform:none;letter-spacing:normal}`}</style>
      <div data-astryx-desk="proofs" style={{ height: wide ? "calc(100dvh - 48px)" : undefined, textTransform: "none", letterSpacing: "normal", ["--font-family-body" as string]: 'var(--font-v2-text, "Helvetica Neue", Helvetica, Arial, sans-serif)' }}>
        {body}
      </div>
    </Theme>
  );
}

/** A gallery with no frames yet: Lightroom fills it on Publish. */
function NewGallery({ done }: { done: (token?: string) => void }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [note, setNote] = React.useState<string | null>(null);
  const create = async () => {
    try {
      const o = await api<{ token: string }>({ method: "POST", body: JSON.stringify({ action: "create", name, email }) });
      done(o.token);
    } catch (e) {
      setNote(errorText(e));
    }
  };
  return (
    <Card padding={4} width="100%">
      <VStack gap={3}>
        <Heading level={3}>New gallery</Heading>
        <TextInput label="Name" value={name} onChange={setName} placeholder="Client, shoot" />
        <TextInput label="Client email" type="email" isOptional value={email} onChange={setEmail} placeholder="client@example.com" />
        <HStack gap={2}>
          <Button label="Create" variant="primary" isDisabled={!name.trim()} clickAction={create} />
          <Button label="Cancel" variant="ghost" onClick={() => done()} />
        </HStack>
        {note ? <Text type="supporting" role="status">{note}</Text> : null}
      </VStack>
    </Card>
  );
}

function Gallery({ p, changed, onBack, gone }: { p: Row; changed: () => void; onBack?: () => void; gone: () => void }) {
  const [note, setNote] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState(p.email ?? "");
  const [tab, setTab] = React.useState<"gallery" | "activity" | "selects">("gallery");
  const [set, setSet] = React.useState({ balance: String(p.balance ?? 0), included: String(p.included), price: String(p.price), days: String(p.days) });
  const changedSet = set.balance !== String(p.balance ?? 0) || set.included !== String(p.included) || set.price !== String(p.price) || set.days !== String(p.days);
  const people = Object.keys(p.viewers ?? {}).length;
  const x = extras(p.selects.length, p.included, p.price);
  const thumbs = (p.submittedAt ? p.selects : p.frames.map((f) => f.id)).slice(0, 6);
  const file = (id: string) => p.frames.find((f) => f.id === id)?.file ?? id;
  const at = STAGES.indexOf(stage(p));

  // Same calls and messages as the classic ProofCard.
  const act = async (body: Record<string, unknown>, method = "POST", done?: string) => {
    setNote(null);
    try {
      await api({ method, body: JSON.stringify({ token: p.token, ...body }) });
      if (done) setNote(done);
      setPreview(null);
      changed();
    } catch (e) {
      setNote(errorText(e));
    }
  };
  const showPreview = async () => {
    try {
      setPreview((await api<{ html: string }>({ query: `?preview=${p.token}` })).html);
    } catch (e) {
      setNote(errorText(e));
    }
  };
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote(`${what} copied.`);
    } catch {
      setNote(text);
    }
  };
  // Close: only a draft nobody has been sent, so a client's gallery can never vanish from here. Frames are web previews, never originals.
  const close = async () => {
    if (!confirm(`Close the draft "${p.name}"? Its web previews are removed. Nothing in Lightroom changes.`)) return;
    try {
      await api({ method: "DELETE", query: `?token=${p.token}` });
      gone();
    } catch (e) {
      setNote(errorText(e));
    }
  };

  return (
    <VStack gap={4}>
      {onBack ? <Button label="Galleries" variant="ghost" onClick={onBack} /> : null}
      <VStack gap={2}>
        <HStack gap={2} vAlign="center">
          <Heading level={2}>{p.name}</Heading>
          <Badge label={status(p)} variant={p.submittedAt ? "blue" : "gray"} />
        </HStack>
        <ProgressBar label={`Stage ${at + 1} of ${STAGES.length}: ${STAGES[at]}`} isLabelHidden value={at + 1} max={STAGES.length} />
        <Text type="supporting">
          {p.frames.length} frames · {p.included} included · ${p.price} each extra
          {p.sentAt ? ` · sent ${stampPT(p.sentAt)}` : ` · open ${p.days} days once sent`}
          {p.closesAt ? ` · closes ${stampPT(p.closesAt)}` : ""}
        </Text>
      </VStack>
      {thumbs.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
          {thumbs.map((id) => (
            // eslint-disable-next-line @next/next/no-img-element -- private proof frames from the Worker
            <img key={id} src={frame(p, id)} alt="" style={{ aspectRatio: "3 / 4", width: "100%", objectFit: "cover", borderRadius: 4 }} />
          ))}
        </div>
      ) : null}

      <TabList value={tab} onChange={(v) => setTab(v as typeof tab)} hasDivider layout="hug">
        <Tab value="gallery" label="Gallery" />
        <Tab value="activity" label={`Activity · ${people}`} />
        <Tab value="selects" label={`Selects · ${p.selects.length}`} />
      </TabList>

      {tab === "gallery" ? (
        <VStack gap={3}>
          <MetadataList>
            <MetadataListItem label="Draft">{p.createdAt ? stampPT(p.createdAt) : "waiting"}</MetadataListItem>
            <MetadataListItem label="Sent">{p.sentAt ? `${stampPT(p.sentAt)} to ${p.email}` : "Not sent"}</MetadataListItem>
            <MetadataListItem label="Opened">{p.firstViewAt ? `${stampPT(p.firstViewAt)} · ${p.views} ${p.views === 1 ? "view" : "views"}` : "Not opened"}</MetadataListItem>
            <MetadataListItem label="Selects in">{p.submittedAt ? `${stampPT(p.submittedAt)} · ${p.selects.length}${x.n ? `, ${x.n} extra` : ""}` : `${p.selects.length} selected so far`}</MetadataListItem>
            {x.n || p.paid || p.balance ? <MetadataListItem label="Paid">{p.paid ? `$${(p.paid.amount / 100).toFixed(2)} · Stripe${p.paid.pending ? " · bank, clearing" : ""}${p.paid.failed ? " · bank payment failed, follow up" : ""}` : "Not paid"}</MetadataListItem> : null}
            <MetadataListItem label="In Lightroom">{p.pulledAt ? stampPT(p.pulledAt) : "waiting"}</MetadataListItem>
          </MetadataList>
          <HStack gap={2} vAlign="end">
            <TextInput label="Client email" type="email" value={email} onChange={setEmail} placeholder="client@example.com" />
            {email !== (p.email ?? "") ? <Button label="Save" clickAction={() => act({ email }, "PATCH", "Saved.")} /> : null}
          </HStack>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
            {([["balance", "Shoot balance, $"], ["included", "Included frames"], ["price", "Each extra, $"], ["days", p.sentAt ? "Days open (set at send)" : "Days open once sent"]] as const).map(([k, label]) => (
              <TextInput key={k} label={label} value={set[k]} isDisabled={k === "days" && !!p.sentAt} onChange={(v) => setSet((o) => ({ ...o, [k]: v }))} />
            ))}
          </div>
          {changedSet ? <Button label="Save" clickAction={() => act({ balance: set.balance, included: set.included, price: set.price, days: set.days }, "PATCH", "Saved.")} /> : null}
          <Switch label="Watermark" description="Julian Gigola in the bottom third of every frame" value={!!p.watermark} onChange={(on) => act({ watermark: on }, "PATCH", on ? "Watermark on." : "Watermark off.")} />
        </VStack>
      ) : null}

      {tab === "activity" ? <ActivityDesk p={p} /> : null}

      {tab === "selects" ? (
        p.selects.length ? (
          <VStack gap={2}>
            <Text>
              {p.selects.length} selected{x.n ? `, ${x.n} extra` : ""}{p.paid ? `, $${(p.paid.amount / 100).toFixed(2)} paid` : ""}{p.submittedAt ? `. Sent ${stampPT(p.submittedAt)}${p.submittedBy ? ` by ${p.submittedBy}` : ""}.` : ". Not sent yet: the latest address's picks."}
            </Text>
            <List hasDividers>
              {p.selects.map((id) => <ListItem key={id} startContent={<Thumbnail src={frame(p, id)} alt="" label={file(id)} />} label={file(id)} description={p.notes[id]} />)}
            </List>
            {p.message ? <Text color="secondary">&ldquo;{p.message}&rdquo;</Text> : null}
          </VStack>
        ) : <Text type="supporting">No selects yet.</Text>
      ) : null}

      <Card variant="muted" padding={3} width="100%">
        <HStack gap={2} vAlign="center">
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Text type="supporting">{p.url.replace(/^https?:\/\//, "")}</Text></div>
          <Button label="Copy link" size="sm" variant="ghost" onClick={() => copy(p.url, "Link")} />
        </HStack>
      </Card>

      {preview ? (
        <VStack gap={2}>
          <Text type="supporting">To {p.email} · Your proofs are ready</Text>
          <iframe title="Email preview" srcDoc={preview} sandbox="" style={{ height: 560, width: "100%", border: 0, borderRadius: 8, background: "#fff" }} />
        </VStack>
      ) : null}

      <HStack gap={2} wrap="wrap">
        {!p.sentAt && !preview ? <Button label="Preview email" variant="primary" isDisabled={!p.email || !p.frames.length} clickAction={showPreview} /> : null}
        {!p.sentAt && preview ? <Button label={`Send to ${p.email}`} variant="primary" clickAction={() => act({ action: "send" }, "POST", "Sent.")} /> : null}
        {p.sentAt && !p.submittedAt ? <Button label="Extend 7 days" clickAction={() => act({ action: "extend", days: 7 }, "POST", "Seven more days.")} /> : null}
        {p.submittedAt ? <Button label="Copy file names" onClick={() => copy(p.selects.map(file).join("\n"), "File names")} /> : null}
        {p.submittedAt ? <Button label="Reopen for changes" clickAction={() => act({ action: "reopen" }, "POST", "Reopened. They can change their selects.")} /> : null}
        <Button label="Open gallery" href={p.url} target="_blank" rel="noreferrer" />
        {!p.sentAt ? <Button label="Close draft" variant="destructive" clickAction={close} /> : null}
      </HStack>
      {note ? <Text type="supporting" role="status">{note}</Text> : null}
    </VStack>
  );
}
