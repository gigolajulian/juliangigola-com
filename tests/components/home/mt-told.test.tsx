import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/lib/leads/enquiry-action", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.reject(new Error("offline"))),
);

import { Home } from "@/components/home/home";
import { tell } from "@/components/home/motion/engine";
import { HOME_DATA } from "@/lib/home/server";

/* The drivers tell the screens what to show (motion/engine.ts `tell`); React renders it in the same call. */
describe("motion drivers tell, React renders", () => {
  it("Commissions: the head names the frame it is told", () => {
    const { container } = render(<Home data={HOME_DATA} />);
    const s = container.querySelector<HTMLElement>('[data-mt="comm"]')!;
    const head = () => ["[data-mt-count]", ".mt-cur [data-mt-name]", ".mt-cur .mute"].map((x) => s.querySelector(x)!.textContent);
    expect(head()).toEqual(["01", HOME_DATA.commissions[0].name, HOME_DATA.commissions[0].meta]);
    tell(s, { cur: 2 });
    expect(s.dataset.cur).toBe("2");
    expect(head()).toEqual(["03", HOME_DATA.commissions[2].name, HOME_DATA.commissions[2].meta]);
  });
});
