import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewLeadAstryx, sameAs } from "@/components/leads/new-lead-astryx";
import type { Call } from "@/lib/leads/lead-desk";
import type { LeadSummary } from "@/lib/leads/leads";

const iso = new Date().toISOString();
const on = (email: string, name = "Someone") => ({ id: email, email, name, stage: "Inquiry", stageAt: iso, firstAt: iso, lastAt: iso }) as LeadSummary;
const blank = { name: "", email: "", ig: "", phone: "" };

describe("sameAs", () => {
  it("finds the same person by email, handle, phone or full name, and nothing else", () => {
    const leads = [on("ana@x.com"), on("ig:noor.adler"), on("tel:+14085550142"), on("b@y.com", "Mara Voss")];
    expect(sameAs(leads, { ...blank, email: "ANA@x.com " })?.id).toBe("ana@x.com");
    expect(sameAs(leads, { ...blank, ig: "@Noor.Adler" })?.id).toBe("ig:noor.adler");
    expect(sameAs(leads, { ...blank, phone: "+1 (408) 555-0142" })?.id).toBe("tel:+14085550142");
    expect(sameAs(leads, { ...blank, name: "mara voss" })?.id).toBe("b@y.com");
    expect(sameAs(leads, { ...blank, name: "Ma", phone: "555" })).toBeUndefined();
  });
});

describe("NewLeadAstryx", () => {
  it("adds only with a name and a way back, through the classic POST", async () => {
    const call = vi.fn(async () => ({ id: "n1", lead: { email: "ig:ana" } })) as unknown as Call & ReturnType<typeof vi.fn>;
    const done = vi.fn();
    render(<NewLeadAstryx call={call} leads={[]} size="wide" done={done} open={() => {}} cancel={() => {}} />);
    const add = screen.getByRole("button", { name: "Add lead" });
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Ana" } });
    expect(add.getAttribute("aria-disabled") === "true" || (add as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Instagram/), { target: { value: "@ana" } });
    fireEvent.click(add);
    await waitFor(() => expect(done).toHaveBeenCalledWith("n1", { email: "ig:ana" }));
    expect(JSON.parse(String(call.mock.calls[0][0].body)).add).toMatchObject({ name: "Ana", ig: "@ana", stage: "Inquiry", source: "Instagram DM" });
  });
});
