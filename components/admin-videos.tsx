"use client";

import * as React from "react";
import {
  SECTIONS,
  parseVideoUrl,
  posterFor,
  youtubeStills,
  type Video,
  type VideoSection,
} from "@/lib/videos";
import { cn } from "@/lib/utils";

/* ── the video tab ────────────────────────────────────────────────
 * Paste a link. Everything else is filled in or picked.
 *
 * The alternative — a form with provider, id, title and poster URL as four
 * fields — asks Julian to know that a YouTube id is the eleven characters
 * after `v=`, and to find a thumbnail URL by hand. He has the link in his
 * clipboard; that is the whole input.
 *
 * The title comes from the provider's oEmbed endpoint, which is also where
 * Vimeo's poster comes from: Vimeo does not publish stills at a guessable
 * URL, while YouTube publishes five per video. So "pick the best screenshot"
 * is a row of thumbnails for YouTube and whatever Vimeo gives for Vimeo.
 *
 * A failed lookup is not a failed add. The link parsed, which is the part
 * that matters; the title is then typed instead of fetched.
 * ─────────────────────────────────────────────────────────────── */

export function AdminVideos({
  videos,
  onChange,
}: {
  videos: Video[];
  onChange: (next: Video[]) => void;
}) {
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [section, setSection] = React.useState<VideoSection>("music");
  const [dragging, setDragging] = React.useState<string | null>(null);

  async function add() {
    const parsed = parseVideoUrl(url);
    if (!parsed) {
      setProblem(
        "That is not a YouTube or Vimeo link I can read. A watch link, a share link or youtu.be all work.",
      );
      return;
    }
    if (videos.some((v) => v.videoId === parsed.videoId)) {
      setProblem("That one is already on the page.");
      return;
    }

    setBusy(true);
    setProblem(null);

    /* oEmbed, for the title and — where the provider keeps its stills to
       itself — the poster. Both endpoints are public, take no key, and are
       named in `connect-src`; a failure here is caught and the row is added
       anyway with the title left to type. */
    let title = "";
    let poster: string | undefined;
    try {
      const endpoint =
        parsed.provider === "youtube"
          ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
              `https://www.youtube.com/watch?v=${parsed.videoId}`,
            )}`
          : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(
              `https://vimeo.com/${parsed.videoId}`,
            )}`;
      const res = await fetch(endpoint, { cache: "no-store" });
      if (res.ok) {
        const body = (await res.json()) as {
          title?: string;
          thumbnail_url?: string;
        };
        title = typeof body.title === "string" ? body.title : "";
        // Only Vimeo's is kept: YouTube's oEmbed hands back the small
        // `hqdefault`, which `posterFor` already derives, and storing it
        // would pin the tile to the one still rather than leaving the choice
        // open below.
        if (parsed.provider === "vimeo" && body.thumbnail_url?.startsWith("https://i.vimeocdn.com/"))
          poster = body.thumbnail_url;
      }
    } catch {
      // Offline, or the provider is having a day. The link is still good.
    }

    onChange([
      ...videos,
      {
        id: `${parsed.provider}-${parsed.videoId}`,
        title: title || "Untitled",
        provider: parsed.provider,
        videoId: parsed.videoId,
        section,
        ...(poster ? { poster } : {}),
      },
    ]);
    setUrl("");
    setBusy(false);
  }

  const patch = (id: string, next: Partial<Video>) =>
    onChange(videos.map((v) => (v.id === id ? { ...v, ...next } : v)));

  /** Lift and insert, like every other list in here. */
  const reorder = (from: string, to: string) => {
    if (from === to) return;
    const next = [...videos];
    const at = next.findIndex((v) => v.id === from);
    const onto = next.findIndex((v) => v.id === to);
    if (at === -1 || onto === -1) return;
    const [held] = next.splice(at, 1);
    next.splice(next.findIndex((v) => v.id === to) + (onto > at ? 1 : 0), 0, held);
    onChange(next);
  };

  return (
    <div className="mt-10 flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl uppercase tracking-[0]">Video</h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Paste a YouTube or Vimeo link. The title comes across on its own and
          the cover is picked from the stills below — nothing loads from either
          site on the public page until a visitor presses play.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setProblem(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
            placeholder="https://vimeo.com/… or https://youtu.be/…"
            className="min-w-0 flex-1 border border-border bg-background px-4 py-2.5 text-sm"
          />
          <select
            value={section}
            onChange={(e) => setSection(e.target.value as VideoSection)}
            className="label border border-border bg-background px-3 py-2.5"
          >
            {SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy || !url.trim()}
            className="label border border-foreground bg-foreground px-5 py-2.5 text-background press hoverable:hover:opacity-90 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-50"
          >
            {busy ? "Reading…" : "Add"}
          </button>
        </div>

        {problem ? (
          <p className="label border border-border bg-card px-4 py-3">
            {problem}
          </p>
        ) : null}
      </div>

      {SECTIONS.map((s) => {
        const rows = videos.filter((v) => v.section === s.id);
        return (
          <section key={s.id}>
            <div className="flex items-baseline justify-between border-b border-border pb-2">
              <h3 className="label">{s.name}</h3>
              <p className="label text-muted-foreground">
                {rows.length} {rows.length === 1 ? "film" : "films"}
              </p>
            </div>

            {rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing here yet.
              </p>
            ) : (
              <ul>
                {rows.map((video) => (
                  <li
                    key={video.id}
                    draggable
                    onDragStart={(e) => {
                      setDragging(video.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", video.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      // `dataTransfer` where the browser allows it, and the
                      // state as the fallback — protected mode makes `getData`
                      // return "" for a synthetic drag.
                      reorder(
                        e.dataTransfer.getData("text/plain") || dragging || "",
                        video.id,
                      );
                      setDragging(null);
                    }}
                    className={cn(
                      "flex cursor-grab flex-col gap-3 border-b border-border py-4",
                      dragging === video.id && "opacity-50",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        value={video.title}
                        onChange={(e) =>
                          patch(video.id, { title: e.target.value })
                        }
                        className="min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm"
                      />
                      <input
                        value={video.client ?? ""}
                        onChange={(e) =>
                          patch(video.id, { client: e.target.value || undefined })
                        }
                        placeholder="Artist or brand"
                        className="w-40 border border-border bg-background px-3 py-2 text-sm"
                      />
                      <input
                        value={video.year ?? ""}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          patch(video.id, {
                            year: Number.isInteger(n) && n > 1989 ? n : undefined,
                          });
                        }}
                        placeholder="Year"
                        inputMode="numeric"
                        className="w-20 border border-border bg-background px-3 py-2 text-sm tabular-nums"
                      />
                      <select
                        value={video.section}
                        onChange={(e) =>
                          patch(video.id, {
                            section: e.target.value as VideoSection,
                          })
                        }
                        className="label border border-border bg-background px-3 py-2"
                      >
                        {SECTIONS.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          onChange(videos.filter((v) => v.id !== video.id))
                        }
                        aria-label={`Remove ${video.title}`}
                        className="label px-2 text-muted-foreground press hoverable:hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>

                    <Posters video={video} onPick={patch} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * The cover, chosen from what the provider publishes.
 *
 * YouTube gives five: the uploaded thumbnail at two sizes and three frames
 * the encoder grabbed a quarter, a half and three quarters of the way in —
 * which is the whole point for a video whose own thumbnail is a title card.
 * Vimeo gives one, looked up when the link was pasted, so there is nothing to
 * choose between and the row says so rather than showing an empty strip.
 */
function Posters({
  video,
  onPick,
}: {
  video: Video;
  onPick: (id: string, next: Partial<Video>) => void;
}) {
  const current = posterFor(video);

  if (video.provider === "vimeo") {
    return (
      <div className="flex items-center gap-3">
        {current ? (
          // Not `next/image`: these are third-party thumbnails in a fixed
          // box, and the loader in this project rewrites archive paths.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current}
            alt=""
            className="h-16 w-28 border border-border object-cover"
          />
        ) : null}
        <p className="label text-muted-foreground">
          Vimeo publishes one still, and this is it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="label mr-1 text-muted-foreground">Cover</p>
      {youtubeStills(video.videoId).map((src, i) => {
        const chosen = current === src || (!video.poster && i === 1);
        return (
          <button
            key={src}
            type="button"
            onClick={() => onPick(video.id, { poster: src })}
            aria-pressed={chosen}
            className={cn(
              "border p-0.5 press",
              chosen ? "border-foreground" : "border-border",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="h-12 w-20 bg-card object-cover"
              // `maxresdefault` does not exist for every video. A broken
              // thumbnail hides itself rather than sitting there as an icon.
              onError={(e) => {
                e.currentTarget.parentElement?.setAttribute("hidden", "");
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
