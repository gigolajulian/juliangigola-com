import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SignPad } from "@/components/contracts/sign-pad";

/* `components/contracts/sign-pad.tsx`: a client draws a signature and the
   pad hands up SVG path data in its 600 x 200 box; Clear hands up null. */

beforeEach(() => {
  // A 300 x 100 box on screen, so screen pixels double into the pad's 600 x 200.
  SVGElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 100, right: 300, bottom: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;
  Object.assign(SVGElement.prototype, { setPointerCapture() {} });
  // jsdom's list is empty; a browser's holds at least the event itself.
  PointerEvent.prototype.getCoalescedEvents = function (this: PointerEvent) {
    return [this];
  };
});

const pad = () => screen.getByRole("img");

describe("SignPad", () => {
  it("a stroke hands up path data scaled into the box, and the label says it is signed", () => {
    const onChange = vi.fn();
    render(<SignPad onChange={onChange} />);
    expect(pad().getAttribute("aria-label")).toMatch(/^Signature box/);
    fireEvent.pointerDown(pad(), { clientX: 10, clientY: 10, button: 0, pointerId: 1 });
    fireEvent.pointerMove(pad(), { clientX: 50, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(pad(), { clientX: 100, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(pad(), { pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("M20 20 Q100 40 150 60 L200 80");
    expect(pad().getAttribute("aria-label")).toBe("Your signature");
    expect(pad().querySelectorAll("path")).toHaveLength(1);
  });

  it("a tap is a dot, and a point off the box is held to its edge", () => {
    const onChange = vi.fn();
    render(<SignPad onChange={onChange} />);
    fireEvent.pointerDown(pad(), { clientX: 400, clientY: -5, button: 0, pointerId: 1 });
    fireEvent.pointerUp(pad(), { pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith("M600 0 L600.1 0");
  });

  it("two strokes join into one mark, and Clear hands up null", () => {
    const onChange = vi.fn();
    render(<SignPad onChange={onChange} />);
    for (const x of [10, 60]) {
      fireEvent.pointerDown(pad(), { clientX: x, clientY: 10, button: 0, pointerId: 1 });
      fireEvent.pointerUp(pad(), { pointerId: 1 });
    }
    expect(onChange).toHaveBeenLastCalledWith("M20 20 L20.1 20 M120 20 L120.1 20");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(pad().querySelectorAll("path")).toHaveLength(0);
  });

  it("a right click draws nothing, and a move without a press is ignored", () => {
    const onChange = vi.fn();
    render(<SignPad onChange={onChange} />);
    fireEvent.pointerDown(pad(), { clientX: 10, clientY: 10, button: 2, pointerId: 1 });
    fireEvent.pointerMove(pad(), { clientX: 50, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(pad(), { pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    expect(pad().querySelectorAll("path")).toHaveLength(0);
  });
});
