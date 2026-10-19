import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WITH_BTS } from "@/lib/work";
import { BtsCredit, BtsPageGrid } from "@/components/bts";

export const metadata: Metadata = {
  title: "Behind the scenes",
  description:
    "Behind the scenes on my shoots in San Francisco and the Bay Area, shoot by shoot.",
  alternates: { canonical: "/bts" },
};

const pad = (n: number) => String(n).padStart(2, "0");

/* Every shoot that has BTS, in the running order, one row each: the name
   and who shot it on the left, the frames in a grid on the right. Linked
   from the biography. Only projects with a `bts` entry in
   `content/projects.json` are here. */
export default function BtsPage() {
  if (!WITH_BTS.length) notFound();
  return (
    <article className="mx-auto max-w-[100rem] px-6 pb-24 pt-28 sm:px-10">
      <header className="flex items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="label text-muted-foreground">On set</p>
          <h1 className="title mt-3">Behind the scenes</h1>
        </div>
        <p className="label tabular-nums text-muted-foreground">
          {pad(WITH_BTS.length)} {WITH_BTS.length === 1 ? "shoot" : "shoots"}
        </p>
      </header>
      {WITH_BTS.map((p, i) => (
        <section
          key={p.slug}
          id={p.slug}
          className="grid gap-6 border-b border-border py-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10"
        >
          <div className="flex flex-col gap-3">
            <span className="label tabular-nums text-muted-foreground">
              {pad(i + 1)}
            </span>
            <h2 className="font-display text-4xl uppercase leading-[0.95] tracking-[0]">
              {p.headline ?? p.name}
            </h2>
            <BtsCredit bts={p.bts!} />
            <Link
              href={`/portfolio/${p.slug}`}
              className="label mt-2 self-start py-1.5 text-muted-foreground underline decoration-border underline-offset-4 transition-colors duration-200 hoverable:hover:text-foreground"
            >
              See the shoot &rarr;
            </Link>
          </div>
          <BtsPageGrid bts={p.bts!} name={p.name} />
        </section>
      ))}
    </article>
  );
}
