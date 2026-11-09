/**
 * The lead desk's keyboard shortcuts (desktop, or an iPad with a keyboard).
 * One key map, so the list and the open lead read keys the same way.
 */
export type LeadKey =
  | { do: "palette" }
  | { do: "help" }
  | { do: "close" }
  | { do: "move"; by: 1 | -1 }
  | { do: "new" }
  | { do: "reply" }
  | { do: "snooze" }
  | { do: "snoozeFor"; days: number }
  | { do: "archive" }
  | { do: "stage"; at: number };

/** Every shortcut, for the ? overlay. */
export const LEAD_KEYS: [string, string][] = [
  ["⌘K or Ctrl K", "Jump to a lead"],
  ["J / K", "Next / previous lead"],
  ["R", "Reply in Gmail"],
  ["S, then 1 / 3 / W", "Snooze 1 day, 3 days, a week"],
  ["E", "Archive"],
  ["1 to 8", "Set the stage"],
  ["N", "New lead"],
  ["Esc", "Close"],
  ["?", "These shortcuts"],
];

type Press = { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean };

/** `typing`: a text field has focus (notes autosave), so only ⌘K gets through. */
export function leadKey(e: Press, typing: boolean, snoozing: boolean): LeadKey | null {
  const k = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && !e.altKey && k === "k") return { do: "palette" };
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return null;
  if (k === "escape") return { do: "close" };
  if (snoozing) {
    if (k === "1") return { do: "snoozeFor", days: 1 };
    if (k === "3") return { do: "snoozeFor", days: 3 };
    if (k === "w") return { do: "snoozeFor", days: 7 };
    // The snooze menu is open: a stray digit must not move the stage.
    if (/^[0-9]$/.test(k)) return null;
  }
  if (/^[1-8]$/.test(k)) return { do: "stage", at: Number(k) - 1 };
  switch (k) {
    case "?": return { do: "help" };
    case "j": return { do: "move", by: 1 };
    case "k": return { do: "move", by: -1 };
    case "n": return { do: "new" };
    case "r": return { do: "reply" };
    case "s": return { do: "snooze" };
    case "e": return { do: "archive" };
  }
  return null;
}

/** A text field, select or editable region has focus. */
export const typingIn = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
