import { describe, expect, it } from "vitest";
import { GRIDWALL, gridwallFor, gridwallScreen, wallFill } from "@/lib/proofs/gridwall";

/* The proof gate wall: a window takes the tuned values of the nearest screen by shape (lib/proofs/gridwall.ts). */

describe("gridwall", () => {
  it("matches each tuned screen to itself", () => {
    expect(gridwallScreen(390, 844)).toBe("phone-portrait");
    expect(gridwallScreen(844, 390)).toBe("phone-landscape");
    expect(gridwallScreen(820, 1180)).toBe("ipad-portrait");
    expect(gridwallScreen(1180, 820)).toBe("ipad-landscape");
    expect(gridwallScreen(1440, 900)).toBe("laptop-16x10");
    expect(gridwallScreen(1920, 1080)).toBe("1080p-16x9");
    expect(gridwallScreen(2560, 1080)).toBe("ultrawide-21x9");
    expect(gridwallScreen(5120, 1440)).toBe("superwide-32x9");
  });

  it("takes the nearest shape for a size in between, its shift scaled to the window", () => {
    expect(gridwallScreen(2560, 1440)).toBe("1080p-16x9");
    expect(gridwallScreen(3440, 1440)).toBe("ultrawide-21x9");
    expect(gridwallFor(2880, 1800)).toMatchObject({ scale: 1.4, x: -314 });
  });

  it("runs the wall wider only on wide screens", () => {
    expect(wallFill(1440, 900)).toBe(1.5);
    expect(wallFill(5120, 1440)).toBeCloseTo(2.67, 2);
  });

  it("grows the card past a laptop, but never the square phone portrait card", () => {
    expect(gridwallFor(1440, 900)).toMatchObject({ card: GRIDWALL.card, cardRadius: GRIDWALL.cardRadius });
    expect(gridwallFor(5120, 1440).card).toBeCloseTo(GRIDWALL.card * 1.6, 3);
    expect(gridwallFor(390, 844)).toMatchObject({ card: 1.04, cardRadius: 0 });
  });
});
