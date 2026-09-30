import type { Coordinate, PanoramaStep } from "../types";
import { distanceBetween } from "./geometry";

type Camera = Pick<
  google.maps.StreetViewPanorama,
  "getPov" | "setPov" | "getZoom" | "setZoom"
>;
export function shouldAnimatePanorama(
  from: PanoramaStep | null,
  to: PanoramaStep,
  reducedMotion: boolean,
): boolean {
  if (!from || reducedMotion || from.id === to.id) return false;
  const distance = distanceBetween(
    from.position as Coordinate,
    to.position as Coordinate,
  );
  return distance > 1 && distance <= 200;
}

// Animate only Google's public camera methods: one viewer, no copied images.
export function animatePanoramaCamera(
  camera: Camera,
  target: { heading: number; pitch: number; zoom: number },
  duration: number,
) {
  const initial = camera.getPov();
  const zoom = camera.getZoom() ?? 1;
  const delta = ((target.heading - initial.heading + 540) % 360) - 180;
  let frame = 0,
    started: number | undefined,
    active = true;
  let resolve!: (completed: boolean) => void;
  const finished = new Promise<boolean>((done) => {
    resolve = done;
  });
  function tick(time: number) {
    if (!active) return;
    started ??= time;
    const progress = Math.min(1, (time - started) / Math.max(1, duration));
    const eased = progress * progress * (3 - 2 * progress);
    camera.setPov({
      heading: (initial.heading + delta * eased + 360) % 360,
      pitch: initial.pitch + (target.pitch - initial.pitch) * eased,
    });
    camera.setZoom(zoom + (target.zoom - zoom) * eased);
    if (progress < 1) frame = requestAnimationFrame(tick);
    else {
      active = false;
      resolve(true);
    }
  }
  frame = requestAnimationFrame(tick);
  return {
    finished,
    cancel() {
      if (!active) return;
      active = false;
      cancelAnimationFrame(frame);
      resolve(false);
    },
  };
}
