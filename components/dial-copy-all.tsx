"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { DialStore } from "dialkit";

/* Julian: "copy all" on DialKit, every page. One button in the panel's
   header that copies every panel on the page at once (each one's own copy
   button only takes its own), in the same paste DialKit's gives, so a
   paste back here makes them all defaults in one go. The dev server only,
   as the panels are. */
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

  if (!header) return null;

  const copy = async () => {
    const blocks = DialStore.getPanels("panel").map((p) => {
      const values = Object.fromEntries(
        Object.entries(DialStore.getValues(p.id)).filter(([k]) => !k.endsWith(".__mode")),
      );
      return `"${p.name}" (${p.id}):\n\n\`\`\`json\n${JSON.stringify(values, null, 2)}\n\`\`\``;
    });
    try {
      await navigator.clipboard.writeText(
        `Update these useDialKit panels on ${location.pathname} with these values, as the new defaults:\n\n${blocks.join("\n\n")}`,
      );
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
