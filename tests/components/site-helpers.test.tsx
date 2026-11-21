import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { projectHref } from "@/lib/project-href";
import { THEME_COLOR } from "@/lib/theme-color";
import { V4_HOME, mtscroll } from "@/lib/v4-home/switch";
import { NAME_INK, NAME_W } from "@/lib/email/email-logo";
import { useDialKitStyles } from "@/lib/dev/dialkit-styles";
import { sleeveTilt } from "@/components/cover/sleeve-tilt";
import { JG_COVER, mountCover } from "@/components/splash/jg-cover";
import { inkGround, inkWord, navfx } from "@/components/site/nav-ink";
import * as coverSound from "@/components/cover/cover-sound";
import SOUND from "@/lib/work/cover-art-sound.json";

const styles = vi.hoisted(() => ({ loaded: 0 }));
vi.mock("dialkit/styles.css", () => (styles.loaded++, {}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  delete document.documentElement.dataset.mtscroll;
  delete document.documentElement.dataset.navfx;
  document.getElementById("jg-cover")?.remove();
  sessionStorage.clear();
  history.replaceState(null, "", "/");
});

describe("projectHref", () => {
  it("opens a project under /portfolio and a moved gallery on its booking page", () => {
    expect(projectHref("paradox")).toBe("/portfolio/paradox");
    expect(projectHref("headshots")).toBe("/headshots#work");
    expect(projectHref("graduation")).toBe("/graduation-photos#work");
  });
});

describe("THEME_COLOR", () => {
  it("is pure white and pure black", () => {
    expect(THEME_COLOR).toEqual({ light: "#ffffff", dark: "#000000" });
  });
});

describe("v4 home switch", () => {
  it("reads the trial from the root's dataset", () => {
    expect(mtscroll()).toBe(false);
    document.documentElement.dataset.mtscroll = "";
    expect(mtscroll()).toBe(true);
  });

  it("is on only when the build says NEXT_PUBLIC_V4_HOME=1", async () => {
    expect(V4_HOME).toBe(process.env.NEXT_PUBLIC_V4_HOME === "1");
    vi.stubEnv("NEXT_PUBLIC_V4_HOME", "1");
    vi.resetModules();
    expect((await import("@/lib/v4-home/switch")).V4_HOME).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_V4_HOME", "0");
    vi.resetModules();
    expect((await import("@/lib/v4-home/switch")).V4_HOME).toBe(false);
  });
});

describe("email logo", () => {
  it("is two PNGs of the same size, the name in white and in ink", () => {
    const dims = [NAME_W, NAME_INK].map((b64) => {
      const png = Buffer.from(b64, "base64");
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      return [png.readUInt32BE(16), png.readUInt32BE(20)];
    });
    expect(dims[0]).toEqual([378, 67]);
    expect(dims[1]).toEqual(dims[0]);
  });
});

describe("useDialKitStyles", () => {
  it("loads DialKit's stylesheet outside production", async () => {
    renderHook(() => useDialKitStyles());
    await vi.waitFor(() => expect(styles.loaded).toBe(1));
  });
});

describe("sleeveTilt", () => {
  const move = (el: HTMLElement, init: Record<string, unknown>) => {
    const e = new Event("pointermove");
    Object.assign(e, init);
    el.dispatchEvent(e);
  };
  const sleeve = () => {
    const el = document.createElement("div");
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
    return el;
  };

  it("lifts and tilts toward the pointer, up to 9 degrees, and settles on leave", () => {
    const el = sleeve();
    sleeveTilt(el, () => true);
    move(el, { pointerType: "mouse", clientX: 100, clientY: 0 });
    expect(el.classList.contains("hv")).toBe(true);
    expect(el.style.getPropertyValue("--ry")).toBe("9.00deg");
    expect(el.style.getPropertyValue("--rx")).toBe("9.00deg");
    move(el, { pointerType: "mouse", clientX: 50, clientY: 75 });
    expect(el.style.getPropertyValue("--ry")).toBe("0.00deg");
    expect(el.style.getPropertyValue("--rx")).toBe("-4.50deg");
    el.dispatchEvent(new Event("pointerleave"));
    expect(el.classList.contains("hv")).toBe(false);
    expect(el.style.getPropertyValue("--rx")).toBe("");
  });

  it("ignores touch and a closed gate", () => {
    const el = sleeve();
    let ok = false;
    sleeveTilt(el, () => ok);
    move(el, { pointerType: "mouse", clientX: 10, clientY: 10 });
    ok = true;
    move(el, { pointerType: "touch", clientX: 10, clientY: 10 });
    expect(el.classList.contains("hv")).toBe(false);
  });
});

