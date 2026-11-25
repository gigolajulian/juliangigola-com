import { describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import * as admin from "@/app/admin/page";
import * as leads from "@/app/admin/leads/page";
import * as leadsAstryx from "@/app/admin/leads/astryx/page";
import * as proofs from "@/app/admin/proofs/page";
import * as proofsAstryx from "@/app/admin/proofs/astryx/page";
import * as booking from "@/app/booking/[id]/page";
import * as contract from "@/app/contract/[id]/page";
import * as delivery from "@/app/delivery/[id]/page";
import * as book from "@/app/book/page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
  usePathname: () => "/",
  useRouter: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

/* The pages no stranger should find: every one is out of the index, and the
   per-person ones are rendered per request. The bodies need the Worker's
   bindings and are left to their own areas' tests. */
describe("private pages", () => {
  it.each([
    ["admin", admin.metadata, "Admin"],
    ["leads", leads.metadata, "LEADS"],
    ["proofs", proofs.metadata, "PROOFS"],
    ["booking", booking.metadata, "Your booking"],
    ["contract", contract.metadata, "Contract"],
    ["delivery", delivery.metadata, "Your photos"],
  ])("%s is titled and kept out of the index", (_, m, title) => {
    expect(m.title).toBe(title);
    expect(m.robots).toMatchObject({ index: false, follow: false });
  });

  it("renders the per-person pages per request", () => {
    for (const p of [booking, contract, delivery]) expect(p.dynamic).toBe("force-dynamic");
  });

  it("keeps a delivery's photos out of image search and the LEADS desk installable", () => {
    expect(delivery.metadata.robots).toMatchObject({ googleBot: { noimageindex: true } });
    expect(leads.metadata.appleWebApp).toMatchObject({ capable: true, title: "LEADS" });
    expect(leads.viewport).toMatchObject({ viewportFit: "cover" });
  });

  it("sends the retired Astryx desks to the desks that replaced them", () => {
    leadsAstryx.default();
    proofsAstryx.default();
    expect(vi.mocked(redirect).mock.calls).toEqual([["/admin/leads"], ["/admin/proofs"]]);
  });
});

describe("/book", () => {
  it("is the public booking page with its own canonical", () => {
    expect(book.metadata).toMatchObject({
      title: "Book a session",
      alternates: { canonical: "/book" },
      openGraph: { title: "Book a session | Julian Gigola" },
    });
  });
});
