import type { Coordinate } from "../types";
export interface PanoramaLocation {
  id: string;
  position: Coordinate;
  description: string;
}
// Route-scoped promise cache deduplicates both hits, misses, and in-flight requests.
export class StreetViewLookup {
  private service = new google.maps.StreetViewService();
  private cache = new Map<number, Promise<PanoramaLocation | null>>();
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;
  dispose() {
    this.disposed = true;
    this.cache.clear();
  }
  lookup(index: number, point: Coordinate): Promise<PanoramaLocation | null> {
    const existing = this.cache.get(index);
    if (existing) return existing;
    const promise = this.queue.then(() => {
      if (this.disposed) return null;
      return new Promise<PanoramaLocation | null>((resolve, reject) => {
        this.service.getPanorama(
          {
            location: point,
            radius: 50,
            preference: google.maps.StreetViewPreference.NEAREST,
            sources: [google.maps.StreetViewSource.OUTDOOR],
          },
          (data, status) => {
            if (status === google.maps.StreetViewStatus.ZERO_RESULTS)
              return resolve(null);
            if (status !== google.maps.StreetViewStatus.OK)
              return reject(
                new Error(
                  "Street View could not load. Check your connection and API configuration, then try again.",
                ),
              );
            const location = data?.location;
            resolve(
              location?.pano && location.latLng
                ? {
                    id: location.pano,
                    position: location.latLng.toJSON(),
                    description: location.description || "Along your route",
                  }
                : null,
            );
          },
        );
      });
    });
    this.cache.set(index, promise);
    this.queue = promise.catch(() => undefined);
    // Failed API requests can be retried; legitimate coverage misses remain cached.
    void promise.catch(() => this.cache.delete(index));
    return promise;
  }
}
