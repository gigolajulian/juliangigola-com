"use client";

import * as React from "react";
import { creditBook } from "@/components/admin/admin-credits";
import type { PendingUpload } from "@/components/admin/admin-frames";
import type { AdminEditorProps, Overrides } from "@/components/admin/admin-editor-props";

export function useCreditDesk(
  projects: AdminEditorProps["projects"],
  recredited: Overrides["credits"],
  avatars: Record<string, string>,
  uploads: Record<string, PendingUpload>,
  setAvatars: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  setUploads: React.Dispatch<React.SetStateAction<Record<string, PendingUpload>>>,
) {
  /* ── the credit desk ────────────────────────────────────────────
     Everyone ever credited, and the faces on file, handed to the credit
     rows wherever they are drawn, the project list, the page editor, the
     new project form. A context, because none of the three panels in
     between has any business carrying it. */
  const people = React.useMemo(
    () =>
      creditBook([
        ...projects.map((p) => recredited[p.slug] ?? p.credits),
        ...Object.values(recredited),
      ]),
    [projects, recredited],
  );
  /* What a circle draws: the picture staged in this session if there is
     one, and otherwise the copy the last build published. */
  const faces = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const [handle, path] of Object.entries(avatars)) {
      out[handle] = uploads[`public${path}`]?.preview ?? path;
    }
    return out;
  }, [avatars, uploads]);
  const desk = React.useMemo(
    () => ({
      people,
      faces,
      onFace: (
        handle: string,
        picture: { base64: string; preview: string; bytes: number } | null,
      ) => {
        const path = `/people/${handle}.jpg`;
        if (!picture) {
          setAvatars((a) => {
            const next = { ...a };
            delete next[handle];
            return next;
          });
          setUploads((u) => {
            const next = { ...u };
            delete next[`public${path}`];
            return next;
          });
          return;
        }
        setUploads((u) => ({
          ...u,
          [`public${path}`]: {
            path: `public${path}`,
            base64: picture.base64,
            preview: picture.preview,
            bytes: picture.bytes,
          },
        }));
        setAvatars((a) => ({ ...a, [handle]: path }));
      },
    }),
    [people, faces, setAvatars, setUploads],
  );
  return desk;
}
