import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AsideDesk, LicencesDesk } from "@/components/leads/lists";
import { StatsDesk } from "@/components/leads/numbers";
import { TemplatesDesk } from "@/components/leads/setup-panels";
import type { Call } from "@/lib/leads/lead-desk";
import type { LeadSummary } from "@/lib/leads/leads";

const iso = new Date().toISOString();
const lead = (id: string, extra: Partial<LeadSummary> = {}) => ({ id, email: `${id}@x.com`, name: id, stage: "Inquiry", stageAt: iso, firstAt: iso, lastAt: iso, ...extra }) as LeadSummary;

describe("LicencesDesk", () => {
  it("lists leads with a licence, soonest end first", () => {
    render(<LicencesDesk leads={[lead("Late", { licence: { use: "Web", end: "2027-06-01" } } as never), lead("None"), lead("Soon", { licence: { use: "Print", end: "2027-01-01" } } as never)]} open={() => {}} />);
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names.indexOf("Soon")).toBeLessThan(names.indexOf("Late"));
    expect(screen.queryByText("None")).toBeNull();
  });
});

describe("AsideDesk", () => {
  it("empties the trash only after the second press", async () => {
    const call = vi.fn(async () => ({})) as unknown as Call & ReturnType<typeof vi.fn>;
    const done = vi.fn();
    render(<AsideDesk leads={[lead("Gone", { trashedAt: iso })]} call={call} open={() => {}} done={done} tab="trash" setTab={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Empty trash" }));
    expect(call).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete for good" }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(JSON.parse(String(call.mock.calls[0][0].body))).toEqual({ emptyTrash: true });
  });
});

describe("StatsDesk", () => {
  it("shows the booked rate from ?stats", async () => {
    const stats = { bookedRate: 0.4, replyHours: 2, pipeline: 1800, won: 3600, weeks: [{ start: "2026-11-02", inquiries: 3, booked: 1 }], sources: [{ source: "Instagram DM", leads: 3, booked: 1 }], lost: [], stages: { Inquiry: 2 }, total: 3, repeat: 1, lifetime: 1200, top: [{ name: "Ana", sessions: 2, paid: 1200 }] };
    const call = vi.fn(async () => ({ stats })) as unknown as Call;
    render(<StatsDesk call={call} />);
    expect(await screen.findByText("40%")).toBeTruthy();
    expect(screen.getByText("Instagram DM")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
  });
});

describe("TemplatesDesk", () => {
  it("saves the edited list with the classic PATCH", async () => {
    const call = vi.fn(async (o: { body?: string }) => JSON.parse(o.body!)) as unknown as Call & ReturnType<typeof vi.fn>;
    const saved = vi.fn();
    render(<TemplatesDesk call={call} templates={[]} saved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a template" }));
    fireEvent.click(screen.getByRole("button", { name: "Save templates" }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(saved.mock.calls[0][0][0]).toMatchObject({ name: "New template" });
  });
});
