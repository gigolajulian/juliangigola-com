import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/app/contact/actions", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

import { MtHome } from "@/components/v3/mt/home";
import { tell } from "@/components/v3/mt/motion/engine";
import { QUOTE_CLIENTS } from "@/components/v3/mt/data";
import { MT } from "@/lib/mt-home-data";

/* The drivers tell the screens what to show (motion/engine.ts `tell`); React renders it in the same call. */
describe("motion drivers tell, React renders", () => {
  it("By quote: the client first, the name after its fade", () => {
    const { container } = render(<MtHome data={MT} />);
    const s = container.querySelector<HTMLElement>('[data-mt="quote"]')!;
    const q = () => [".mt-photo", ".mt-photo-w"].map((f) => [...s.querySelectorAll(`${f} > .cl`)].findIndex((c) => c.hasAttribute("data-q")));
    const nm = s.querySelector(".mt-by .nm")!;
    expect(q()).toEqual([0, 0]);
    expect(s.dataset.client).toBe("0");
    tell(s, { k: 1, sw: true });
    expect(q()).toEqual([1, 1]);
    expect(s.dataset.client).toBe("1");
    expect(nm.textContent).toBe(QUOTE_CLIENTS[0].name);
    expect(nm.hasAttribute("data-sw")).toBe(true);
    tell(s, { name: 1, sw: false });
    expect(nm.textContent).toBe(QUOTE_CLIENTS[1].name);
    expect(s.querySelector(".mt-clcap")!.textContent).toBe(QUOTE_CLIENTS[1].name);
    expect(nm.hasAttribute("data-sw")).toBe(false);
  });

  it("Commissions: the head names the frame it is told", () => {
    const { container } = render(<MtHome data={MT} />);
    const s = container.querySelector<HTMLElement>('[data-mt="comm"]')!;
    const head = () => ["[data-mt-count]", ".mt-cur [data-mt-name]", ".mt-cur .mute"].map((x) => s.querySelector(x)!.textContent);
    expect(head()).toEqual(["01", MT.comm[0].name, MT.comm[0].meta]);
    tell(s, { cur: 2 });
    expect(s.dataset.cur).toBe("2");
    expect(head()).toEqual(["03", MT.comm[2].name, MT.comm[2].meta]);
  });
});
