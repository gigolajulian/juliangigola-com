import { beforeEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { VisitTrail, trailContext } from "@/components/visit-trail";

beforeEach(() => sessionStorage.clear());

describe("VisitTrail", () => {
  it("renders nothing and notes the landing and the trail", () => {
    const { container } = render(<VisitTrail />);
    expect(container.innerHTML).toBe("");
    expect(JSON.parse(sessionStorage.getItem("jg-trail")!)).toEqual(["/"]);
    expect(JSON.parse(sessionStorage.getItem("jg-landing")!).path).toBe("/");
  });

  it("trailContext carries the trail and the device", () => {
    render(<VisitTrail />);
    const ctx = JSON.parse(trailContext());
    expect(ctx.trail).toEqual(["/"]);
    expect(ctx.device).toBe("desktop");
  });
});
