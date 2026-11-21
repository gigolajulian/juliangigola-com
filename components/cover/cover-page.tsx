"use client";

import * as React from "react";
import Link from "next/link";
import { BackLink } from "@/components/site/back-link";
import { CoverArtGallery } from "@/components/cover/cover-art-gallery";
import type { CoverRelease } from "@/lib/work/cover-art-types";
import { useV4pages } from "@/lib/flags/v4pages";

/* Cover art in the site's system (inner pages plan, c1), behind `?v4pages`: the page title with the
   count under it as it is live, the home's sleeves as the grid, the project pages' ask. `off` is the page as it
   is live, shown until the flag is read. */
export function CoverPage({ off, releases, onwards }: { off: React.ReactNode; releases: CoverRelease[]; onwards?: { href: string; name: string } }) {
  if (!useV4pages("c1")) return off;
  return (
    <div className="v3 contents">
      <article className="cv4p">
        <header className="cv4h">
          <div>
            <BackLink className="lbl mute pj-back" />
            <h1 className="pg-t">Cover art</h1>
            <p className="lbl mute">{releases.length} releases</p>
          </div>
        </header>
        <CoverArtGallery releases={releases} v4 />
        <div className="cv4a">
          {/* The same ask as a project page (components/v3/project.tsx), tagged so the form opens on Cover art. */}
          <div className="pj-ask">
            <div>
              <h2>Want something like this?</h2>
              <p className="mute">Tell me what you have in mind and I&apos;ll come back with an approach and a quote.</p>
            </div>
            <div className="cv4b">
              <Link className="btn fill" href={`/contact/form?${new URLSearchParams({ type: "coverart", ref: "Cover art" })}`}>Inquire</Link>
              {onwards ? <Link className="btn" href={onwards.href}>{onwards.name}</Link> : null}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
