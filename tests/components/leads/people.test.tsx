import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { People } from "@/components/leads/people";
import type { Person } from "@/lib/leads/leads";

describe("People", () => {
  const ana: Person = { name: "Ana Ruiz", email: "ana@studio.com", role: "Art director", phone: "408 555 0100" };

  it("adds a person and sends the whole list up", async () => {
    const onSave = vi.fn(async (_: Person[]) => {});
    render(<People people={[ana]} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a person" }));
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "bo@studio.com" } });
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Bo" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toEqual([ana, { name: "Bo", email: "bo@studio.com", role: "", phone: "" }]);
  });

  it("removes a person and shows why a save failed", async () => {
    const onSave = vi.fn(async (_: Person[]) => { throw new Error("KV down"); });
    render(<People people={[ana]} onSave={onSave} />);
    expect(screen.getByText("ana@studio.com · 408 555 0100")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onSave.mock.calls[0][0]).toEqual([]);
    expect((await screen.findByRole("alert")).textContent).toBe("KV down");
  });
});
