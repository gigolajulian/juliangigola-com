/* Julian's notes on each photograph while arranging the cover, written in
   the arrange inspector and carried by DialKit's
   "Copy all" (`dial-copy-all.tsx`), so a paste brings them with the
   values. Dev server only. Kept for the tab's life in sessionStorage, as
   the layout panels' values are, so a reload keeps them. */
import { sessionJson, sessionSet } from "@/lib/utils";

const KEY = "jg-arrange-notes";

export type Note = { card: string; photo: string; layout: string; text: string };

export function readNotes(): Record<string, Note> {
  return sessionJson<Record<string, Note>>(KEY) ?? {};
}

export function writeNote(id: string, note: Note) {
  const all = readNotes();
  if (note.text.trim()) all[id] = note;
  else delete all[id];
  sessionSet(KEY, JSON.stringify(all));
}

/** The notes as lines for a paste; empty when there are none. */
export function notesText() {
  const lines = Object.values(readNotes()).map(
    (n) => `- ${n.card} (${n.photo}), ${n.layout}: ${n.text.trim()}`,
  );
  return lines.length ? `Notes on the photographs:\n\n${lines.join("\n")}` : "";
}
