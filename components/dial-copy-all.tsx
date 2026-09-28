"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { DialStore } from "dialkit";
import { notesText } from "@/lib/arrange-notes";

/* Julian: "copy all" on DialKit, every page. One button in the panel's
   header that copies every panel on the page at once (each one's own copy
   button only takes its own), in the same paste DialKit's gives, so a
   paste back here makes them all defaults in one go. The dev server only,
   as the panels are. */
/** Every panel on the page, in the paste DialKit's own copy gives. */
function copyText() {
  const blocks = DialStore.getPanels("panel").map((p) => {
    const values = Object.fromEntries(
      Object.entries(DialStore.getValues(p.id)).filter(([k]) => !k.endsWith(".__mode")),
    );
    return `"${p.name}" (${p.id}):\n\n\`\`\`json\n${JSON.stringify(values, null, 2)}\n\`\`\``;
  });
  const notes = notesText();
  return `Update these useDialKit panels on ${location.pathname} with these values, as the new defaults:\n\n${blocks.join("\n\n")}${notes ? `\n\n${notes}` : ""}`;
}

export function DialCopyAll() {
  const [header, setHeader] = React.useState<Element | null>(null);
  const [copied, setCopied] = React.useState(false);

  // The header is DialKit's, and comes and goes with it.
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const find = () =>
      setHeader(document.querySelector(".dialkit-folder-root > .dialkit-panel-header"));
    find();
    const watch = new MutationObserver(find);
    watch.observe(document.body, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, []);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  /* The same text, for the arrange tool that walks the screen sizes
     (it reads it at each Submit). */
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as { __dialCopyAll?: () => string }).__dialCopyAll = copyText;
  }, []);

  if (!header) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText());
      setCopied(true);
    } catch {}
  };

  return createPortal(
    <button type="button" className="dial-copy-all" onClick={copy} title="Copy every panel">
      {copied ? "Copied" : "Copy all"}
    </button>,
    header,
  );
}
