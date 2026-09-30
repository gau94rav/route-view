import { afterEach, describe, expect, it, vi } from "vitest";
import { StreetViewLookup } from "./streetViewService";
afterEach(() => vi.unstubAllGlobals());
function setup() {
  const getPanorama = vi.fn((_request, callback) =>
    callback(
      {
        location: {
          pano: "p1",
          latLng: { toJSON: () => ({ lat: 1, lng: 2 }) },
        },
      },
      "OK",
    ),
  );
  vi.stubGlobal("google", {
    maps: {
      StreetViewService: class {
        getPanorama = getPanorama;
      },
      StreetViewPreference: { NEAREST: "NEAREST" },
      StreetViewSource: { OUTDOOR: "OUTDOOR" },
      StreetViewStatus: { OK: "OK", ZERO_RESULTS: "ZERO_RESULTS" },
    },
  });
  return getPanorama;
}
describe("panorama lookup cache", () => {
  it("deduplicates concurrent requests and cached results", async () => {
    const request = setup(),
      service = new StreetViewLookup(),
      point = { lat: 1, lng: 2 };
    const a = service.lookup(0, point),
      b = service.lookup(0, point);
    expect(a).toBe(b);
    expect(await a).toMatchObject({ id: "p1" });
    await service.lookup(0, point);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("caches coverage misses but retries API failures", async () => {
    const request = setup(),
      service = new StreetViewLookup(),
      point = { lat: 1, lng: 2 };
    request.mockImplementationOnce((_r, cb) => cb(null, "ZERO_RESULTS"));
    expect(await service.lookup(0, point)).toBe(null);
    await service.lookup(0, point);
    expect(request).toHaveBeenCalledTimes(1);
    request.mockImplementationOnce((_r, cb) => cb(null, "UNKNOWN_ERROR"));
    await expect(service.lookup(1, point)).rejects.toThrow(
      "Street View could not load",
    );
    expect(await service.lookup(1, point)).toMatchObject({ id: "p1" });
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("skips queued requests after a route is disposed", async () => {
    const request = setup(),
      service = new StreetViewLookup();
    const pending = service.lookup(0, { lat: 1, lng: 2 });
    service.dispose();
    expect(await pending).toBe(null);
    expect(request).not.toHaveBeenCalled();
  });
});
