import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { ProofCursor } from "@/components/proofs/cursor";

/* `components/proofs/cursor.tsx`: over a proof grid a mouse gets the drawn
   arrow, which reads what it is over: a cell, the pick ring, a picked ring. */

const fine = (on: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({ matches: on && q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);

afterEach(() => {
  vi.restoreAllMocks();
  document.getElementById("g")?.remove();
});

describe("ProofCursor", () => {
  it("a touch screen keeps the system cursor", () => {
    fine(false);
    render(<ProofCursor />);
    expect(document.documentElement.classList.contains("proof-cur-on")).toBe(false);
  });

  it("a mouse hides the system cursor, and it comes back on unmount", () => {
    fine(true);
    const { unmount } = render(<ProofCursor />);
    expect(document.documentElement.classList.contains("proof-cur-on")).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains("proof-cur-on")).toBe(false);
  });

  it("reads a photo, then a picked ring, then off the grid", () => {
    fine(true);
    document.body.insertAdjacentHTML("beforeend", `<div id="g"><div class="proof-grid"><div class="proof-cell"><img id="ph"><button class="proof-mark" id="mk" aria-pressed="true"></button></div></div><p id="off"></p></div>`);
    const { container } = render(<ProofCursor />);
    const cur = container.querySelector(".proof-cur")!;
    fireEvent.pointerMove(document.getElementById("ph")!, { clientX: 5, clientY: 5 });
    expect(cur.hasAttribute("data-on")).toBe(true);
    expect(cur.hasAttribute("data-cell")).toBe(true);
    expect(cur.hasAttribute("data-ring")).toBe(false);
    fireEvent.pointerMove(document.getElementById("mk")!, { clientX: 6, clientY: 6 });
    expect(cur.hasAttribute("data-ring")).toBe(true);
    expect(cur.hasAttribute("data-picked")).toBe(true);
    fireEvent.pointerMove(document.getElementById("off")!, { clientX: 7, clientY: 7 });
    expect(cur.hasAttribute("data-on")).toBe(false);
    expect(cur.hasAttribute("data-cell")).toBe(false);
  });
});
