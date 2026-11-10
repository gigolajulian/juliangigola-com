import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { Lightbox, useLightbox } from "@/components/lightbox";
import type { Frame } from "@/lib/work-types";

const frame = (n: number) => ({ src: `/work/s/0${n}.jpg`, width: 800, height: 1000, color: "#111", alt: "" }) as Frame;
const frames = [frame(1), frame(2)];

describe("lightbox", () => {
  it("useLightbox starts closed on the first frame", () => {
    const { result } = renderHook(() => useLightbox(frames));
    expect(result.current.open).toBe(false);
    expect(result.current.index).toBe(0);
  });

  it("Lightbox opens as a titled dialog and pages", () => {
    const step = vi.fn();
    const onOpenChange = vi.fn();
    render(<Lightbox frames={frames} name="Azure" open index={0} onOpenChange={onOpenChange} step={step} settled={false} />);
    expect(screen.getByRole("dialog", { name: "Azure, frame 1 of 2" })).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next frame" }));
    expect(step).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
