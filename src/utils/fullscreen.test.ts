import { afterEach, describe, expect, it, vi } from "vitest";
import { enterNativeFullscreen } from "./fullscreen";

afterEach(() => vi.unstubAllGlobals());
describe("phone fullscreen fallback", () => {
  it("never calls native fullscreen in a phone-width viewport", async () => {
    vi.stubGlobal("document", {
      fullscreenEnabled: true,
      documentElement: { clientWidth: 390 },
    });
    const requestFullscreen = vi
      .fn()
      .mockRejectedValue(new Error("Not supported"));
    expect(
      await enterNativeFullscreen({
        requestFullscreen,
      } as unknown as HTMLElement),
    ).toBe(false);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });
  it("uses viewport expansion for touch devices in landscape", async () => {
    vi.stubGlobal("document", {
      fullscreenEnabled: true,
      documentElement: { clientWidth: 844 },
    });
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: true }),
    });
    const requestFullscreen = vi.fn();
    expect(
      await enterNativeFullscreen({
        requestFullscreen,
      } as unknown as HTMLElement),
    ).toBe(false);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });
  it("falls back without invoking an unsupported fullscreen API", async () => {
    vi.stubGlobal("document", { fullscreenEnabled: false });
    const requestFullscreen = vi.fn();
    expect(
      await enterNativeFullscreen({
        requestFullscreen,
      } as unknown as HTMLElement),
    ).toBe(false);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });
  it("falls back if the element fullscreen method is missing", async () => {
    vi.stubGlobal("document", { fullscreenEnabled: true });
    expect(await enterNativeFullscreen({} as HTMLElement)).toBe(false);
  });
  it("falls back when the browser rejects native fullscreen", async () => {
    vi.stubGlobal("document", { fullscreenEnabled: true });
    const requestFullscreen = vi
      .fn()
      .mockRejectedValue(new Error("Not supported"));
    expect(
      await enterNativeFullscreen({
        requestFullscreen,
      } as unknown as HTMLElement),
    ).toBe(false);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
  it("keeps native fullscreen when the browser accepts it", async () => {
    vi.stubGlobal("document", { fullscreenEnabled: true });
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    expect(
      await enterNativeFullscreen({
        requestFullscreen,
      } as unknown as HTMLElement),
    ).toBe(true);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
});
