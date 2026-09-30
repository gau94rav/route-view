import { computed, onScopeDispose, ref, shallowRef, watch } from "vue";
import type {
  LocationSelection,
  PanoramaStep,
  RoutePoint,
  TripRoute,
} from "../types";
import { calculateRoute } from "../services/routeService";
import { StreetViewLookup } from "../services/streetViewService";
import { headingBetween, sampleRoute } from "../utils/geometry";

export function useTrip() {
  const origin = ref<LocationSelection | null>(null),
    destination = ref<LocationSelection | null>(null);
  const route = shallowRef<TripRoute | null>(null),
    routePoints = shallowRef<RoutePoint[]>([]);
  const availablePanoramas = shallowRef<PanoramaStep[]>([]);
  const currentIndex = ref(-1),
    isPlaying = ref(false);
  const loadingRoute = ref(false),
    loadingPanorama = ref(false),
    error = ref(""),
    message = ref(""),
    ended = ref(false);
  const interval = ref(
    Math.min(
      60,
      Math.max(30, Number(import.meta.env.VITE_ROUTE_SAMPLE_METERS) || 50),
    ),
  );
  const current = computed(
    () => availablePanoramas.value[currentIndex.value] ?? null,
  );
  const upcomingPanorama = shallowRef<{
    from: PanoramaStep;
    sampleIndex: number;
    position: PanoramaStep["position"];
  } | null>(null);
  const nextViewPosition = computed(() => {
    if (ended.value || !current.value) return null;
    return (
      availablePanoramas.value[currentIndex.value + 1]?.position ??
      (upcomingPanorama.value?.from === current.value
        ? upcomingPanorama.value.position
        : null)
    );
  });
  const panoramaState = ref<"loading" | "ready" | "failed">("loading");
  const renderingPanorama = computed(
    () => Boolean(current.value) && panoramaState.value === "loading",
  );
  // Synchronous reset prevents a timer starting before the viewer sees a new step.
  watch(
    current,
    () => {
      clearTimer();
      panoramaState.value = "loading";
      upcomingPanorama.value = null;
    },
    { flush: "sync" },
  );
  function panoramaReady(step: PanoramaStep) {
    if (current.value !== step) return;
    panoramaState.value = "ready";
    schedule();
  }
  function panoramaFailed(step: PanoramaStep, reason: string) {
    if (current.value !== step) return;
    panoramaState.value = "failed";
    pause();
    error.value = reason;
  }
  const sampleIndex = computed(() =>
    ended.value
      ? Math.max(0, routePoints.value.length - 1)
      : (current.value?.sampleIndex ?? 0),
  );
  const position = computed(() => routePoints.value[sampleIndex.value] ?? null);
  const progress = computed(() => {
    const total = routePoints.value.at(-1)?.distance ?? 0;
    return total ? Math.min(1, (position.value?.distance ?? 0) / total) : 0;
  });
  const remainingDistance = computed(
    () => (route.value?.distance ?? 0) * (1 - progress.value),
  );
  const remainingDuration = computed(
    () => (route.value?.duration ?? 0) * (1 - progress.value),
  );
  let lookup: StreetViewLookup | undefined,
    generation = 0,
    navigation = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  let scanIndex = 0;
  const seen = new Set<string>();
  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = undefined;
  }
  function pause() {
    isPlaying.value = false;
    clearTimer();
    navigation++;
    loadingPanorama.value = false;
  }
  function schedule() {
    clearTimer();
    if (
      !isPlaying.value ||
      ended.value ||
      loadingPanorama.value ||
      !current.value ||
      panoramaState.value !== "ready"
    )
      return;
    // A full second of viewing time begins only after imagery readiness.
    timer = setTimeout(() => void next(), 1000);
  }
  function preload(index: number, service: StreetViewLookup) {
    // The arrow reuses the same three lookahead requests as playback.
    const from = current.value;
    if (!from) return;
    for (
      let i = index + 1;
      i <= Math.min(index + 3, routePoints.value.length - 1);
      i++
    ) {
      void service
        .lookup(i, routePoints.value[i]!)
        .then((pano) => {
          if (
            !pano ||
            seen.has(pano.id) ||
            current.value !== from ||
            ended.value
          )
            return;
          if (
            !upcomingPanorama.value ||
            i < upcomingPanorama.value.sampleIndex
          ) {
            upcomingPanorama.value = {
              from,
              sampleIndex: i,
              position: pano.position,
            };
          }
        })
        .catch(() => undefined);
    }
  }
  async function seek() {
    if (!lookup || loadingPanorama.value || ended.value) return;
    const service = lookup,
      epoch = generation,
      token = ++navigation;
    loadingPanorama.value = true;
    error.value = "";
    message.value = "Finding the next view…";
    let misses = 0;
    try {
      while (scanIndex < routePoints.value.length) {
        const index = scanIndex,
          point = routePoints.value[index]!;
        const pano = await service.lookup(index, point);
        if (epoch !== generation || token !== navigation) return;
        scanIndex = index + 1;
        if (pano && !seen.has(pano.id)) {
          seen.add(pano.id);
          const nextPoint = routePoints.value[index + 1] ?? point;
          const previous = current.value;
          const gap =
            point.distance -
            (routePoints.value[previous?.sampleIndex ?? 0]?.distance ?? 0);
          message.value =
            gap > 250
              ? "Street View unavailable for this section. Continued to the next view."
              : "";
          availablePanoramas.value = [
            ...availablePanoramas.value,
            {
              ...pano,
              sampleIndex: index,
              heading:
                nextPoint === point
                  ? headingBetween(
                      routePoints.value[Math.max(0, index - 1)]!,
                      point,
                    )
                  : headingBetween(point, nextPoint),
            },
          ];
          currentIndex.value = availablePanoramas.value.length - 1;
          preload(index, service);
          return;
        }
        if (!pano) misses++;
        else misses = 0;
        if (misses >= 6) {
          message.value =
            "Street View unavailable for this section. Looking ahead…";
          const spacing = routePoints.value[1]?.distance || interval.value;
          scanIndex += Math.max(0, Math.floor(250 / spacing) - 1);
        }
      }
      ended.value = true;
      isPlaying.value = false;
      message.value = availablePanoramas.value.length
        ? "Preview complete. You’ve reached the end of available imagery."
        : "No Street View coverage found on this route. Try another journey.";
    } catch (cause) {
      if (epoch === generation && token === navigation) {
        error.value =
          cause instanceof Error
            ? cause.message
            : "Unable to load Street View. Please try again.";
        isPlaying.value = false;
      }
    } finally {
      if (epoch === generation && token === navigation) {
        loadingPanorama.value = false;
        schedule();
      }
    }
  }
  async function next() {
    if (loadingPanorama.value || renderingPanorama.value) return;
    clearTimer();
    if (currentIndex.value < availablePanoramas.value.length - 1) {
      currentIndex.value++;
      ended.value = false;
      message.value = "";
      schedule();
    } else await seek();
  }
  function previous() {
    pause();
    ended.value = false;
    message.value = "";
    currentIndex.value = Math.max(0, currentIndex.value - 1);
  }
  async function restart() {
    pause();
    ended.value = false;
    message.value = "";
    error.value = "";
    if (availablePanoramas.value.length) {
      // Retrying a failed first frame needs a new step identity so the viewer reloads.
      if (currentIndex.value === 0 && panoramaState.value === "failed") {
        availablePanoramas.value = [
          { ...availablePanoramas.value[0]! },
          ...availablePanoramas.value.slice(1),
        ];
      }
      currentIndex.value = 0;
    } else {
      scanIndex = 0;
      await seek();
    }
  }
  async function play() {
    if (!route.value) return;
    if (ended.value || panoramaState.value === "failed") await restart();
    if (ended.value) return;
    isPlaying.value = true;
    if (!current.value) await seek();
    else schedule();
  }
  async function preview() {
    if (!origin.value || !destination.value || loadingRoute.value) return;
    pause();
    generation++;
    lookup?.dispose();
    lookup = undefined;
    const epoch = generation;
    route.value = null;
    routePoints.value = [];
    availablePanoramas.value = [];
    currentIndex.value = -1;
    seen.clear();
    scanIndex = 0;
    ended.value = false;
    loadingRoute.value = true;
    error.value = "";
    message.value = "";
    try {
      const result = await calculateRoute(origin.value, destination.value);
      if (epoch !== generation) return;
      route.value = result;
      routePoints.value = sampleRoute(result.path, interval.value);
      lookup = new StreetViewLookup();
      await seek();
    } catch {
      if (epoch === generation)
        error.value =
          "We couldn’t calculate this route. Check your API setup and connection, or try different locations.";
    } finally {
      if (epoch === generation) loadingRoute.value = false;
    }
  }
  onScopeDispose(() => {
    pause();
    generation++;
    lookup?.dispose();
  });
  return {
    origin,
    destination,
    route,
    routePoints,
    availablePanoramas,
    currentIndex,
    current,
    nextViewPosition,
    position,
    isPlaying,
    loadingRoute,
    loadingPanorama,
    renderingPanorama,
    panoramaReady,
    panoramaFailed,
    error,
    message,
    ended,
    interval,
    progress,
    remainingDistance,
    remainingDuration,
    preview,
    next,
    previous,
    restart,
    play,
    pause,
  };
}
