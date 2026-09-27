"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { WarpText } from "@/components/warp-text";

type Props = React.ComponentProps<typeof WarpText> & {
  /** What the panel is for, printed at its head. */
  title?: string;
  /** Which bottom corner the panel sits in, so two can be open at once. */
  corner?: "left" | "right";
};

/** The knobs, with the range each slider covers. */
const KNOBS = [
  ["warpStrength", "Warp strength", 0, 0.6, 0.01],
  ["warpScale", "Warp scale (lower is broader)", 0.2, 5, 0.05],
  ["speed", "Speed", 0, 2, 0.01],
  ["pointerInfluence", "Lens radius", 0.1, 3, 0.05],
  ["pointerStrength", "Lens strength", 0, 1.5, 0.01],
  ["refraction", "Colour split", 0, 0.1, 0.001],
  ["ripple", "Ripple", 0, 4, 0.05],
] as const;

type Tune = Record<(typeof KNOBS)[number][0], number>;

/**
 * WarpText with sliders. Julian: tune the cover's name, and the header's
 * logo, by hand. The panel only shows on the dev server with `?tune` in
 * the address; everywhere else this is the text as its props set it.
 * Copy puts the props on the clipboard to paste back.
 */
export function WarpTuner({ title, corner = "left", ...props }: Props) {
  const [tune, setTune] = React.useState<Tune>({
    warpStrength: props.warpStrength ?? 0.08,
    warpScale: props.warpScale ?? 1.7,
    speed: props.speed ?? 0.55,
    pointerInfluence: props.pointerInfluence ?? 0.42,
    pointerStrength: props.pointerStrength ?? 0.38,
    refraction: props.refraction ?? 0.018,
    ripple: Number(props.ripple ?? true),
  });
  const open = React.useSyncExternalStore(
    () => () => {},
    () => process.env.NODE_ENV !== "production" && location.search.includes("tune"),
    () => false,
  );

  const [sent, setSent] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  /* A change after submitting or copying is not what was sent. */
  const change = (k: string, v: number) => {
    setTune({ ...tune, [k]: v });
    setSent(null);
    setCopied(false);
  };

  const snippet = KNOBS.map(([k]) => `${k}={${tune[k]}}`).join("\n");

  return (
    <>
      <WarpText {...props} {...tune} />
      {open &&
        createPortal(
          <div
            className="warp-tuner glass-surface bg-background/80"
            data-corner={corner}
            aria-label={`${title ?? "Title"} effect sliders`}
            /* Portaled to the body, but React still bubbles its events to
               the component's parents: inside the header's logo link a
               click here was a click on the link and went home. */
            onClick={(e) => e.stopPropagation()}
          >
            {title ? <p>{title}</p> : null}
            {KNOBS.map(([k, label, min, max, step]) => (
              <label key={k}>
                <span>
                  {label} <b>{tune[k]}</b>
                </span>
                <input
                  id={`tune-${corner}-${k}`}
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={tune[k]}
                  onChange={(e) => change(k, Number(e.target.value))}
                />
              </label>
            ))}
            <div className="warp-tuner-actions">
              {/* Saves them on the dev server for Claude to read back
                  (`app/api/tune/route.ts`). */}
              <button
                type="button"
                onClick={async () => {
                  setSent("Sending");
                  const r = await fetch("/api/tune", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ title: title ?? "Title", values: tune }),
                  }).catch(() => null);
                  setSent(r?.ok ? "Submitted" : "Failed, copy instead");
                }}
              >
                {sent ?? "Submit"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(snippet);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy values"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
