"use client";

import * as React from "react";
import type { Credit } from "@/lib/work-types";
import { instagramHandle } from "@/lib/added";
import { processImage } from "@/lib/admin-image";
import { cn } from "@/lib/utils";

/* ── credits ──────────────────────────────────────────────────────
 * Role and name, as many rows as the job had.
 *
 * One component for both the project being added and the seventy already on
 * the site, because it is the same list and the same gesture — the only
 * difference is where the result is stored, and that is the caller's problem.
 *
 * Blank rows are kept while typing and dropped on save. Somebody adding four
 * credits presses Add four times before filling any of them in, and a form
 * that deletes the empty row underneath them is a form that fights back.
 * ─────────────────────────────────────────────────────────────── */

const field =
  "w-full border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-foreground";

/** What the roles actually are on Julian's jobs, in the order they recur. */
const ROLES = [
  "Client",
  "Model",
  "Artist",
  "Styling",
  "Hair",
  "Make-up",
  "Set design",
  "Production",
  "Assistant",
  "Retouching",
  "Direction",
];

/* ── the credit book, and the faces ───────────────────────────────
 * Two things the rows want that only the editor knows: everyone who has
 * ever been credited, so a name typed once fills itself in the next time,
 * and the profile photographs, which are saved by handle and shared by
 * every shoot that names the same person.
 *
 * A context and not four more props: this component is rendered from three
 * places, none of which has any of it, and threading it through them would
 * be a prop on every panel in between for the sake of one input.
 * ─────────────────────────────────────────────────────────────── */

/** Everyone credited before, by name: what they were called and what they did. */
type CreditBook = Record<string, { instagram: string; role: string }>;

type CreditDeskValue = {
  people: CreditBook;
  /** Handle to a path under `public/`, or a staged data URL. */
  faces: Record<string, string>;
  /** A picture for a handle: base64 JPEG bytes, or null to forget it. */
  onFace: (
    handle: string,
    picture: { base64: string; preview: string; bytes: number } | null,
  ) => void;
};

const Desk = React.createContext<CreditDeskValue | null>(null);
export const CreditDesk = Desk.Provider;

/** Everyone in the archive, newest spelling wins. */
export const creditBook = (lists: Credit[][]): CreditBook => {
  const book: CreditBook = {};
  for (const list of lists) {
    for (const c of list) {
      const name = c.name.trim();
      if (!name || name.startsWith("@")) continue;
      const had = book[name];
      book[name] = {
        instagram: c.instagram || had?.instagram || "",
        role: c.role || had?.role || "",
      };
    }
  }
  return book;
};

