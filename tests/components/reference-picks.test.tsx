import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReferencePicks } from "@/components/reference-picks";

beforeAll(() => {
  // jsdom has no DataTransfer, no modal dialogs and no element scrollTo.
  // FileList cannot be built in jsdom: an empty file input lends a real one.
  class DT {
    items = { add() {} };
    files = Object.assign(document.createElement("input"), { type: "file" }).files;
  }
  vi.stubGlobal("DataTransfer", DT);
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  Element.prototype.scrollTo ??= () => {};
});

const fetchMock = vi.fn(async () => new Response("[]"));
beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => fetchMock.mockClear());

describe("ReferencePicks", () => {
  it("offers upload and pick, with the picks field empty", () => {
    const { container } = render(<ReferencePicks resync={null} />);
    expect(screen.getByText("Upload references")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pick from my work" })).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>('input[name="picks"]')!.value).toBe("");
  });

  it("fetches the frames only once the panel opens", () => {
    render(<ReferencePicks resync={null} v3 />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Pick from my work" }));
    expect(fetchMock).toHaveBeenCalledWith("/picks.json");
  });
});
