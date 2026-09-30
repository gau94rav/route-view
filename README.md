# RouteView

A Vue 3 + TypeScript web app for previewing a driving route with Google's interactive Street View. Frontend only: no backend, accounts, or persistent location storage.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
cp .env.example .env.local
# Edit .env.local and set VITE_GOOGLE_MAPS_API_KEY
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173). Restart Vite after editing environment variables. Without a key, the app displays a setup state and illustration; it does not simulate Google results.

```sh
npm run test
npm run build
npm run preview
```

## Google Cloud setup — exactly which APIs

Create a Google Cloud project, attach a billing account, and enable these **three** APIs in that same project:

1. **Maps JavaScript API** — map rendering, interactive `StreetViewPanorama`, and `StreetViewService` lookups.
2. **Places API (New)** — `PlaceAutocompleteElement` suggestions and place selection.
3. **Routes API** — the Maps JavaScript Routes library's `Route.computeRoutes()`.

**Directions API (Legacy), Street View Static API, and Geocoding API are not required.** This implementation uses the current Routes library with selected Place IDs and renders Google's interactive viewer directly. It never downloads or stitches imagery.

Create a browser API key. Restrict it to **Websites (HTTP referrers)** such as `http://localhost:5173/*`, `http://127.0.0.1:5173/*`, and your production domain. Add the three APIs above to its API restrictions. If Vite uses another port, add that port's referrer. Set quotas and billing alerts appropriate to your usage.

```dotenv
VITE_GOOGLE_MAPS_API_KEY=your_key_here
VITE_ROUTE_SAMPLE_METERS=50
```

A frontend key is visible to the browser; environment variables avoid source control exposure, not browser visibility. Restrict the key in Google Cloud. Never commit `.env.local`.

