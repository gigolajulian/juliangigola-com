import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminBts } from "@/components/admin-bts";

const bts = {
  by: "crew",
  frames: [
    { src: "/work/x/bts/1.jpg", width: 100, height: 100, color: "#000", alt: "" },
    { src: "/work/x/bts/2.mp4", width: 100, height: 100, color: "#000", alt: "" },
  ],
};

describe("AdminBts", () => {
  it("counts frames and edits the handle", () => {
    const onChange = vi.fn();
    render(<AdminBts slug="x" published={bts} value={bts} uploads={{}} onChange={onChange} onUpload={() => {}} />);
    expect(screen.getByText(/02\s+frames/)).toBeTruthy();
    expect(screen.getByText(/CLIP/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("BTS by, Instagram handle"), { target: { value: "@new" } });
    expect(onChange.mock.calls[0][0].by).toBe("new");
  });

  it("removes a frame", () => {
    const onChange = vi.fn();
    render(<AdminBts slug="x" published={bts} value={bts} uploads={{}} onChange={onChange} onUpload={() => {}} />);
    fireEvent.click(screen.getByLabelText("Remove BTS 1"));
    expect(onChange).toHaveBeenCalled();
  });
});
