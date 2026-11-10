import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminCredits, creditBook, tidyCredits } from "@/components/admin-credits";

describe("AdminCredits", () => {
  it("shows the empty note and adds a row", () => {
    const onChange = vi.fn();
    render(<AdminCredits credits={[]} onChange={onChange} />);
    expect(screen.getByText(/No credits/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add credit" }));
    expect(onChange).toHaveBeenCalledWith([{ role: "", name: "", instagram: null }]);
  });

  it("renders rows and removes one", () => {
    const onChange = vi.fn();
    render(<AdminCredits credits={[{ role: "Model", name: "Ana", instagram: "ana" }]} onChange={onChange} />);
    expect((screen.getByLabelText("Name for credit 1") as HTMLInputElement).value).toBe("Ana");
    fireEvent.click(screen.getByLabelText("Remove credit 1"));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("credit helpers", () => {
  it("tidyCredits drops half rows and cleans handles", () => {
    expect(
      tidyCredits([
        { role: "Model", name: "Ana", instagram: "@Ana" },
        { role: "", name: "Bo", instagram: null },
      ]),
    ).toEqual([{ role: "Model", name: "Ana", instagram: "ana" }]);
  });

  it("creditBook keeps the newest handle", () => {
    const book = creditBook([[{ role: "Model", name: "Ana", instagram: "a1" }], [{ role: "", name: "Ana", instagram: null }]]);
    expect(book.Ana).toEqual({ instagram: "a1", role: "Model" });
  });
});
