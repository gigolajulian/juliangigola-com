import * as React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Motion-heavy (Lenis, rAF, the deck): this only checks it mounts and labels its scroller.
vi.mock("lenis", () => ({
  default: class {
    on() {}
    raf() {}
    scrollTo() {}
    stop() {}
    start() {}
    destroy() {}
  },
}));

import { Strip, StripView } from "@/components/strip";

beforeAll(() => {
  Element.prototype.animate ??= (() => ({ cancel() {}, finished: Promise.resolve(), onfinish: null })) as never;
  Element.prototype.scrollTo ??= () => {};
});

describe("Strip", () => {
  it("mounts its cells in a labelled region", () => {
    render(
      <Strip label="Selected work">
        <div data-tick="">One</div>
        <div data-tick="">Two</div>
      </Strip>,
    );
    expect(screen.getByRole("region", { name: "Selected work" })).toBeTruthy();
    expect(screen.getByText("One")).toBeTruthy();
    expect(screen.getByText("Two")).toBeTruthy();
  });

  it("defaults the view to strip", () => {
    const View = () => <p>{React.useContext(StripView)}</p>;
    render(<View />);
    expect(screen.getByText("strip")).toBeTruthy();
  });
});