Official references: [Routes setup](https://developers.google.com/maps/documentation/javascript/routes/start), [Place Autocomplete widget](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new), [Street View service and viewer](https://developers.google.com/maps/documentation/javascript/streetview).

## Using RouteView

Select **both locations from the Google autocomplete suggestions**, choose 30, 50, or 60 meter view spacing, and press **Preview Route**. RouteView draws the route, shows distance and estimated driving duration, and finds the first available panorama.

- Play/Pause starts or pauses the preview. Pause also cancels an ongoing coverage scan after the current request resolves.
- On phones, Play automatically hides the playback toolbar. Tap the road view to show or hide it again while playback continues. Dragging, pinching, long presses, and tapping other controls or the minimap do not toggle it. Desktop controls remain visible.
- The minimap starts hidden on phones, including touch phones in landscape, and visible on larger screens. Tap the map button after Next to show or hide it; rotating or resizing keeps your choice.
- Previous/Next navigates unique available views. Restart returns to the first visited view. Previously visited locations are reused without extra lookups.
- Playback waits for imagery readiness and camera motion to finish, then holds each view for **one second** before advancing. There is no speed selector.
- A small direction arrow points toward the next available route view when its position is known from the existing three-sample lookahead or visited history. It rotates as you look around. The arrow is hidden while loading, at the end, across large gaps, or when the next view is not yet known; it adds no panorama requests.
- Drag inside Street View to look around; the next view resets the camera heading toward the next route sample. Use the expand button for fullscreen, where the map and controls remain available.
- ETA is the **estimated real driving duration remaining**, not a countdown for preview playback. Progress and remaining distance are approximations based on distance along the route geometry, scaled to Google's reported route distance.

## Responsive layout

The UI adapts to viewport width rather than detecting device models: full-width phone inputs below 700 px, a full-width viewer with a two-column search layout on 700–1023 px tablets, and a sidebar on larger screens. Short landscape windows have a compact layout. Controls have at least 44 px touch targets, location inputs and selects use 16 px text, fullscreen uses dynamic viewport height, and safe-area insets reserve space for notches and home indicators. Dialogs scroll inside short windows. Representative phone, tablet, landscape, and desktop viewports are checked in the browser; physical iOS and Android hardware testing is still recommended.

## Structure

```text
src/
  App.vue                        Page layout and component wiring
  style.css                      Responsive UI and illustrated empty state
  types.ts                       Small shared domain types
  components/
    RouteSearch.vue              Places widgets and route form
    RouteMap.vue                 Polyline and moving marker
    StreetViewPlayer.vue         One reusable interactive panorama
    VehicleCockpit.vue           Optional illustrated car/bike viewpoints
    PlaybackControls.vue         Playback and manual navigation controls
    TripStats.vue                Distance, duration, and progress
  composables/
    useTrip.ts                    Route lifecycle, lazy navigation, playback
    useTrip.test.ts               Playback and cancellation regression tests
  services/
    googleMapsLoader.ts           Singleton Google library load
    routeService.ts               One route request with minimal field mask
    streetViewService.ts          Serialized lookups and route-scoped cache
    streetViewService.test.ts     Request cache and disposal regression tests
  utils/
    panoramaReadiness.ts         Browser-managed imagery readiness gate
    geometry.ts                  Distance, interpolation, sampling, heading
    geometry.test.ts             Geometry regression tests
```

## Design and request efficiency

Phones show an eye icon at the top left: tap it for the native Street View / Car / Bike dropdown. The fullscreen button sits opposite it. Phone-width windows (up to 699 px) and devices with a coarse primary pointer use browser-viewport expansion directly, including touch devices in landscape, without calling native fullscreen. Larger desktop windows try native fullscreen and fall back to viewport expansion if unavailable or rejected. Tap Exit fullscreen or press Escape to return. Browser navigation bars may remain visible during viewport expansion. The map button after Next toggles the minimap on all screens, retaining its map instance and route.

The viewer’s **View** selector offers Street View (default), Car cockpit, and Bike cockpit. Car reserves the lower half of the viewer for an illustrated dashboard and steering wheel; Bike places fully framed mirrors, handlebars, and a tank over the road on a transparent background, with the tank flush to the viewer’s bottom edge. These are optional visual viewpoints, not vehicle-specific routes: routing remains driving. Car adds a subtle, non-interactive windshield reflection and resizes the panorama above its dashboard. On phones the dashboard is framed around the steering wheel, aligning it with the road view, and the smaller map moves above the dashboard. This visual framing cannot physically reposition Google’s fixed Street View capture camera. Bike keeps the panorama full size and fits the complete cockpit within the viewport. Switching viewpoints reuses the same panorama, with no additional route or panorama lookup requests. Map and playback controls remain available, including in fullscreen.

- Vue refs and a single `useTrip` composable are sufficient for this MVP; Pinia would add little value.
- Autocomplete selections supply a Place ID and prediction label directly. No extra Place Details or geocoding request is made.
- A route request asks only for path, distance, duration, and description. Google libraries load once. The map, route line, marker, and viewer are reused during playback.
- Sampling makes one pass through the route segments, interpolates at the selected interval, and retains endpoints. Very long routes increase spacing to cap samples at **1,200**. This cap bounds potential requests; all samples are never preloaded.
- Lookups search within **50 meters**, prefer the nearest outdoor panorama, and serialize requests to limit concurrency. Cached promises deduplicate concurrent lookups, valid hits, and coverage misses. Errors are evicted so retries work. The cache is memory-only and cleared when replacing a route.
- Only the next **three sample locations** are prefetched. Panorama IDs are deduplicated across the journey. Previous/Restart use visited history.
- After six consecutive coverage misses, searches advance in roughly 250 meter increments. This avoids exhaustive searches through long uncovered stretches; brief covered sections between those probes can be skipped. Larger gaps display an explanatory message and resume at the next available view.
- Playback starts its single delay timer only after the viewer reports imagery readiness. Google has no documented all-tiles-loaded event: the readiness gate waits for successful panorama status, a minimum 2.5 second settling period, 1.5 seconds without observed Google imagery completions or image DOM changes, complete DOM imagery, and two browser paints. This is a conservative approximation for Google’s canvas/WebGL renderer, not a guarantee that every full-resolution tile has loaded. A 60 second timeout or imagery failure pauses playback rather than advancing. No overlapping playback requests. Route generation and navigation tokens prevent stale results from changing a replaced route or a paused journey. Queued requests for a disposed route are skipped; Google's already in-flight request cannot be aborted.
- Nearby panorama changes use a 340 ms camera zoom-in, followed by a 480 ms zoom-out into the next view. Heading eases along the shortest rotation toward the next position, and the user’s original zoom is restored. Transitions use one Google viewer and public camera methods; no imagery is captured, downloaded, or stitched. Large jumps over 200 meters, the first view, and reduced-motion preferences skip animation. Playback still waits for imagery readiness and camera animation completion. This approximates forward movement; it does not reproduce Google Maps’ internal 3D transition.
- Street View consists of separate captured panoramas, so playback is discrete. Google controls transitions and imagery rendering; this app does not guarantee continuous video or image capture dates. The last available panorama can precede the exact destination. At the end of the search, progress reaches 100% and the UI explains that available imagery is complete.

## Error handling and deployment

Missing keys, library failures, location search errors, unavailable routes, panorama request failures, and coverage gaps have user-facing states. If Google shows an authorization error, verify billing, the API list, HTTP referrers, and key restrictions in Cloud Console; reload after changing configuration. Google may also log diagnostic details to the browser console.

Build with `npm run build` and deploy `dist/` to any static host. Set the Vite key at build time and add the host's domain to the key's allowed referrers. No server-side secret or backend is required.

Real Google autocomplete, route calculation, panorama coverage, and billing behavior must be verified with your configured key and project. Automated tests cover geometry, caching, cancellation, and playback without sending paid Google requests.
