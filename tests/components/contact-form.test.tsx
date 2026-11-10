import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const submitEnquiry = vi.hoisted(() => vi.fn());
vi.mock("@/app/contact/actions", () => ({ submitEnquiry }));
// ReferencePicks needs DataTransfer and element scrollTo, which jsdom lacks.
vi.mock("@/components/reference-picks", () => ({ ReferencePicks: () => null }));
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("no network"))));

import { ContactForm, FOLLOW_UP, INITIAL, TYPES, WhenBooking, fit, submitOrKeep } from "@/components/contact-form";

describe("ContactForm", () => {
  it("renders the fields and a send button that is not ready yet", () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/^Name/)).toBeTruthy();
    expect(screen.getByLabelText(/^Email/).getAttribute("type")).toBe("email");
    expect(screen.getByLabelText(/^About the project/).tagName).toBe("TEXTAREA");
    expect(screen.getByRole("button", { name: /Inquire/ }).getAttribute("aria-disabled")).toBe("true");
  });

  it("every type has a follow-up question or falls back to other", () => {
    for (const t of TYPES) expect(FOLLOW_UP[t.value] ?? FOLLOW_UP.other).toBeTruthy();
  });

  it("keeps the fields and offers mail when the request throws", async () => {
    submitEnquiry.mockRejectedValueOnce(new Error("offline"));
    const data = new FormData();
    data.set("type", "music");
    data.set("name", "Ana");
    data.set("email", "ana@example.com");
    data.set("message", "A cover");
    const out = await submitOrKeep(INITIAL, data);
    expect(out.status).toBe("error");
    expect(out.values?.name).toBe("Ana");
    expect(out.mailto).toMatch(/^mailto:contact@juliangigola\.com\?subject=music%20inquiry%20from%20Ana/);
  });

  it("WhenBooking shows its children off a plain link", () => {
    render(
      <WhenBooking booking={<p>booking</p>}>
        <p>contact</p>
      </WhenBooking>,
    );
    expect(screen.getByText("contact")).toBeTruthy();
  });

  it("fit ignores null", () => {
    expect(() => fit(null)).not.toThrow();
  });
});
