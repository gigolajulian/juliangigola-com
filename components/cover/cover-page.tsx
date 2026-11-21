"use client";

import * as React from "react";
import Link from "next/link";
import { BackLink } from "@/components/site/back-link";
import { CoverArtGallery } from "@/components/cover/cover-art-gallery";
import type { CoverRelease } from "@/lib/work/cover-art-types";

/* Cover art in the site's system (inner pages plan, c1): the page title with the count under it,
   the home's sleeves as the grid, the project pages' ask. */
export function CoverPage({ releases, onwards }: { releases: CoverRelease[]; onwards?: { href: string; name: string } }) {
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
          {/* The same ask as a project page (components/portfolio/project.tsx), tagged so the form opens on Cover art. */}
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
