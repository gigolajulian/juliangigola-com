import { describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TemplatesDesk } from "@/components/leads/setup-panels";
import { deskCall } from "@/lib/leads/lead-desk";

vi.mock("@/lib/leads/lead-desk", async (actual) => ({ ...(await actual<typeof import("@/lib/leads/lead-desk")>()), deskCall: vi.fn() }));
// The desk fetch, faked per test.
const call = deskCall as unknown as Mock;

describe("TemplatesDesk", () => {
  it("saves the edited list with a PUT to /templates", async () => {
    call.mockImplementation(async (o: { body?: string }) => JSON.parse(o.body!));
    const saved = vi.fn();
    render(<TemplatesDesk templates={[]} saved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a template" }));
    fireEvent.click(screen.getByRole("button", { name: "Save templates" }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(saved.mock.calls[0][0][0]).toMatchObject({ name: "New template" });
    expect(call.mock.calls[0][0]).toMatchObject({ path: "/templates", method: "PUT" });
  });

  it("shows why the list did not load", () => {
    render(<TemplatesDesk templates={[]} saved={() => {}} error="Templates did not load. Saving now would replace them." />);
    expect(screen.getByText("Templates did not load. Saving now would replace them.")).toBeTruthy();
  });
});
