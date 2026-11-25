import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();
const submitEnquiry = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/leads/enquiry-action", () => ({ submitEnquiry: (...a: unknown[]) => submitEnquiry(...a) }));

import { InquiryCard } from "@/components/home/inquiry-card";

/* The v4 home's quick note is the lead path: what it files a lead under, what it refuses to send,
   and where a music video goes instead. */
const open = (at: Parameters<typeof InquiryCard>[0]["open"]) =>
  render(<InquiryCard open={at} reply={null} onClose={() => {}} onBack={() => {}} />);
const hidden = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value;
const submit = () => fireEvent.submit(document.querySelector("form")!);

describe("v4 inquiry card", () => {
  // the card keeps its draft for the visit (mt-inq-draft); each test starts with none
  beforeEach(() => sessionStorage.clear());
  it("from the footer it is a plain note filed as other", () => {
    open({ from: "footer" });
    expect(screen.getByText("Contact me")).toBeTruthy();
    expect(hidden("type")).toBe("other");
    expect(hidden("detail")).toBeUndefined();
  });

  it("files a quote under the picked chip's shoot type", () => {
    open({ from: "quote", opt: "music" });
    expect(hidden("type")).toBe("coverart"); // the first chip is picked
    expect(hidden("detail")).toBe("Music: Cover art");
    fireEvent.click(screen.getByRole("button", { name: "Artist presskit" }));
    expect(hidden("type")).toBe("presskit");
    fireEvent.change(document.getElementById("mq-when")!, { target: { value: " June " } });
    expect(hidden("detail")).toBe("Music: Artist presskit · When: June");
  });

  it("files fashion, which has no chips, as editorial", () => {
    open({ from: "quote", opt: "fashion" });
    expect(hidden("type")).toBe("editorial");
    expect(hidden("detail")).toBe("Fashion");
  });

  it("does not send an empty note and says what is missing", () => {
    open({ from: "footer" });
    submit();
    expect(submitEnquiry).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").length).toBe(3); // name, email, message
    expect(document.activeElement?.id).toBe("mq-name");
    // typing in a field takes its error line away
    fireEvent.change(document.getElementById("mq-name")!, { target: { value: "Ana" } });
    expect(screen.getAllByRole("alert").length).toBe(2);
  });

  it("sends a music video to the call booking instead of the form", () => {
    open({ from: "quote", opt: "music" });
    fireEvent.click(screen.getByRole("button", { name: "Music video" }));
    expect(document.getElementById("mq-name")).toBeNull(); // the fields give way to the call note
    submit();
    expect(push).toHaveBeenCalledWith("/book/music-photography");
    expect(submitEnquiry).not.toHaveBeenCalled();
  });
});
