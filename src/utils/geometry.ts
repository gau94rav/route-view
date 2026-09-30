import type { Coordinate, RoutePoint } from "../types";
const R = 6371008.8;
const rad = (n: number) => (n * Math.PI) / 180;
const deg = (n: number) => (n * 180) / Math.PI;
const lngDelta = (a: number, b: number) => ((b - a + 540) % 360) - 180;
export function distanceBetween(a: Coordinate, b: Coordinate): number {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(lngDelta(a.lng, b.lng)) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function headingBetween(a: Coordinate, b: Coordinate): number {
  const d = rad(lngDelta(a.lng, b.lng));
  return (
    (deg(
      Math.atan2(
        Math.sin(d) * Math.cos(rad(b.lat)),
        Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
          Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(d),
      ),
    ) +
      360) %
    360
  );
}
// A single pass over the polyline; interpolates within segments and retains endpoints.
export function sampleRoute(
  path: Coordinate[],
  interval = 50,
  maxPoints = 1200,
): RoutePoint[] {
  if (!Number.isFinite(interval) || interval <= 0 || maxPoints < 2)
    throw new Error("Invalid sampling settings");
  if (!path.length) return [];
  const lengths = path.slice(1).map((p, i) => distanceBetween(path[i]!, p));
  const total = lengths.reduce((a, b) => a + b, 0);
  const spacing = Math.max(interval, total / (maxPoints - 1));
  const result: RoutePoint[] = [{ ...path[0]!, distance: 0 }];
  let travelled = 0,
    target = spacing;
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]!,
      a = path[i]!,
      b = path[i + 1]!;
    while (
      length > 0 &&
      target < total - 0.001 &&
      target <= travelled + length
    ) {
      const ratio = (target - travelled) / length;
      result.push({
        lat: a.lat + (b.lat - a.lat) * ratio,
        lng: ((a.lng + lngDelta(a.lng, b.lng) * ratio + 540) % 360) - 180,
        distance: target,
      });
      target += spacing;
    }
    travelled += length;
  }
  if (total > 0) result.push({ ...path[path.length - 1]!, distance: total });
  return result;
}
export const formatDistance = (meters: number) =>
  meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
export function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.ceil(seconds / 60));
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
    : `${minutes} min`;
}
