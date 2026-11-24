// jsdom lacks the browser APIs the site's components touch on mount.
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
Object.assign(globalThis, { IntersectionObserver: Observer, ResizeObserver: Observer });

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
window.scrollTo = () => {};
// The home's motion engine and the header's ink run on every client mount.
if (!document.fonts) Object.defineProperty(document, "fonts", { value: { ready: Promise.resolve() }, configurable: true });
if (!document.elementsFromPoint) document.elementsFromPoint = () => [];
HTMLCanvasElement.prototype.getContext = (() => null) as never;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect() {},
  notFound() {},
}));