describe("jg-cover", () => {
  const ctx = () =>
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect() {},
      fillText() {},
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(0, w * h * 4) || 4) }),
    } as never);

  it("puts the J and G cover over the whole screen once, and fades it after 10 seconds", () => {
    ctx();
    vi.useFakeTimers();
    mountCover();
    mountCover();
    const covers = document.querySelectorAll("#jg-cover");
    expect(covers).toHaveLength(1);
    const d = covers[0] as HTMLElement;
    expect(d.getAttribute("aria-hidden")).toBe("true");
    expect(d.style.position).toBe("fixed");
    expect([...d.querySelectorAll(".ink text")].map((t) => t.textContent)).toEqual(["J", "G"]);
    expect(d.dataset.ox).toBeDefined();
    vi.advanceTimersByTime(10000);
    expect(d.style.opacity).toBe("0");
    vi.advanceTimersByTime(400);
    expect(d.isConnected).toBe(false);
  });

  it("stays down when another loader is asked for", () => {
    ctx();
    history.replaceState(null, "", "/?loader=orb");
    mountCover();
    expect(document.getElementById("jg-cover")).toBeNull();
  });

  it("ships the same cover as a script for the page's markup", () => {
    expect(JG_COVER).toMatch(/^\(function cover\(/);
    expect(JG_COVER).toContain("jg-cover");
  });
});

describe("nav-ink", () => {
  it("reads the trial from the root's dataset", () => {
    expect(navfx()).toBe(false);
    document.documentElement.dataset.navfx = "";
    expect(navfx()).toBe(true);
  });

  it("inks a word white over a dark page and black over a light one", () => {
    // nothing painted under the word: the page's own colour decides
    document.elementsFromPoint = () => [];
    const word = document.createElement("span");
    word.getBoundingClientRect = () => ({ left: 0, top: 10, width: 50, height: 10, bottom: 20 }) as DOMRect;
    const skip = document.createElement("div");
    inkWord(word, skip, [0, 0, 0]);
    expect(word.dataset.ink).toBe("w");
    expect(word.style.getPropertyValue("--nav-ink")).toBe("#fff");
    inkWord(word, skip, [255, 255, 255]);
    expect(word.dataset.ink).toBe("b");
    expect(word.style.getPropertyValue("--nav-ink")).toBe("#000");
    delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
  });

  it("leaves a word with no box alone, and never throws", () => {
    const word = document.createElement("span");
    expect(() => inkWord(word, word, [0, 0, 0])).not.toThrow();
    expect(word.dataset.ink).toBeUndefined();
    // jsdom draws nothing: an unreadable colour is black
    expect(inkGround("rgb(10, 20, 30)")).toEqual([0, 0, 0]);
  });
});

describe("cover-sound", () => {
  const PREVIEW = Object.entries(SOUND).find(([, c]) => "preview" in c && "link" in c)!;
  const fresh = async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.resetModules();
    return (await import("@/components/cover/cover-sound")) as typeof coverSound;
  };

  it("plays a release's preview and credits Apple beside it", async () => {
    const { CoverSound, playSound, stopSound, useSound } = await fresh();
    const now = renderHook(() => useSound());
    render(<CoverSound />);
    expect(screen.queryByRole("link")).toBeNull();
    act(() => playSound(PREVIEW[0]));
    expect(now.result.current).toBe(PREVIEW[0]);
    expect(screen.getByRole("link", { name: "Listen on Apple Music" }).getAttribute("href")).toBe((PREVIEW[1] as { link: string }).link);
    expect(screen.getByText("Preview provided courtesy of iTunes")).toBeTruthy();
    act(() => stopSound(undefined, true));
    expect(now.result.current).toBe("");
  });

  it("stays silent for a release with no clip, and once the sound is turned off", async () => {
    const { CoverSound, playSound, useSound } = await fresh();
    const now = renderHook(() => useSound());
    act(() => playSound("no-such-release"));
    expect(now.result.current).toBe("");
    render(<CoverSound className="x" />);
    const btn = screen.getByRole("button", { name: "Sound on" });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: "Sound off" }).getAttribute("aria-pressed")).toBe("false");
    expect(sessionStorage.getItem("jg-cover-snd")).toBe("0");
    act(() => playSound(PREVIEW[0]));
    expect(now.result.current).toBe("");
  });

  it("plays a SoundCloud-only song through SoundCloud's player, and links to it", async () => {
    const sc = Object.entries(SOUND).find(([, c]) => !("preview" in c) && !("clip" in c) && "soundcloud" in c);
    if (!sc) return;
    const { CoverSound, playSound } = await fresh();
    render(<CoverSound />);
    act(() => playSound(sc[0]));
    const frame = document.querySelector<HTMLIFrameElement>('iframe[title="SoundCloud player"]')!;
    expect(frame.src).toContain(`https://w.soundcloud.com/player/?url=${encodeURIComponent((sc[1] as { soundcloud: string }).soundcloud)}`);
    expect(screen.getByRole("link", { name: "Listen on SoundCloud" })).toBeTruthy();
    frame.remove();
  });
});
