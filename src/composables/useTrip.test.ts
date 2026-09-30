import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { useTrip } from "./useTrip";
const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  dispose: vi.fn(),
  calculate: vi.fn(),
}));
vi.mock("../services/routeService", () => ({
  calculateRoute: mocks.calculate,
}));
vi.mock("../services/streetViewService", () => ({
  StreetViewLookup: class {
    lookup = mocks.lookup;
    dispose = mocks.dispose;
  },
}));
let scope: ReturnType<typeof effectScope>;
function makeTrip() {
  scope = effectScope();
  const trip = scope.run(() => useTrip())!;
  trip.origin.value = { id: "start", label: "Start" };
  trip.destination.value = { id: "end", label: "End" };
  return trip;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.calculate.mockResolvedValue({
    path: [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.004 },
    ],
    distance: 445,
    duration: 60,
    description: "Test road",
  });
  mocks.lookup.mockImplementation(async (index: number) => ({
    id: `p${index}`,
    position: { lat: 0, lng: index * 0.00045 },
    description: "Test view",
  }));
});
afterEach(() => {
  scope?.stop();
  vi.useRealTimers();
});
describe("trip lifecycle and playback", () => {
  it("keeps manual forward and backward navigation available while paused", async () => {
    const trip = makeTrip();
    await trip.preview();
    trip.panoramaReady(trip.current.value!);
    await trip.play();
    await vi.advanceTimersByTimeAsync(500);
    trip.pause();
    await vi.advanceTimersByTimeAsync(10000);
    expect(trip.current.value?.id).toBe("p0");
    await trip.next();
    expect(trip.current.value?.id).toBe("p1");
    trip.panoramaReady(trip.current.value!);
    trip.previous();
    expect(trip.current.value?.id).toBe("p0");
    trip.panoramaReady(trip.current.value!);
    expect(trip.isPlaying.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(trip.nextViewPosition.value).toEqual({ lat: 0, lng: 0.00045 });
  });
  it("ignores an old route's late lookahead result when pointing toward the next view", async () => {
    let finish!: (value: unknown) => void;
    let held = false;
    mocks.lookup.mockImplementation((index: number) => {
      if (index === 1 && !held) {
        held = true;
        return new Promise((resolve) => {
          finish = resolve;
        });
      }
      return Promise.resolve({
        id: `p${index}`,
        position: { lat: 0, lng: index * 0.00045 },
        description: "View",
      });
    });
    const trip = makeTrip();
    await trip.preview();
    await trip.preview();
    const expected = trip.nextViewPosition.value;
    finish({
      id: "old",
      position: { lat: 99, lng: 99 },
      description: "Old route",
    });
    await Promise.resolve();
    expect(trip.nextViewPosition.value).toEqual(expected);
    expect(trip.nextViewPosition.value).toEqual({ lat: 0, lng: 0.00045 });
  });

  it("waits for imagery readiness, then advances after exactly one second", async () => {
    const trip = makeTrip();
    await trip.preview();
    await trip.play();
    await vi.advanceTimersByTimeAsync(30000);
    expect(trip.current.value?.id).toBe("p0");
    expect(vi.getTimerCount()).toBe(0);
    trip.panoramaReady(trip.current.value!);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(trip.current.value?.id).toBe("p0");
    await vi.advanceTimersByTimeAsync(1);
    expect(trip.current.value?.id).toBe("p1");
    await vi.advanceTimersByTimeAsync(30000);
    expect(trip.current.value?.id).toBe("p1");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores stale readiness and pauses on a rendering failure", async () => {
    const trip = makeTrip();
    await trip.preview();
    const oldStep = trip.current.value!;
    trip.panoramaReady(oldStep);
    await trip.next();
    await trip.play();
    trip.panoramaReady(oldStep);
    expect(trip.renderingPanorama.value).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    trip.panoramaFailed(trip.current.value!, "Imagery failed");
    expect(trip.isPlaying.value).toBe(false);
    expect(trip.error.value).toBe("Imagery failed");
    expect(trip.renderingPanorama.value).toBe(false);
    await trip.next();
    expect(trip.current.value?.id).toBe("p2");
  });

  it("preloads only three samples and reuses visited history on restart and previous", async () => {
    const trip = makeTrip();
    await trip.preview();
    if (trip.current.value) trip.panoramaReady(trip.current.value);
    expect(mocks.calculate).toHaveBeenCalledTimes(1);
    expect(mocks.lookup).toHaveBeenCalledTimes(4);
    expect(trip.nextViewPosition.value).toEqual({ lat: 0, lng: 0.00045 });
    expect(trip.current.value?.id).toBe("p0");
    await trip.next();
    if (trip.current.value) trip.panoramaReady(trip.current.value);
    expect(trip.current.value?.id).toBe("p1");
    const count = mocks.lookup.mock.calls.length;
    trip.previous();
    if (trip.current.value) trip.panoramaReady(trip.current.value);
    await trip.next();
    if (trip.current.value) trip.panoramaReady(trip.current.value);
    await trip.restart();
    expect(trip.current.value?.id).toBe("p0");
    expect(mocks.lookup).toHaveBeenCalledTimes(count);
  });
  it("skips missing and repeated panorama IDs", async () => {
    mocks.lookup.mockImplementation(async (index: number) =>
      index === 1
        ? null
        : {
            id: index < 3 ? "same" : `p${index}`,
            position: { lat: 0, lng: 0 },
            description: "View",
          },
    );
    const trip = makeTrip();
    await trip.preview();
    if (trip.current.value) trip.panoramaReady(trip.current.value);
    await trip.next();
    if (trip.current.value) trip.panoramaReady(trip.current.value);
    expect(trip.availablePanoramas.value.map((p) => p.id)).toEqual([
      "same",
      "p3",
    ]);
    expect(trip.current.value?.heading).toBeCloseTo(90);
  });
  it("pauses playback without advancing and cancels its single timer", async () => {
    const trip = makeTrip();
    await trip.preview();
    if (trip.current.value) trip.panoramaReady(trip.current.value);
    await trip.play();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(trip.currentIndex.value).toBeGreaterThan(0);
    trip.pause();
    const index = trip.currentIndex.value;
    await vi.advanceTimersByTimeAsync(20000);
    expect(trip.currentIndex.value).toBe(index);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores a panorama request that resolves after pause", async () => {
    const trip = makeTrip();
    await trip.preview();
    if (trip.current.value) trip.panoramaReady(trip.current.value);
    let finish!: (value: unknown) => void;
    mocks.lookup.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = trip.next();
    trip.pause();
    finish({ id: "late", position: { lat: 1, lng: 1 }, description: "Late" });
    await pending;
    expect(trip.current.value?.id).toBe("p0");
    expect(trip.loadingPanorama.value).toBe(false);
  });
  it("finishes uncovered routes and does not leave replay playing", async () => {
    mocks.lookup.mockResolvedValue(null);
    const trip = makeTrip();
    await trip.preview();
    if (trip.current.value) trip.panoramaReady(trip.current.value);
    expect(trip.ended.value).toBe(true);
    expect(trip.message.value).toContain("No Street View coverage");
    await trip.play();
    expect(trip.isPlaying.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("disposes the previous cache when replacing a route", async () => {
    const trip = makeTrip();
    await trip.preview();
    if (trip.current.value) trip.panoramaReady(trip.current.value);
    await trip.next();
    if (trip.current.value) trip.panoramaReady(trip.current.value);
    await trip.preview();
    if (trip.current.value) trip.panoramaReady(trip.current.value);
    expect(mocks.dispose).toHaveBeenCalledTimes(1);
    expect(trip.availablePanoramas.value).toHaveLength(1);
    expect(trip.progress.value).toBe(0);
  });
});
