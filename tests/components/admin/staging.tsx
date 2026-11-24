import * as React from "react";
import { vi } from "vitest";
import { EditorStagingProvider, type EditorStaging } from "@/components/admin/editor/editor-context";

/** The editor's staging context with nothing staged and spies for the setters, for panels rendered alone. */
export const staging = (over: Partial<EditorStaging> = {}): EditorStaging => ({
  uploads: {},
  onUpload: vi.fn(),
  onOverride: vi.fn(),
  ...over,
});

/** A `render` wrapper that puts a panel under `staging`. */
export const underStaging = (value: EditorStaging) =>
  function Staged({ children }: { children: React.ReactNode }) {
    return <EditorStagingProvider value={value}>{children}</EditorStagingProvider>;
  };
