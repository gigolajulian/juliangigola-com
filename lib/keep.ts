/* Word pairs that read as one and must not break across a line:
   "San / Jose", "90 / minutes" (Julian, 2026-10-22). For copy that comes
   from data; text written in JSX uses &nbsp; directly. */
export const keep = (s: string) =>
  s.replace(/\b(San(?= (?:Jose|Francisco)\b)|Bay(?= Area\b)|South(?= Bay\b)|Silicon(?= Valley\b)|\d+(?= (?:minutes?|hours?|looks?|outfits?)\b)) /g, "$1\u00a0");
