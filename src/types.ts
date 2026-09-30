export interface Coordinate {
  lat: number;
  lng: number;
}
export interface RoutePoint extends Coordinate {
  distance: number;
}
export interface LocationSelection {
  id: string;
  label: string;
}
export interface TripRoute {
  path: Coordinate[];
  distance: number;
  duration: number;
  description: string;
}
export interface PanoramaStep {
  id: string;
  position: Coordinate;
  sampleIndex: number;
  heading: number;
  description: string;
}
