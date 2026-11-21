import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AsideDesk, LicencesDesk } from "@/components/leads/lists";
import type { Call } from "@/lib/leads/lead-desk";
import { iso, lead } from "./leads-fixtures";

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
