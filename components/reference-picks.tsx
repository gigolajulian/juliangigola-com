"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { MAX_REFS } from "@/lib/inbox";

/* ── references on the inquiry (Julian, 2026-10-05) ──
   Images the visitor uploads, and frames of Julian's they pick from a
   panel that pops out of the form. Uploads are shrunk in the browser to
   1600px JPEGs and ride the form as `refs`; picks go as their paths in
   `picks`. Both arrive with the enquiry email (`app/contact/actions.ts`). */

const EDGE = 1600;

type Upload = { file: File; url: string };
type Group = { name: string; frames: [string, number, number, string][] };

/** A phone photo is 4 to 12MB; 1600px at 0.82 is a few hundred KB. */
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, EDGE / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // A format the browser cannot draw (HEIC outside Safari): sent as is.
    return file;
  }
}

export function ReferencePicks({ resync }: { resync: unknown }) {
  const [uploads, setUploads] = React.useState<Upload[]>([]);
  const [picks, setPicks] = React.useState<string[]>([]);
  const refs = React.useRef<HTMLInputElement>(null);
  const dialog = React.useRef<HTMLDialogElement>(null);
  const [groups, setGroups] = React.useState<Group[] | null>(null);
  const room = MAX_REFS - uploads.length - picks.length;

  // The frames are fetched the first time the panel opens, never before.
  const open = () => {
    if (!groups)
      fetch("/picks.json")
        .then((r) => r.json())
        .then(setGroups)
        .catch(() => setGroups([]));
    dialog.current?.showModal();
  };

  /* The files the form sends, rewritten whenever the list changes, and
     after a submit, which resets the form's inputs. */
  React.useEffect(() => {
    if (!refs.current) return;
    const dt = new DataTransfer();
    uploads.forEach((u) => dt.items.add(u.file));
    refs.current.files = dt.files;
  }, [uploads, resync]);

  const add = async (list: FileList | null) => {
    const files = [...(list ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, room);
    const shrunk = await Promise.all(files.map(shrink));
    setUploads((u) => [...u, ...shrunk.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };
  const drop = (i: number) =>
    setUploads((u) => {
      URL.revokeObjectURL(u[i].url);
      return u.filter((_, j) => j !== i);
    });
  const toggle = (src: string) =>
    setPicks((p) => (p.includes(src) ? p.filter((s) => s !== src) : room > 0 ? [...p, src] : p));

  const button =
    "tap-44 label cursor-pointer rounded-full border border-border px-4 py-2 text-muted-foreground transition-colors duration-200 hoverable:hover:border-foreground/40 hoverable:hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="contact-field">
      <input ref={refs} type="file" name="refs" multiple hidden tabIndex={-1} />
      <input type="hidden" name="picks" value={picks.join("\n")} />
      <div className="flex flex-wrap items-center gap-2">
        <p className="label mr-auto text-muted-foreground">
          References <span className="opacity-70">· optional</span>
        </p>
        <label className={cn(button, room <= 0 && "pointer-events-none opacity-40")}>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={room <= 0}
            onChange={(e) => {
              add(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
          Upload images
        </label>
        <button type="button" className={button} onClick={open}>
          Pick from my work
        </button>
      </div>
      {uploads.length + picks.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {uploads.map((u, i) => (
            <Thumb key={u.url} label={u.file.name} onRemove={() => drop(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a local blob */}
              <img src={u.url} alt="" className="size-full object-cover" />
            </Thumb>
          ))}
          {picks.map((src) => (
            <Thumb key={src} label="my photograph" onRemove={() => toggle(src)}>
              <Image src={src} alt="" width={128} height={128} sizes="64px" className="size-full object-cover" />
            </Thumb>
          ))}
        </ul>
      ) : null}
      <PickPanel dialog={dialog} groups={groups} picks={picks} room={room} toggle={toggle} />
    </div>
  );
}

function Thumb({
  label,
  onRemove,
  children,
}: {
  label: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="emerge group relative size-16">
      {/* The photograph clipped to its own frame, so the remove button's
          thumb-sized box (`tap-44`) can reach past the corner. */}
      <span className="block size-full overflow-hidden rounded-[6px] border border-border">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="tap-44 absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-background/80 text-[0.7rem] leading-none text-foreground opacity-80 transition-opacity hoverable:hover:opacity-100"
      >
        ×
      </button>
    </li>
  );
}

function PickPanel({
  dialog,
  groups,
  picks,
  room,
  toggle,
}: {
  dialog: React.RefObject<HTMLDialogElement | null>;
  groups: Group[] | null;
  picks: string[];
  room: number;
  toggle: (src: string) => void;
}) {
  const [lit, setLit] = React.useState(0);
  const list = React.useRef<HTMLDivElement>(null);
  const bar = React.useRef<HTMLSpanElement>(null);
  const fill = () => {
    const l = list.current;
    if (!l || !bar.current) return;
    const room = l.scrollHeight - l.clientHeight;
    // How far down the photographs are, at least the share on screen.
    const shown = l.clientHeight / l.scrollHeight;
    const p = room > 0 ? l.scrollTop / room : 1;
    bar.current.style.height = `${(shown + (1 - shown) * p) * 100}%`;
  };
  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const l = list.current;
    if (!l) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    l.scrollTop = p * (l.scrollHeight - l.clientHeight);
  };
  // A new look starts at the top, and the bar with it once its photographs are in.
  React.useEffect(() => {
    list.current?.scrollTo({ top: 0 });
    const t = requestAnimationFrame(fill);
    return () => cancelAnimationFrame(t);
  }, [lit, groups]);

  return (
    <dialog
      ref={dialog}
      // A click on the backdrop is a click on the dialog itself.
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      className="reference-panel"
      aria-label="Pick from my work"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4 px-6 pb-4 pt-5">
          <p className="label">
            Pick from my work{" "}
            <span className="text-muted-foreground">
              · {picks.length} picked{room <= 0 ? ", that is the most" : ""}
            </span>
          </p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="label action px-5 py-2"
          >
            Done
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto px-6 pb-4 [scrollbar-width:none]">
          {(groups ?? []).map((g, i) => (
            <button
              key={g.name}
              type="button"
              onClick={() => setLit(i)}
              className={cn(
                "label shrink-0 rounded-full border px-4 py-2 transition-colors duration-200",
                // The look chosen, inverted, as the form's own kinds of shoot are.
                lit === i
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hoverable:hover:text-foreground",
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
        <div className="relative flex min-h-0 flex-1">
        <div
          ref={list}
          onScroll={fill}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {!groups ? (
            <p className="label text-muted-foreground">Loading</p>
          ) : (
            <ul
              // Four a row (Julian, 2026-10-08), three on a phone.
              className="grid grid-cols-3 gap-2 sm:grid-cols-4"
            >
              {groups[lit]?.frames.map(([src, w, h, project]) => {
                const n = picks.indexOf(src);
                return (
                  <li key={src}>
                    <button
                      type="button"
                      onClick={() => toggle(src)}
                      aria-pressed={n >= 0}
                      aria-label={project}
                      title={project}
                      disabled={n < 0 && room <= 0}
                      className={cn(
                        "relative block w-full overflow-hidden rounded-[6px] outline-offset-2 transition-[opacity,outline-color,scale] duration-200 disabled:opacity-40",
                        // A little larger under the hand: it can be picked (Julian, 2026-10-08).
                        "hoverable:hover:enabled:scale-[1.03]",
                        n >= 0 ? "outline outline-2 outline-foreground" : "outline outline-1 outline-transparent hoverable:hover:outline-border",
                        // Sleeves are square, and shown whole (Julian, 2026-10-08).
                        groups[lit]?.name === "Cover art" ? "aspect-square" : "aspect-[3/4]",
                      )}
                    >
                      <Image
                        src={src}
                        alt=""
                        width={w}
                        height={h}
                        sizes="160px"
                        loading="lazy"
                        className="size-full object-cover"
                      />
                      {n >= 0 ? (
                        <span className="label absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-foreground text-background">
                          {n + 1}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {/* The page's rail, stood upright (Julian, 2026-10-08: the site's
            own scroll bar): a hairline track, the ink filling down it as
            the photographs go by. Pressed or dragged, it scrolls there. */}
        <div
          aria-hidden
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            seek(e);
          }}
          onPointerMove={(e) => e.buttons && seek(e)}
          className="absolute bottom-6 right-2 top-0 w-3 cursor-pointer touch-none"
        >
          <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-[color-mix(in_oklab,var(--foreground)_20%,var(--background))]">
            <span ref={bar} className="block w-full rounded-full bg-foreground" style={{ height: "0%" }} />
          </span>
        </div>
        </div>
      </div>
    </dialog>
  );
}
