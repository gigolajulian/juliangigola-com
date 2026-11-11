import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminVideos } from "@/components/admin/admin-videos";
import type { Video } from "@/lib/videos";

afterEach(() => vi.unstubAllGlobals());

const video: Video = {
  id: "youtube-dQw4w9WgXcQ",
  title: "First cut",
  provider: "youtube",
  videoId: "dQw4w9WgXcQ",
  section: "music",
};

describe("AdminVideos", () => {
  it("renders sections and the empty note", () => {
    render(<AdminVideos videos={[video]} onChange={() => {}} />);
    expect(screen.getByRole("heading", { name: "Motion" })).toBeTruthy();
    expect(screen.getByText("1 film")).toBeTruthy();
    expect(screen.getByText("Nothing here yet.")).toBeTruthy();
  });

  it("refuses a link it cannot read", () => {
    render(<AdminVideos videos={[]} onChange={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/vimeo\.com/), { target: { value: "not a link" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText(/not a YouTube or Vimeo link/)).toBeTruthy();
  });

  it("adds a YouTube link with the oEmbed title", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ title: "Fetched" }), { status: 200 })),
    );
    const onChange = vi.fn();
    render(<AdminVideos videos={[]} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/vimeo\.com/), {
      target: { value: "https://youtu.be/dQw4w9WgXcQ" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0][0]).toMatchObject({
      title: "Fetched",
      provider: "youtube",
      videoId: "dQw4w9WgXcQ",
    });
  });
});
