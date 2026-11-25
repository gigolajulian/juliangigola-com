import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeliveryGallery } from "@/components/proofs/delivery";
import type { PublicDelivery } from "@/lib/proofs/proof-model";

/* `components/proofs/delivery.tsx`: the client's finished photos. These
   cover the split gate (`?proofwall=0`): any email opens it, each download
   is logged under it, and models get their own view and zip. */

const final = (id: string, over: Partial<PublicDelivery["finals"][number]> = {}) => ({
  id,
  file: `${id}.jpg`,
  w: 1200,
  h: 1800,
  bytes: 4e6,
  v: 7,
  model: null,
  top: false,
  ...over,
});
const delivery = (over: Partial<PublicDelivery> = {}): PublicDelivery => ({
  finals: [final("a"), final("b"), final("c")],
  cover: "b",
  closesAt: null,
  subhead: null,
  labels: false,
  ...over,
});

const fetchMock = vi.fn(async () => new Response("{}"));
const bodies = () =>
  (fetchMock.mock.calls as unknown as [string, RequestInit][]).map(([url, init]) => [url, JSON.parse(init.body as string)]);

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/?proofwall=0");
  vi.stubGlobal("fetch", fetchMock);
  // jsdom does not navigate; the click still logs and marks the download.
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockClear();
  history.replaceState(null, "", "/");
});

const enter = (email = "a@b.co") => {
  fireEvent.change(screen.getByLabelText("Your email"), { target: { value: email } });
  fireEvent.submit(screen.getByRole("button", { name: "Open photos" }).closest("form")!);
};

describe("DeliveryGallery", () => {
  it("the gate shows the cover final and refuses an address that is not an email", () => {
    const { container } = render(<DeliveryGallery id="d1" initial={delivery()} />);
    expect(container.querySelector(".dlv-photo img")?.getAttribute("src")).toBe("/delivery/d1/f/b?v=7");
    enter("nope");
    expect(screen.getByRole("alert").textContent).toBe("That email does not look right.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("an email opens the finals and logs the open under it", async () => {
    render(<DeliveryGallery id="d1" initial={delivery()} />);
    enter(" a@b.co ");
    expect(await screen.findByRole("button", { name: "Download all · 12 MB" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Open photo/ })).toHaveLength(3);
    expect(bodies()).toEqual([["/api/proof/d1/track", { email: "a@b.co", kind: "open" }]]);
  });

  it("Download all is logged, then reads Downloaded and stays so in this browser", async () => {
    render(<DeliveryGallery id="d1" initial={delivery()} />);
    enter();
    fireEvent.click(await screen.findByRole("button", { name: "Download all · 12 MB" }));
    expect(bodies()[1]).toEqual(["/api/proof/d1/track", { email: "a@b.co", kind: "download", id: "all" }]);
    expect(screen.getByRole("button", { name: /^Downloaded · / })).toBeTruthy();
    expect(Object.keys(JSON.parse(localStorage.getItem("dlv-done:d1:a@b.co")!))).toEqual(["all"]);
  });

  it("the lightbox steps with the arrows, saves one photo, and closes on Escape", async () => {
    render(<DeliveryGallery id="d1" initial={delivery()} />);
    enter();
    fireEvent.click(await screen.findByRole("button", { name: "Open photo 1" }));
    expect(screen.getByRole("dialog", { name: "Photo 1" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("dialog", { name: "Photo 3" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(bodies().at(-1)).toEqual(["/api/proof/d1/track", { email: "a@b.co", kind: "download", id: "c" }]);
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("finals with models open on By model, and a model has its own photos and zip", async () => {
    const finals = [final("a", { model: "M10" }), final("b", { model: "M2" }), final("c", { model: "M2", top: true })];
    render(<DeliveryGallery id="d1" initial={delivery({ finals })} />);
    enter();
    const models = await screen.findAllByRole("button", { name: /^Open model/ });
    // Lightroom's order: 2 before 10.
    expect(models.map((b) => b.getAttribute("aria-label"))).toEqual(["Open model 2", "Open model 10"]);
    fireEvent.click(models[0]);
    expect(screen.getByRole("heading", { name: "SUBJECT2" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Open photo/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Download zip · 8 MB" }));
    expect(bodies().at(-1)).toEqual(["/api/proof/d1/track", { email: "a@b.co", kind: "download", id: "M2" }]);
    fireEvent.click(screen.getByRole("button", { name: "ALL PHOTOS" }));
    expect(screen.getAllByRole("button", { name: /^Open photo/ })).toHaveLength(3);
  });
});
