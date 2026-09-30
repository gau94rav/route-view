/** Return false when the viewer should use its browser-viewport fallback. */
export async function enterNativeFullscreen(
  host: HTMLElement,
): Promise<boolean> {
  // Use a predictable viewport expansion on phones/tablets, including landscape.
  // Native element fullscreen may be advertised but fail in mobile browsers.
  const narrowViewport =
    (document.documentElement?.clientWidth ?? Infinity) <= 699;
  const touchDevice =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  if (narrowViewport || touchDevice) return false;
  if (
    !document.fullscreenEnabled ||
    typeof host.requestFullscreen !== "function"
  )
    return false;
  try {
    await host.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}
