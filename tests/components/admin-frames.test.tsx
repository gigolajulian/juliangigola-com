import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminFrames } from "@/components/admin/admin-frames";

const original = ["/work/x/01.jpg", "/work/x/02.jpg"];

describe("AdminFrames", () => {
  it("renders each frame with its controls", () => {
    render(
      <AdminFrames slug="x" original={original} frames={null} uploads={{}} onChange={() => {}} onUpload={() => {}} />,
    );
    expect(screen.getByLabelText("Remove item 2")).toBeTruthy();
    expect(screen.getByText("Add photographs")).toBeTruthy();
    // Undo only shows once the draft differs from the original.
    expect(screen.queryByText("Undo changes")).toBeNull();
  });

  it("removing a frame reports the new sequence", () => {
    const onChange = vi.fn();
    render(
      <AdminFrames slug="x" original={original} frames={null} uploads={{}} onChange={onChange} onUpload={() => {}} />,
    );
    fireEvent.click(screen.getByLabelText("Remove item 1"));
    expect(onChange).toHaveBeenCalledWith(["/work/x/02.jpg"]);
  });

  it("offers undo for an edited sequence", () => {
    const onChange = vi.fn();
    render(
      <AdminFrames
        slug="x"
        original={original}
        frames={["/work/x/02.jpg"]}
        uploads={{}}
        onChange={onChange}
        onUpload={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Undo changes"));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
