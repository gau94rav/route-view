import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
export const hasApiKey = Boolean(
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY &&
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY !==
    "your_google_maps_browser_api_key",
);
let loading: Promise<void> | undefined;
export function loadGoogleMaps(): Promise<void> {
  if (!hasApiKey)
    return Promise.reject(
      new Error(
        "Add your Google Maps API key to .env.local to start exploring.",
      ),
    );
  if (!loading) {
    setOptions({ key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, v: "weekly" });
    loading = Promise.all([
      importLibrary("maps"),
      importLibrary("places"),
      importLibrary("routes"),
      importLibrary("streetView"),
    ]).then(() => undefined);
  }
  return loading;
}
