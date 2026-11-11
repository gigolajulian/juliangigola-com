import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ManageBooking } from "@/components/booking/manage-booking";
import { lockOp, clientView, type BookingRecord } from "@/lib/booking/booking-engine";
import { tokenOpens } from "@/lib/booking/booking-token";

/* A client's booking, opened from the links in their "You're in." mail
   (`lib/booking/booking-token.ts`). Nothing shows without the token. */

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };

const Note = ({ children }: { children: React.ReactNode }) => (
  <section className="v3 mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-3 px-4 py-24">
    <span className="lbl mute">Your booking</span>
    <p>{children}</p>
  </section>
);

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; do?: string }> }) {
  const [{ id }, { t, do: open }] = await Promise.all([params, searchParams]);
  const { env } = await getCloudflareContext({ async: true });
  if (!(await tokenOpens(env.BOOKING_SECRET, id, t))) return <Note>This link has expired. Reply to your confirmation email and I&apos;ll sort it out.</Note>;
  let record: BookingRecord | null = null;
  try {
    ({ record } = await lockOp(env, "get", id));
  } catch {
    return <Note>Your booking did not load. Try again in a minute, or reply to your confirmation email.</Note>;
  }
  if (!record) return <Note>No such booking. Reply to your confirmation email and I&apos;ll sort it out.</Note>;
  return <ManageBooking booking={clientView(record)} token={t!} open={open} />;
}
