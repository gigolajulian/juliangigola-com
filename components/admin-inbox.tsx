"use client";

import * as React from "react";
import { replyLink, type Enquiry, type Summary } from "@/lib/inbox";
import { cn } from "@/lib/utils";

/* ── the inbox ────────────────────────────────────────────────────
 * Enquiries from the contact form, which now has somewhere to put them.
 *
 * Reads `/api/inbox`, which is the one part of this page authorised by a key
 * of its own rather than by the GitHub token: the data is on this site, so
 * GitHub cannot have an opinion about who may read it. The key is pasted once
 * and kept in this browser, exactly like the token.
 *
 * Read, reply, delete. Replying opens his own mail with the message quoted,
 * because an answer should come from his address with his signature on it —
 * this is where enquiries arrive, not a mail client. Deleting is immediate
 * and has no bin: a project is work that took a day to make, an enquiry is a
 * message that has been answered, and keeping somebody's name and email after
 * that is the wrong default.
 * ─────────────────────────────────────────────────────────────── */

/** Where the key is kept between visits. Beside the GitHub token. */
const KEY_STORE = "jg-inbox-key";

type Row = Summary & { key: string };

const when = (at: string) => {
  const d = new Date(at);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function AdminInbox() {
  const [key, setKey] = React.useState("");
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [body, setBody] = React.useState<Record<string, Enquiry>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  /** Every call to the route, with the key attached. */
  const call = React.useCallback(
    async (
      init: RequestInit & { query?: string } = {},
      withKey?: string,
    ): Promise<unknown> => {
      const k = withKey ?? key;
      const res = await fetch(`/api/inbox${init.query ?? ""}`, {
        ...init,
        headers: { "x-inbox-key": k, "content-type": "application/json" },
        cache: "no-store",
      });
      const parsed = (await res.json()) as { error?: string };
      if (!res.ok)
        throw new Error(parsed.error ?? `Request failed (${res.status})`);
      return parsed;
    },
    [key],
  );

  const list = React.useCallback(
    async (withKey?: string) => {
      setBusy(true);
      setError(null);
      try {
        const out = (await call({}, withKey)) as { rows: Row[] };
        setRows(out.rows);
        if (withKey) {
          setKey(withKey);
          window.localStorage.setItem(KEY_STORE, withKey);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        // A rejected key is not worth keeping — otherwise every visit retries
        // it and the tab looks broken rather than locked.
        if (String(e).includes("Not authorised")) {
          window.localStorage.removeItem(KEY_STORE);
          setRows(null);
        }
      } finally {
        setBusy(false);
      }
    },
    [call],
  );

  /* Opens itself if the key is already in this browser.
   *
   * Reading one value out of `localStorage` on mount and then fetching with
   * it is what an effect is for — the alternative, seeding state from
   * `localStorage` during render, is a hydration mismatch, because the server
   * has no browser to read. The same exemption `admin-editor.tsx` takes for
   * the GitHub token, for the same reason. */
  React.useEffect(() => {
    const saved = window.localStorage.getItem(KEY_STORE);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) void list(saved);
  }, [list]);

  async function reveal(row: Row) {
    if (open === row.key) {
      setOpen(null);
      return;
    }
    setOpen(row.key);
    if (body[row.key]) return;
    try {
      const out = (await call({
        query: `?key=${encodeURIComponent(row.key)}`,
      })) as { enquiry: Enquiry };
      setBody((b) => ({ ...b, [row.key]: out.enquiry }));
      if (!row.read) void mark(row, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function mark(row: Row, read: boolean) {
    // Optimistic: the row is the only thing that changes and a failed write
    // is reported, so there is nothing to be wrong about for long.
    setRows((r) =>
      r ? r.map((x) => (x.key === row.key ? { ...x, read } : x)) : r,
    );
    try {
      await call({
        method: "PATCH",
        body: JSON.stringify({ key: row.key, read }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      void list();
    }
  }

  async function remove(row: Row) {
    if (
      !window.confirm(
        `Delete the enquiry from ${row.name}? This cannot be undone.`,
      )
    )
      return;
    try {
      await call({ method: "DELETE", body: JSON.stringify({ key: row.key }) });
      setRows((r) => (r ? r.filter((x) => x.key !== row.key) : r));
      if (open === row.key) setOpen(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const unread = rows?.filter((r) => !r.read).length ?? 0;

  return (
    <div className="mt-10 flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="font-display text-xl uppercase tracking-[0]">
          Enquiries
          {rows ? (
            <span className="label ml-3 text-muted-foreground">
              {rows.length} total
              {unread ? ` · ${unread} unread` : ""}
            </span>
          ) : null}
        </h2>
        {rows ? (
          <button
            type="button"
            onClick={() => void list()}
            disabled={busy}
            className="label border border-border px-4 py-2 press hoverable:hover:bg-card disabled:opacity-50"
          >
            {busy ? "Reading…" : "Refresh"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="label border border-border bg-card px-4 py-3 text-foreground">
          {error}
        </p>
      ) : null}

      {rows === null ? (
        <Unlock onUnlock={(k) => void list(k)} busy={busy} />
      ) : rows.length === 0 ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          Nothing yet. The contact form writes here the moment somebody sends
          something — they do not need a mail app, and you do not need to be
          told twice.
        </p>
      ) : (
        <ul className="border-t border-border">
          {rows.map((row) => {
            const full = body[row.key];
            return (
              <li key={row.key} className="border-b border-border">
                <button
                  type="button"
                  onClick={() => void reveal(row)}
                  aria-expanded={open === row.key}
                  className={cn(
                    "flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors duration-200 hoverable:hover:bg-card",
                    open === row.key && "bg-card",
                  )}
                >
                  {/* Unread is a dot, not bold type: the row is already set in
                      one weight and a second one is a second thing to learn. */}
                  <span
                    aria-hidden
                    className={cn(
                      "block size-1.5 shrink-0 rounded-full",
                      row.read ? "bg-transparent" : "bg-live",
                    )}
                  />
                  <span
                    className={cn(
                      "font-display text-base uppercase tracking-[0]",
                      row.read ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {row.name}
                  </span>
                  <span className="label text-muted-foreground">
                    {row.type}
                  </span>
                  <span className="label ml-auto shrink-0 text-muted-foreground">
                    {when(row.at)}
                    {row.country ? ` · ${row.country}` : ""}
                  </span>
                  <span className="sr-only">
                    {row.read ? "Read" : "Unread"}
                  </span>
                </button>

                {open === row.key ? (
                  <div className="flex flex-col gap-4 border-t border-border bg-card/40 px-4 py-4">
                    {full ? (
                      <>
                        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[8rem_1fr]">
                          <dt className="label text-muted-foreground">From</dt>
                          <dd className="text-sm">
                            {full.name} &middot;{" "}
                            <a
                              href={`mailto:${full.email}`}
                              className="underline decoration-border underline-offset-4 hoverable:hover:decoration-foreground"
                            >
                              {full.email}
                            </a>
                          </dd>
                          <dt className="label text-muted-foreground">Kind</dt>
                          <dd className="text-sm">{full.type}</dd>
                          {full.detail ? (
                            <>
                              <dt className="label text-muted-foreground">
                                When / where
                              </dt>
                              <dd className="text-sm">{full.detail}</dd>
                            </>
                          ) : null}
                          <dt className="label text-muted-foreground">
                            Arrived
                          </dt>
                          <dd className="text-sm">
                            {new Date(full.at).toLocaleString()}
                          </dd>
                        </dl>

                        {/* Their words, as typed. `whitespace-pre-wrap` because
                            paragraphs somebody wrote are paragraphs. */}
                        <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed">
                          {full.message}
                        </p>

                        <div className="flex flex-wrap items-center gap-3">
                          <a
                            href={replyLink(full)}
                            className="label border border-foreground bg-foreground px-5 py-2.5 text-background press hoverable:hover:opacity-90"
                          >
                            Reply
                          </a>
                          <button
                            type="button"
                            onClick={() => void mark(row, !row.read)}
                            className="label border border-border px-5 py-2.5 press hoverable:hover:bg-card"
                          >
                            Mark {row.read ? "unread" : "read"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(row)}
                            className="label ml-auto text-muted-foreground press hoverable:hover:text-foreground"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="label text-muted-foreground">Reading…</p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The key, asked for once.
 *
 * Not a gate on the tab — the explanation is visible without it, so arriving
 * here without the key tells you what this is and what to do, rather than
 * looking broken.
 */
function Unlock({
  onUnlock,
  busy,
}: {
  onUnlock: (key: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onUnlock(value.trim());
      }}
      className="flex max-w-prose flex-col gap-3 border border-border bg-card p-5"
    >
      <p className="text-sm text-muted-foreground">
        Enquiries are kept on this site rather than emailed, so they need a key
        of their own — the GitHub token opens the repository, not this. Set one
        once with{" "}
        <code className="text-foreground">wrangler secret put INBOX_KEY</code>,
        then paste it here. It stays in this browser.
      </p>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="INBOX_KEY"
        autoComplete="off"
        className="border border-border bg-background px-4 py-2.5 font-mono text-sm"
      />
      <button
        type="submit"
        disabled={busy || !value.trim()}
        className="label self-start border border-foreground bg-foreground px-5 py-2.5 text-background press hoverable:hover:opacity-90 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-50"
      >
        {busy ? "Opening…" : "Open the inbox"}
      </button>
    </form>
  );
}
