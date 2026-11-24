import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TemplatesDesk } from "@/components/leads/setup-panels";
import type { Call } from "@/lib/leads/lead-desk";

describe("TemplatesDesk", () => {
  it("saves the edited list with a PUT to /templates", async () => {
    const call = vi.fn(async (o: { body?: string }) => JSON.parse(o.body!)) as unknown as Call & ReturnType<typeof vi.fn>;
    const saved = vi.fn();
    render(<TemplatesDesk call={call} templates={[]} saved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a template" }));
    fireEvent.click(screen.getByRole("button", { name: "Save templates" }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(saved.mock.calls[0][0][0]).toMatchObject({ name: "New template" });
    expect(call.mock.calls[0][0]).toMatchObject({ path: "/templates", method: "PUT" });
  });
});
