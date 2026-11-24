import * as React from "react";

const VIEWS = [
  [
    "grid",
    "Grid view",
    <svg
      key="g"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="5.5" height="5.5" />
      <rect x="9" y="1.5" width="5.5" height="5.5" />
      <rect x="1.5" y="9" width="5.5" height="5.5" />
      <rect x="9" y="9" width="5.5" height="5.5" />
    </svg>,
  ],
  [
    "strip",
    "Strip view",
    <svg
      key="s"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <rect x="1.5" y="2" width="3.5" height="12" />
      <rect x="6.25" y="2" width="3.5" height="12" />
      <rect x="11" y="2" width="3.5" height="12" />
    </svg>,
  ],
  [
    "color",
    "Color view",
    <svg
      key="c"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <g transform="rotate(45 8 8)">
        <rect x="6.4" y=".6" width="3.2" height="4.4" rx="1.4" />
        <rect x="5.2" y="5" width="5.6" height="1.5" rx=".5" />
        <path d="M7 6.5h2l-.35 6.4L8 14.6l-.65-1.7Z" opacity=".8" />
      </g>
    </svg>,
  ],
] as const;

export const LOUPE = (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <circle
      cx="6"
      cy="6"
      r="4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    />
    <path
      d="M9.4 9.4L13 13"
      stroke="currentColor"
      strokeWidth="1.3"
    />
  </svg>
);

export const CROSS = (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

/* One field for the row and the header: "Search" fits a 390 phone, the label says
   the rest. Esc clears, a second Esc leaves. */
export function SearchField({
  head,
  raw,
  setRaw,
  setRowOn,
  close,
}: {
  head: boolean;
  raw: string;
  setRaw: (v: string) => void;
  setRowOn: (on: boolean) => void;
  close: () => void;
}) {
  return (
    <label className={head ? "hsearch" : "wsearch"} data-has={raw ? "" : undefined}>
      {LOUPE}
      <input
        type="search"
        ref={head ? (el) => el?.focus({ preventScroll: true }) : undefined}
        placeholder="Search"
        aria-label="Search the work by name, discipline or credit"
        autoComplete="off"
        enterKeyHint="search"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onFocus={head ? undefined : () => setRowOn(true)}
        onBlur={head ? undefined : () => setRowOn(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key !== "Escape") return;
          e.preventDefault();
          if (raw) setRaw("");
          else if (head) close();
          else e.currentTarget.blur();
        }}
      />
      {head ? null : <kbd className="wkey" aria-hidden="true">/</kbd>}
      <button
        type="button"
        className="wclr"
        aria-label="Clear search"
        inert={!raw}
        onPointerDown={(e) => e.preventDefault()}
        onClick={(e) => {
          setRaw("");
          e.currentTarget.parentElement?.querySelector("input")?.focus();
        }}
      >
        <i>
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
            <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </i>
      </button>
    </label>
  );
}

type View = "grid" | "strip" | "color";

/** Color on its own, then Grid, Strip and Canvas as one set. */
export function Views({
  canvas,
  view,
  back,
  setBack,
  go,
  unfold,
  fold,
  rep,
  warm,
}: {
  canvas: boolean;
  view: View;
  back: "grid" | "strip";
  setBack: (v: "grid" | "strip") => void;
  go: (v: View | "canvas") => void;
  unfold: boolean;
  fold: (act: () => void) => void;
  rep: string;
  warm: (n: number) => void;
}) {
  return (
    <div className="wviews" role="group" aria-label="View">
      {/* The vectorscope is a mode of its own: on, then off back to
          the view it came from. Then Strip, and Grid in the corner. */}
      <button
        type="button"
        className="wcolor"
        aria-pressed={!canvas && view === "color"}
        aria-label={VIEWS[2][1]}
        title={VIEWS[2][1]}
        onClick={() => {
          // Under the canvas the button is not pressed: it lands on Color, also when Color is the view lying there.
          if (view === "color" && !canvas) go(back);
          else {
            if (view !== "color") setBack(view);
            go("color");
          }
        }}
      >
        {VIEWS[2][2]}
      </button>
      {/* Grid, Strip and Canvas: one set. On a phone it folds to the view that is on
          (data-rep), and the first tap unfolds it (Julian). */}
      <div className={unfold ? "vset open" : "vset"}>
      <button type="button" aria-pressed={canvas} aria-label="Canvas view" title="Canvas view" data-rep={rep === "canvas" ? "" : undefined} onClick={() => fold(() => go("canvas"))}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            {/* Two columns out of step, their ends faded: the field runs past the edge (Julian's pick). */}
            <rect x="1.5" y="1" width="5.5" height="6.5" />
            <rect x="1.5" y="9" width="5.5" height="6" opacity=".55" />
            <rect x="9" y="1" width="5.5" height="1" opacity=".55" />
            <rect x="9" y="3.5" width="5.5" height="6.5" />
            <rect x="9" y="11.5" width="5.5" height="3.5" opacity=".55" />
          </svg>
      </button>
      {[VIEWS[1], VIEWS[0]].map(([v, label, icon]) => (
        <button
          key={v}
          type="button"
          aria-pressed={!canvas && view === v}
          aria-label={label}
          title={label}
          data-rep={rep === v ? "" : undefined}
          onPointerDown={v === "strip" ? () => warm(8) : undefined}
          onPointerEnter={v === "strip" ? () => warm(8) : undefined}
          onFocus={v === "strip" ? () => warm(8) : undefined}
          onClick={() => fold(() => go(v))}
        >
          {icon}
        </button>
      ))}
      </div>
    </div>
  );
}
