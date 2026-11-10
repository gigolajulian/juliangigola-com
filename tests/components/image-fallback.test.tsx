import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ImageFallback } from "@/components/image-fallback";

describe("ImageFallback", () => {
  it("swaps a blocked resized picture for the plain file, once", () => {
    const { container } = render(<ImageFallback />);
    expect(container.innerHTML).toBe("");
    const img = document.createElement("img");
    img.src = "/cdn-cgi/image/width=640,quality=78/work/nyx/01.jpg";
    document.body.append(img);
    img.dispatchEvent(new Event("error"));
    expect(new URL(img.src).pathname).toBe("/work/nyx/01.jpg");
    expect(img.dataset.plain).toBe("");
    img.remove();
  });
});
