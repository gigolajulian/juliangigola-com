"use client";

import * as React from "react";
import type { PendingUpload } from "@/lib/admin/admin-sequence";
import type { SetOverride } from "@/components/admin/editor/draft";

/** What the editor shares with the panels that stage photographs or set a project's override. */
export type EditorStaging = {
  /** Photographs staged for this publish, by repo path. */
  uploads: Record<string, PendingUpload>;
  /** Photographs processed for a gallery, staged for this publish. */
  onUpload: (added: PendingUpload[]) => void;
  /** One project's override changed. Null is back to what is published (`withProjectOverride`). */
  onOverride: SetOverride;
};

const Staging = React.createContext<EditorStaging | null>(null);

/** Set once by `AdminEditor`, read by the project list, the gallery, the BTS and the page editor. */
export const EditorStagingProvider = Staging.Provider;

export function useEditorStaging(): EditorStaging {
  const staging = React.useContext(Staging);
  if (!staging) throw new Error("useEditorStaging is read under AdminEditor's EditorStagingProvider");
  return staging;
}
