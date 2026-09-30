import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPanoramaReadinessGate,
  isGoogleImagery,
} from "./panoramaReadiness";
let resourceActivity: () => void;
let domActivity: () => void;
let images: {
  src: string;
  currentSrc: string;
  complete: boolean;
  naturalWidth: number;
}[];
const host = { querySelectorAll: () => images } as unknown as HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  images = [];
  vi.stubGlobal(
    "PerformanceObserver",
    class {
      constructor(
        callback: (list: { getEntries: () => { name: string }[] }) => void,
      ) {
        resourceActivity = () =>
          callback({
            getEntries: () => [
              { name: "https://streetviewpixels-pa.googleapis.com/v1/tile" },
            ],
          });
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        domActivity = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) =>
    setTimeout(callback, 16),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: ReturnType<typeof setTimeout>) =>
    clearTimeout(id),
  );
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("panorama imagery settling gate", () => {
  it("waits for panorama availability, quiet imagery activity, and painted frames", async () => {
    const ready = vi.fn(),
      failed = vi.fn();
    const gate = createPanoramaReadinessGate(host, ready, failed);
    await vi.advanceTimersByTimeAsync(5000);
    expect(ready).not.toHaveBeenCalled();
    gate.markAvailable();
    await vi.advanceTimersByTimeAsync(1000);
    resourceActivity();
    await vi.advanceTimersByTimeAsync(1000);
    domActivity();
    await vi.advanceTimersByTimeAsync(1000);
    expect(ready).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(failed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not declare readiness while an imagery image is loading", async () => {
    images = [
      {
        src: "https://lh3.googleusercontent.com/p/image",
        currentSrc: "",
        complete: false,
        naturalWidth: 0,
      },
    ];
    const ready = vi.fn();
    const gate = createPanoramaReadinessGate(host, ready, vi.fn());
    gate.markAvailable();
    await vi.advanceTimersByTimeAsync(10000);
    expect(ready).not.toHaveBeenCalled();
    images[0]!.complete = true;
    images[0]!.naturalWidth = 512;
    resourceActivity();
    await vi.advanceTimersByTimeAsync(1600);
    expect(ready).toHaveBeenCalledTimes(1);
  });
  it("fails safely on timeout and cleans up a cancelled gate", async () => {
    const ready = vi.fn(),
      failed = vi.fn();
    createPanoramaReadinessGate(host, ready, failed);
    await vi.advanceTimersByTimeAsync(60000);
    expect(failed).toHaveBeenCalledWith(
      expect.stringContaining("Playback paused"),
    );
    expect(ready).not.toHaveBeenCalled();
    const gate = createPanoramaReadinessGate(host, ready, failed);
    gate.markAvailable();
    gate.dispose();
    await vi.advanceTimersByTimeAsync(60000);
    expect(ready).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("recognizes Google imagery without matching unrelated hosts", () => {
    expect(isGoogleImagery("https://cbk0.google.com/cbk?panoid=example")).toBe(
      true,
    );
    expect(
      isGoogleImagery("https://streetviewpixels-pa.googleapis.com/v1/tile"),
    ).toBe(true);
    expect(isGoogleImagery("https://example.com/tile")).toBe(false);
    expect(isGoogleImagery("https://evilgoogleapis.com/tile")).toBe(false);
  });
});