export function AdminCredits({
  credits,
  onChange,
  /** Shown above the rows. Absent inside a panel that already has a heading. */
  title = "Credits",
  className,
}: {
  credits: Credit[];
  onChange: (c: Credit[]) => void;
  title?: string | null;
  className?: string;
}) {
  const desk = React.useContext(Desk);

  const set = (i: number, patch: Partial<Credit>) =>
    onChange(credits.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  /* A name that has been credited before brings its handle and its role
     with it. Only into empty boxes: filling in what somebody has already
     typed is the kind of help that deletes work. */
  const remember = (i: number, name: string) => {
    const known = desk?.people[name.trim()];
    const row = credits[i];
    if (!known || !row) return set(i, { name });
    set(i, {
      name,
      instagram: row.instagram || known.instagram || null,
      role: row.role || known.role,
    });
  };

  const move = (i: number, to: number) => {
    if (to < 0 || to >= credits.length) return;
    const next = [...credits];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };

  /* Dragging: the row goes where it was dropped, the others close up. The
     grip is the only draggable part, because a draggable row swallows the
     mouse-selects-text gesture inside its own inputs. Same mechanics as
     `Ordering` in `admin-disciplines.tsx`: the origin rides in
     `dataTransfer`, with the state as the fallback. The arrows stay for
     the keyboard, and for a phone, where there is no drag. */
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [over, setOver] = React.useState<number | null>(null);
  const place = (from: number, to: number) => {
    if (from === to || !credits[from]) return;
    const next = [...credits];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  };

  return (
    <div className={className}>
      {title ? (
        <p className="label flex items-baseline justify-between gap-3 text-muted-foreground">
          <span>{title}</span>
          {credits.length ? (
            <span className="tabular-nums">{credits.length}</span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {credits.map((credit, i) => (
          <div
            key={i}
            onDragOver={(e) => {
              if (dragging === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== i) setOver(i);
            }}
            onDrop={(e) => {
              if (dragging === null) return;
              // Cancelling the drop also stops the index landing as text in
              // whichever input it was released over.
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              place(Number.isInteger(from) ? from : dragging, i);
              setDragging(null);
              setOver(null);
            }}
            className={cn(
              "flex flex-wrap items-center gap-2 transition-opacity duration-150",
              dragging === i && "opacity-30",
              over === i &&
                dragging !== null &&
                dragging !== i &&
                "outline outline-2 outline-offset-2 outline-foreground",
            )}
          >
            <span
              draggable
              onDragStart={(e) => {
                setDragging(i);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
                const row = e.currentTarget.parentElement;
                if (row) e.dataTransfer.setDragImage(row, 0, 0);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              title="Drag to reorder"
              aria-label={`Drag credit ${i + 1}`}
              className="label shrink-0 cursor-grab select-none px-1 py-2 text-muted-foreground active:cursor-grabbing"
            >
              ≡
            </span>
            {/* A list, not a closed set. The roles above cover most jobs and
                save the typing; anything can still be written in, because a
                shoot invents a role now and then and a dropdown that refuses
                one is a dropdown you work around by lying. */}
            <input
              value={credit.role}
              onChange={(e) => set(i, { role: e.target.value })}
              list="jg-credit-roles"
              placeholder="Role"
              aria-label={`Role for credit ${i + 1}`}
              className={cn(field, "sm:w-44 sm:shrink-0")}
            />
            {/* Julian: somebody credited once should not be typed out
                again. The list is everyone in the archive; picking one of
                them fills the handle and the role, and typing a new name
                does nothing at all. */}
            <input
              value={credit.name}
              onChange={(e) => remember(i, e.target.value)}
              list={desk ? "jg-credit-people" : undefined}
              placeholder="Name"
              aria-label={`Name for credit ${i + 1}`}
              className={field}
            />
            {/* Kept raw while typing and normalised on the way out.
                Rewriting the box under somebody's cursor — eating the `@` as
                they type it, lowercasing mid-word — is the kind of helpful
                that makes a field feel broken. `@` is printed beside it
                instead of expected inside it, and a pasted profile URL is
                accepted whole and reduced on blur. */}
            <span className="relative shrink-0 sm:w-52">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                @
              </span>
              <input
                value={credit.instagram ?? ""}
                onChange={(e) => set(i, { instagram: e.target.value })}
                onBlur={(e) =>
                  set(i, { instagram: instagramHandle(e.target.value) })
                }
                placeholder="instagram"
                aria-label={`Instagram handle for credit ${i + 1}`}
                className={cn(field, "pl-7")}
              />
            </span>
            {desk ? <Face desk={desk} handle={credit.instagram ?? ""} /> : null}
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label={`Move credit ${i + 1} up`}
                className="label border border-border px-2 py-2 press hoverable:hover:bg-card disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === credits.length - 1}
                aria-label={`Move credit ${i + 1} down`}
                className="label border border-border px-2 py-2 press hoverable:hover:bg-card disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(credits.filter((_, j) => j !== i))}
                aria-label={`Remove credit ${i + 1}`}
                className="label border border-border px-2 py-2 text-muted-foreground press hoverable:hover:text-destructive"
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>

      <datalist id="jg-credit-roles">
        {ROLES.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      {desk ? (
        <datalist id="jg-credit-people">
          {Object.keys(desk.people)
            .sort((x, y) => x.localeCompare(y))
            .map((n) => (
              <option key={n} value={n} />
            ))}
        </datalist>
      ) : null}

      <button
        type="button"
        onClick={() =>
          onChange([...credits, { role: "", name: "", instagram: null }])
        }
        className="label mt-3 border border-border px-4 py-2 press hoverable:hover:bg-card"
      >
        Add credit
      </button>

      {credits.length === 0 ? (
        <p className="label mt-3 text-muted-foreground">
          No credits. The block is left off the project page entirely.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Drops the half-filled rows, and anything unusable in the handle.
 *
 * Role and name are both required — half a credit is not one. The handle is
 * not: a crew member with no Instagram, or with one nobody could remember, is
 * an ordinary credit and prints as plain text. Normalised here as well as on
 * blur, because a row can be added and published without the field ever being
 * focused, and `lib/added.ts` would then refuse the build over a stray `@`.
 */
export const tidyCredits = (credits: Credit[]): Credit[] =>
  credits
    .filter((c) => c.role.trim() !== "" && c.name.trim() !== "")
    .map((c) => ({
      ...c,
      instagram: c.instagram ? instagramHandle(c.instagram) : null,
    }));

/* ── a collaborator's face ────────────────────────────────────────
 * The circle beside a handle: the profile photograph the hover card on a
 * project page draws, saved with the site as `public/people/<handle>.jpg`.
 *
 * Fetching it is not a button here, and that is measured rather than
 * chosen: Instagram answers a request from a home connection and refuses
 * one from a datacentre. From a Worker on Cloudflare's edge every user
 * agent came back 429, and two public proxies came back 429 and 403. So
 * the collecting is `scripts/faces.mjs`, run on Julian's own machine,
 * which fetches every credited handle at once and commits the results.
 *
 * This is the other half: one face, chosen by hand, for somebody the
 * script could not reach — a private account, or a picture Julian would
 * rather choose himself.
 * ─────────────────────────────────────────────────────────────── */
function Face({ desk, handle }: { desk: CreditDeskValue; handle: string }) {
  const [busy, setBusy] = React.useState(false);
  const [said, setSaid] = React.useState("");
  const file = React.useRef<HTMLInputElement>(null);
  const has = handle ? desk.faces[handle] : "";

  const chosen = async (f: File | undefined) => {
    if (!f || !handle) return;
    setBusy(true);
    setSaid("");
    try {
      // 320px: the card draws it at 56, and a retina screen at twice that.
      const image = await processImage(f, 320);
      desk.onFace(handle, {
        base64: image.base64,
        preview: `data:image/jpeg;base64,${image.base64}`,
        bytes: image.bytes,
      });
    } catch (e) {
      setSaid(e instanceof Error ? e.message : "That would not open.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        disabled={!handle || busy}
        onClick={() => file.current?.click()}
        title={
          handle
            ? "Choose this person's picture. `scripts/faces.mjs` fetches them all."
            : "Add the handle first"
        }
        aria-label={`Picture for ${handle || "this credit"}`}
        className="size-10 shrink-0 overflow-hidden border border-border bg-card press disabled:opacity-30"
      >
        {has ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={has} alt="" className="size-full object-cover" />
        ) : (
          <span className="label text-muted-foreground">
            {busy ? "…" : "+"}
          </span>
        )}
      </button>
      {has ? (
        <button
          type="button"
          onClick={() => desk.onFace(handle, null)}
          className="label text-muted-foreground underline-offset-4 press hoverable:hover:underline"
        >
          Remove
        </button>
      ) : null}
      {said ? (
        <span className="label max-w-40 text-muted-foreground">{said}</span>
      ) : null}
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void chosen(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </span>
  );
}
