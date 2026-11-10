import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { PhotoFade } from "@/components/photo-fade";

describe("PhotoFade", () => {
  it("renders nothing and marks a faded image once it loads", async () => {
    const img = document.createElement("img");
    img.setAttribute("data-fade", "");
    Object.assign(img, { decode: () => Promise.resolve() });
    document.body.append(img);
    const { container } = render(<PhotoFade />);
    expect(container.innerHTML).toBe("");
    img.dispatchEvent(new Event("load"));
    await waitFor(() => expect(img.hasAttribute("data-loaded")).toBe(true));
    img.remove();
  });
});
