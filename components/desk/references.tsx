"use client";

import * as React from "react";
import Image from "next/image";
import { adminBlob } from "@/lib/admin/admin-call";
import type { Enquiry } from "@/lib/leads/enquiry";

/* The references an enquiry arrived with: their uploads, fetched with
   the inbox's credentials since they are theirs and private, and his
   own frames they picked, which are public. Each opens full size in a
   new tab. Only what actually loads is shown: a broken tile, or a
   heading over none, says nothing. */
export function References({ msgKey, enquiry, auth }: { msgKey: string; enquiry: Enquiry; auth: Record<string, string> }) {
  const [urls, setUrls] = React.useState<(string | null)[]>([]);
  const [broken, setBroken] = React.useState<string[]>([]);
  const count = enquiry.files?.length ?? 0;
  const header = JSON.stringify(auth);

  React.useEffect(() => {
    let live = true;
    const made: string[] = [];
    void Promise.all(
      Array.from({ length: count }, async (_, n) => {
        // a refused file is left out; a fetch that fails offline fails them all, as before
        const blob = await adminBlob(
          `/api/inbox?key=${encodeURIComponent(`ref:${msgKey}:${n}`)}`,
          "Reference failed",
          JSON.parse(header),
        ).catch((e: unknown) => {
          if (e instanceof TypeError) throw e;
          return null;
        });
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        // one that lands after unmount is let go at once
        if (!live) URL.revokeObjectURL(url);
        else made.push(url);
        return url;
      }),
    )
      .then((got) => live && setUrls(got))
      .catch(() => {});
    return () => {
      live = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [msgKey, count, header]);

  const tile = "block size-28 overflow-hidden rounded-[6px] border border-border hoverable:hover:border-foreground/40";
  const uploads = (enquiry.files ?? [])
    .map((name, n) => ({ name, url: urls[n] }))
    .filter((u): u is { name: string; url: string } => !!u.url);
  const picks = (enquiry.picks ?? []).filter((src) => !broken.includes(src));
  if (!uploads.length && !picks.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {uploads.length ? (
        <>
          <p className="label text-muted-foreground">Their references</p>
          <ul className="flex flex-wrap gap-2">
            {uploads.map(({ name, url }) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer" title={name} className={tile}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a private blob */}
                  <img src={url} alt={name} className="size-full object-cover" />
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {picks.length ? (
        <>
          <p className="label text-muted-foreground">Picked from my work</p>
          <ul className="flex flex-wrap gap-2">
            {picks.map((src) => (
              <li key={src}>
                <a href={src} target="_blank" rel="noreferrer" className={tile}>
                  <Image
                    src={src}
                    alt=""
                    width={224}
                    height={224}
                    sizes="112px"
                    className="size-full object-cover"
                    onError={() => setBroken((b) => [...b, src])}
                  />
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
