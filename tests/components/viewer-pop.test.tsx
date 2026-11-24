import { describe, expect, it, vi } from "vitest";
import { pushHistory } from "@/components/cover/zoom";

describe("pushHistory", () => {
  it("closes the viewer on the back button, once", () => {
    const onBack = vi.fn();
    pushHistory(onBack);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("takes its own entry back off when the viewer closes another way", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const onBack = vi.fn();
    const unpush = pushHistory(onBack);
    unpush();
    expect(back).toHaveBeenCalledOnce();
    expect(onBack).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("leaves the history alone when its entry is no longer on top", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const unpush = pushHistory(() => {});
    window.history.replaceState({}, "");
    unpush();
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });
});
