import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { ProofWall } from "@/components/proofs/wall";

/* `components/proofs/wall.tsx`: the gate over the drifting wall. A client
   gives a name and an email, Open proofs hands them up trimmed, and the wall
   hands over to the gallery. jsdom lays nothing out, so the wall is never
   measured and Open takes the fade (`reveal`), which is still the real path. */

const frames = [{ src: "/p/a.jpg", w: 1200, h: 1800 }];
const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

function Gate(props: {
  onAccept: (n: string, e: string) => void;
  onDone: () => void;
  words?: { lab: string; title: string; cta: string; note: string };
}) {
  const grid = React.useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={grid} />
      <ProofWall frames={frames} grid={grid} isEmail={isEmail} {...props} />
    </>
  );
}

beforeEach(() => {
  // jsdom has no Web Animations: each animation finishes at once.
  Element.prototype.animate = function () {
    return { finished: Promise.resolve() } as unknown as Animation;
  };
});
afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.style.overflow = "";
});

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.submit(screen.getByRole("button", { name: "Open proofs" }).closest("form")!);

describe("ProofWall", () => {
  it("shows the proof gate's own words and holds the page still", () => {
    render(<Gate onAccept={() => {}} onDone={() => {}} />);
    expect(screen.getByRole("heading", { name: "Pick your proofs." })).toBeTruthy();
    expect(screen.getByText("Proofs · 1 frames")).toBeTruthy();
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("asks for a name, then a real email, before opening", () => {
    const onAccept = vi.fn();
    render(<Gate onAccept={onAccept} onDone={() => {}} />);
    submit();
    expect(screen.getByRole("alert").textContent).toBe("Add your name.");
    expect(screen.getByLabelText("Your name").getAttribute("aria-invalid")).toBe("true");
    type("Your name", "Maya");
    expect(screen.queryByRole("alert")).toBeNull();
    type("Your email", "nope");
    submit();
    expect(screen.getByRole("alert").textContent).toBe("That email does not look right.");
    expect(screen.getByLabelText("Your email").getAttribute("aria-invalid")).toBe("true");
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("Open proofs hands up the name and email trimmed, then hands over to the gallery", async () => {
    const onAccept = vi.fn();
    const onDone = vi.fn();
    render(<Gate onAccept={onAccept} onDone={onDone} />);
    type("Your name", "  Maya   Ross ");
    type("Your email", " a@b.co ");
    expect(screen.getByRole("button", { name: "Open proofs" }).hasAttribute("data-off")).toBe(false);
    submit();
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(onAccept).toHaveBeenCalledWith("Maya Ross", "a@b.co");
  });

  it("the delivery passes its own words", () => {
    render(
      <Gate
        onAccept={() => {}}
        onDone={() => {}}
        words={{ lab: "Finals · 3 photos", title: "Your photos.", cta: "Open photos", note: "The link closes Dec 1." }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Your photos." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open photos" })).toBeTruthy();
    expect(screen.getByText("The link closes Dec 1.")).toBeTruthy();
  });
});
