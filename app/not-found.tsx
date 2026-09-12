import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[100rem] flex-col justify-center px-6 py-28 sm:px-10">
      <p className="label text-muted-foreground">404</p>
      <h1 className="mt-6 max-w-[24ch] title">That page isn&rsquo;t here.</h1>
      <p className="mt-6 max-w-prose text-sm leading-relaxed text-muted-foreground">
        The site moved recently. If you followed an old link, the work it
        pointed at is almost certainly still here &mdash; it just lives under
        Work now.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          href="/work"
          className="label border border-foreground bg-foreground px-6 py-4 text-background press active:scale-[0.98]"
        >
          Browse the work
        </Link>
        <Link
          href="/"
          className="label border border-border px-6 py-4 press hoverable:hover:bg-card active:scale-[0.98]"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
