import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, renderHook } from "@testing-library/react";

vi.mock("@/components/admin/admin-inbox", () => ({ unreadCount: vi.fn(async () => 3) }));

import { useFullView } from "@/components/admin/editor/use-full-view";
import { useUnread } from "@/components/admin/use-unread";
import { useEditorStaging } from "@/components/admin/editor/editor-context";
import { staging, underStaging } from "./staging";

describe("useFullView", () => {
  it("takes a column full screen and Escape brings the three back", () => {
    const { result } = renderHook(() => useFullView());
    act(() => result.current[1]("map"));
    expect(result.current[0]).toBe("map");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(result.current[0]).toBeNull();
  });
});

describe("useUnread", () => {
  it("asks for the unread count on mount", async () => {
    const { result } = renderHook(() => useUnread());
    await vi.waitFor(() => expect(result.current[0]).toBe(3));
  });
});

describe("useEditorStaging", () => {
  it("reads what the editor provides", () => {
    const value = staging();
    const { result } = renderHook(() => useEditorStaging(), { wrapper: underStaging(value) });
    expect(result.current).toBe(value);
  });

  it("refuses to run outside the editor", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useEditorStaging())).toThrow(/EditorStagingProvider/);
  });
});
