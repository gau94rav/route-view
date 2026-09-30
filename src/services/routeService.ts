import { loadGoogleMaps } from "./googleMapsLoader";
import type { LocationSelection, TripRoute } from "../types";
export async function calculateRoute(
  origin: LocationSelection,
  destination: LocationSelection,
): Promise<TripRoute> {
  await loadGoogleMaps();
  const { Route } = (await google.maps.importLibrary(
    "routes",
  )) as google.maps.RoutesLibrary;
  const { routes } = await Route.computeRoutes({
    origin: new google.maps.places.Place({ id: origin.id }),
    destination: new google.maps.places.Place({ id: destination.id }),
    travelMode: "DRIVING",
    polylineQuality: "HIGH_QUALITY",
    fields: ["path", "distanceMeters", "durationMillis", "description"],
  });
  const route = routes?.[0];
  if (
    !route?.path?.length ||
    !route.distanceMeters ||
    route.durationMillis == null
  )
    throw new Error(
      "No driving route found. Try two locations connected by road.",
    );
  return {
    path: route.path.map((p) => ({ lat: p.lat, lng: p.lng })),
    distance: route.distanceMeters,
    duration: route.durationMillis / 1000,
    description: route.description || "Driving route",
  };
}
