"use client";

import * as React from "react";
import type { Draft } from "@/lib/admin/publish";
import type { TrashedProject } from "@/lib/work/added";
import type { ListDraft, Overrides } from "@/components/admin/editor/props";

/** The five per-project override maps out of a manifest. */
const overridesOf = (m: Draft): Overrides => ({ categories: m.categories, frames: m.frames, credits: m.credits, copy: m.copy, slugs: m.slugs });

/**
 * The manifest side of the editor's draft: the project list, the per-project
 * overrides, the running order, discipline covers, faces and the trash.
 * `reset` takes the repo's manifest back in when a session loads it.
 */
export function useManifestDraft(published: Draft, initialTrash: TrashedProject[]) {
  /** Hidden and unlisted slugs and BTS, as one draft with one setter (`withListDraft`). */
  const [listDraft, setListDraft] = React.useState<ListDraft>(() => ({
    hidden: new Set(published.hidden),
    unlisted: new Set(published.unlisted),
    bts: published.bts,
  }));
  const [trash, setTrash] = React.useState<TrashedProject[]>(initialTrash);
  /** The five per-project override maps, as one draft with one setter (`withProjectOverride`). */
  const [overrides, setOverrides] = React.useState<Overrides>(() => overridesOf(published));
  /** The running order of the work, by slug. Partial, see `lib/work/added.ts`. */
  const [order, setOrder] = React.useState<string[]>(published.order);
  /** The photograph standing for each discipline, by category slug. */
  const [covers, setCovers] = React.useState<Record<string, string>>(published.covers);
  /** A collaborator's profile photograph, by Instagram handle. One person,
      one picture, however many shoots they are credited on. */
  const [avatars, setAvatars] = React.useState<Record<string, string>>(published.avatars);

  const reset = (repo: Draft) => {
    setListDraft({ hidden: new Set(repo.hidden), unlisted: new Set(repo.unlisted), bts: repo.bts });
    setOverrides(overridesOf(repo));
    setOrder(repo.order);
    setCovers(repo.covers);
    setAvatars(repo.avatars);
  };

  return {
    listDraft, setListDraft,
    trash, setTrash,
    overrides, setOverrides,
    order, setOrder,
    covers, setCovers,
    avatars, setAvatars,
    reset,
  };
}
