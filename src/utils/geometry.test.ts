import { describe, expect, it } from "vitest";
import { distanceBetween, headingBetween, sampleRoute } from "./geometry";
describe("route geometry", () => {
  it("samples a multi-segment route at approximately 50 meters and keeps endpoints", () => {
    const path = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.001 },
      { lat: 0.001, lng: 0.001 },
    ];
    const points = sampleRoute(path, 50);
    expect(points).toHaveLength(6);
    expect(points.map((p) => Math.round(p.distance))).toEqual([
      0, 50, 100, 150, 200, 222,
    ]);
    expect(points.at(-1)).toMatchObject(path.at(-1)!);
    expect(points[3]!.lat).toBeGreaterThan(0);
  });
  it("caps long routes without omitting the destination", () => {
    const points = sampleRoute(
      [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 100 },
      ],
      30,
    );
    expect(points.length).toBeLessThanOrEqual(1200);
    expect(points.at(-1)!.lng).toBe(100);
  });
  it("handles duplicate vertices, empty paths and the antimeridian", () => {
    expect(sampleRoute([])).toEqual([]);
    expect(
      sampleRoute([
        { lat: 1, lng: 1 },
        { lat: 1, lng: 1 },
      ]),
    ).toHaveLength(1);
    const points = sampleRoute([
      { lat: 0, lng: 179.999 },
      { lat: 0, lng: -179.999 },
    ]);
    expect(points).toHaveLength(6);
    expect(Math.abs(points[2]!.lng)).toBeGreaterThan(179);
  });
  it("computes travel headings and physical distances", () => {
    const start = { lat: 0, lng: 0 };
    expect(headingBetween(start, { lat: 1, lng: 0 })).toBeCloseTo(0);
    expect(headingBetween(start, { lat: 0, lng: 1 })).toBeCloseTo(90);
    expect(headingBetween(start, { lat: -1, lng: 0 })).toBeCloseTo(180);
    expect(distanceBetween(start, { lat: 0, lng: 0.001 })).toBeCloseTo(
      111.195,
      2,
    );
  });
});
