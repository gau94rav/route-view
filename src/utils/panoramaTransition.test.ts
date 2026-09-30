import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  animatePanoramaCamera,
  shouldAnimatePanorama,
} from "./panoramaTransition";
import type { PanoramaStep } from "../types";
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: (time: number) => void) =>
    setTimeout(() => callback(Date.now()), 16),
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
function camera() {
  let pov = { heading: 359, pitch: 3 },
    zoom = 1.4;
  return {
    getPov: () => pov,
    getZoom: () => zoom,
    setPov: vi.fn((value: google.maps.StreetViewPov) => {
      pov = value;
    }),
    setZoom: vi.fn((value: number) => {
      zoom = value;
    }),
  };
}
const step = (id: string, lng: number): PanoramaStep => ({
  id,
  position: { lat: 0, lng },
  sampleIndex: 0,
  heading: 90,
  description: "Test",
});
describe("panorama camera transitions", () => {
  it("eases zoom and takes the shortest heading rotation across north", async () => {
    const view = camera();
    const motion = animatePanoramaCamera(
      view,
      { heading: 1, pitch: 0, zoom: 1.68 },
      340,
    );
    await vi.advanceTimersByTimeAsync(180);
    expect(view.getZoom()).toBeGreaterThan(1.4);
    expect(view.getZoom()).toBeLessThan(1.68);
    expect(
      Math.min(view.getPov().heading, 360 - view.getPov().heading),
    ).toBeLessThan(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(await motion.finished).toBe(true);
    expect(view.getPov()).toEqual({ heading: 1, pitch: 0 });
    expect(view.getZoom()).toBeCloseTo(1.68);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("restores the user's zoom after moving into the next view", async () => {
    const view = camera(),
      baseZoom = view.getZoom();
    const outgoing = animatePanoramaCamera(
      view,
      { heading: 90, pitch: 0, zoom: baseZoom + 0.28 },
      340,
    );
    await vi.advanceTimersByTimeAsync(400);
    expect(await outgoing.finished).toBe(true);
    const incoming = animatePanoramaCamera(
      view,
      { heading: 90, pitch: 0, zoom: baseZoom },
      480,
    );
    await vi.advanceTimersByTimeAsync(550);
    expect(await incoming.finished).toBe(true);
    expect(view.getZoom()).toBeCloseTo(baseZoom);
  });
  it("cancels stale animation without further camera updates", async () => {
    const view = camera();
    const motion = animatePanoramaCamera(
      view,
      { heading: 90, pitch: 0, zoom: 1.68 },
      340,
    );
    await vi.advanceTimersByTimeAsync(100);
    motion.cancel();
    const calls = view.setZoom.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(await motion.finished).toBe(false);
    expect(view.setZoom).toHaveBeenCalledTimes(calls);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("animates nearby navigation but skips large jumps, retries, and reduced motion", () => {
    const from = step("a", 0),
      nearby = step("b", 0.00045),
      far = step("c", 0.004);
    expect(shouldAnimatePanorama(from, nearby, false)).toBe(true);
    expect(shouldAnimatePanorama(from, far, false)).toBe(false);
    expect(shouldAnimatePanorama(null, nearby, false)).toBe(false);
    expect(shouldAnimatePanorama(from, from, false)).toBe(false);
    expect(shouldAnimatePanorama(from, nearby, true)).toBe(false);
  });
});
