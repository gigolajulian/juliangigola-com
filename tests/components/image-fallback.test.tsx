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

  it("a preview's picture from the live zone falls back to this origin's file", () => {
    render(<ImageFallback />);
    const img = document.createElement("img");
    img.src = "https://juliangigola.com/cdn-cgi/image/width=640,quality=78,format=auto/work/nyx/01.jpg";
    document.body.append(img);
    img.dispatchEvent(new Event("error"));
    expect(img.src).toBe(`${location.origin}/work/nyx/01.jpg`);
    img.remove();
  });
});
