"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { MtRange as Range } from "./data";
import { Cycle } from "@/components/v3/pf-cycle";
import { usePf, lite } from "@/lib/pf";

/* `?pf=range` (lib/pf.ts), after Motion: the range of the work as one grid, a cell a discipline,
   each stepping through its covers (Julian, 2026-11-19, from a reference's index view). Nothing renders without the flag. */
const SIZES = "(max-width: 599px) 50vw, (max-width: 1023px) 25vw, 14vw";

export function MtRange({ range }: { range: Range[] }) {
  const on = usePf("range");
  const [still, setStill] = React.useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setStill(lite()), []);
  if (!on || !range.length) return null;
  return (
    <section className="mt-range" aria-labelledby="mt-range-t">
      <div className="mt-rowhead">
        <h2 id="mt-range-t">Range</h2>
        <p className="lbl mute">Every discipline</p>
        <Link className="btn mt-sm" href="/portfolio">See the work</Link>
      </div>
      <ul className="mt-rg">
        {range.map((r) => (
          <li key={r.href}>
            <Link href={r.href}>
              <span className="ph">
                <Image src={r.srcs[0]} alt="" fill sizes={SIZES} />
                {still ? null : <Cycle srcs={r.srcs.slice(1)} sizes={SIZES} ms={1200} />}
              </span>
              <span className="lbl mt-rg-n">{r.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
