import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LdJson } from "@/components/local-screens";

describe("LdJson", () => {
  it("inlines the graph as a JSON-LD script", () => {
    const { container } = render(<LdJson data={{ "@type": "Person", name: "Julian" }} />);
    const s = container.querySelector('script[type="application/ld+json"]')!;
    expect(JSON.parse(s.innerHTML)).toMatchObject({ "@type": "Person", name: "Julian" });
  });
});
