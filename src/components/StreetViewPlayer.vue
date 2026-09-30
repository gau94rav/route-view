<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  ArrowUp,
  Compass,
  Maximize2,
  Minimize2,
  ArrowUpRight,
  LoaderCircle,
  Eye,
} from "@lucide/vue";
import { hasApiKey, loadGoogleMaps } from "../services/googleMapsLoader";
import { createPanoramaReadinessGate } from "../utils/panoramaReadiness";
import {
  animatePanoramaCamera,
  shouldAnimatePanorama,
} from "../utils/panoramaTransition";
import { distanceBetween, headingBetween } from "../utils/geometry";
import type { Coordinate, PanoramaStep } from "../types";
import VehicleCockpit from "./VehicleCockpit.vue";
import { enterNativeFullscreen } from "../utils/fullscreen";
const previewMode = ref<"street" | "car" | "bike">("street");
const mapVisible = ref(!isPhoneViewport());
const controlsVisible = ref(true);
function isPhoneViewport() {
  const phoneViewport = document.documentElement.clientWidth <= 699;
  const touchLandscape =
    window.matchMedia("(pointer: coarse)").matches &&
    Math.min(window.innerWidth, window.innerHeight) <= 699;
  return phoneViewport || touchLandscape;
}
function hidePlaybackControls() {
  if (isPhoneViewport()) controlsVisible.value = false;
}
let tapStart: { id: number; x: number; y: number; time: number } | undefined;
function phoneInteraction(event: PointerEvent) {
  return (
    document.documentElement.clientWidth <= 699 ||
    (event.pointerType === "touch" &&
      Math.min(window.innerWidth, window.innerHeight) <= 699)
  );
}
function isControl(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "button, a, input, select, label, [role='button'], .playback, .mini-map, .viewer-top, .viewer-notice",
      ),
    )
  );
}
function beginTap(event: PointerEvent) {
  tapStart = undefined;
  if (
    !event.isPrimary ||
    event.button !== 0 ||
    !phoneInteraction(event) ||
    isControl(event.target)
  )
    return;
  tapStart = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    time: event.timeStamp,
  };
}
function moveTap(event: PointerEvent) {
  if (
    tapStart?.id === event.pointerId &&
    Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y) > 10
  )
    tapStart = undefined;
}
function finishTap(event: PointerEvent) {
  const start = tapStart;
  tapStart = undefined;
  if (
    !start ||
    start.id !== event.pointerId ||
    isControl(event.target) ||
    event.timeStamp - start.time > 500 ||
    Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
  )
    return;
  controlsVisible.value = !controlsVisible.value;
}
const expanded = ref(false);
let previousOverflow = "";
function toggleMap() {
  mapVisible.value = !mapVisible.value;
}
watch(expanded, (value) => {
  if (value) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  } else document.body.style.overflow = previousOverflow;
  syncFullscreen();
});
function escapeExpanded(event: KeyboardEvent) {
  if (event.key === "Escape") expanded.value = false;
}
const props = defineProps<{
  current: PanoramaStep | null;
  nextViewPosition: Coordinate | null;
  busy: boolean;
  message: string;
}>();
const emit = defineEmits<{
  error: [message: string];
  ready: [step: PanoramaStep];
  failed: [step: PanoramaStep, message: string];
}>();
const host = ref<HTMLElement>(),
  panel = ref<HTMLElement>(),
  full = ref(false);
const cameraHeading = ref(0);
const arrowRotation = computed(() => {
  if (!props.current || !props.nextViewPosition || props.busy) return null;
  const gap = distanceBetween(props.current.position, props.nextViewPosition);
  if (gap <= 1 || gap > 200) return null;
  const bearing = headingBetween(
    props.current.position,
    props.nextViewPosition,
  );
  return ((bearing - cameraHeading.value + 540) % 360) - 180;
});
let panorama: google.maps.StreetViewPanorama | undefined,
  disposed = false;
let gate: ReturnType<typeof createPanoramaReadinessGate> | undefined;
let statusListener: google.maps.MapsEventListener | undefined;
let resizeObserver: ResizeObserver | undefined;
function clearReadiness() {
  gate?.dispose();
  gate = undefined;
  statusListener?.remove();
  statusListener = undefined;
}
let displayedStep: PanoramaStep | null = null;
let motion: ReturnType<typeof animatePanoramaCamera> | undefined;
let restingZoom: number | undefined;
function cancelMotion() {
  motion?.cancel();
  motion = undefined;
  if (panorama && restingZoom !== undefined) panorama.setZoom(restingZoom);
  restingZoom = undefined;
}
async function show() {
  clearReadiness();
  cancelMotion();
  if (!panorama) return;
  panorama.setVisible(Boolean(props.current));
  if (!props.current) displayedStep = null;
  if (props.current && host.value) {
    const step = props.current;
    const baseZoom = panorama.getZoom() ?? 1;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animate = shouldAnimatePanorama(displayedStep, step, reducedMotion);
    const peakZoom = Math.min(5, baseZoom + 0.28);
    if (animate && displayedStep) {
      restingZoom = baseZoom;
      motion = animatePanoramaCamera(
        panorama,
        {
          heading: headingBetween(displayedStep.position, step.position),
          pitch: 0,
          zoom: peakZoom,
        },
        340,
      );
      const completed = await motion.finished;
      if (!completed || disposed || props.current !== step) return;
    }
    const fail = (message: string) => {
      if (disposed || props.current !== step) return;
      clearReadiness();
      cancelMotion();
      emit("failed", step, message);
    };
    gate = createPanoramaReadinessGate(
      host.value,
      async () => {
        const completed = motion ? await motion.finished : true;
        if (completed && !disposed && props.current === step) {
          clearReadiness();
          emit("ready", step);
        }
      },
      fail,
    );
    statusListener = panorama.addListener("status_changed", () => {
      if (props.current !== step || panorama?.getPano() !== step.id) return;
      if (panorama.getStatus() === google.maps.StreetViewStatus.OK)
        gate?.markAvailable();
      else
        fail(
          "This panorama couldn’t display. Playback paused; try the next view or check your connection.",
        );
    });
    // A cached, already-visible panorama may not emit a new status event.
    const alreadyAvailable =
      panorama.getPano() === step.id &&
      panorama.getStatus() === google.maps.StreetViewStatus.OK;
    panorama.setPano(props.current.id);
    panorama.setPov({ heading: props.current.heading, pitch: 0 });
    displayedStep = step;
    if (alreadyAvailable) gate?.markAvailable();
    if (animate) {
      motion = animatePanoramaCamera(
        panorama,
        { heading: step.heading, pitch: 0, zoom: baseZoom },
        480,
      );
      const completed = await motion.finished;
      if (completed && !disposed && props.current === step) {
        motion = undefined;
        restingZoom = undefined;
      }
    }
  }
}
const syncFullscreen = () => {
  full.value = expanded.value || document.fullscreenElement === panel.value;
};
async function fullscreen() {
  if (expanded.value) {
    expanded.value = false;
    return;
  }
  try {
    if (document.fullscreenElement === panel.value)
      await document.exitFullscreen();
    else if (panel.value)
      expanded.value = !(await enterNativeFullscreen(panel.value));
  } catch {
    // Some phone browsers reject element fullscreen; expand within the viewport.
    expanded.value = true;
  }
}
onMounted(async () => {
  document.addEventListener("fullscreenchange", syncFullscreen);
  document.addEventListener("keydown", escapeExpanded);
  if (!hasApiKey) return;
  try {
    await loadGoogleMaps();
    if (disposed || !host.value) return;
    panorama = new google.maps.StreetViewPanorama(host.value, {
      visible: false,
      addressControl: true,
      addressControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
      },
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_CENTER,
      },
      panControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
      fullscreenControl: false,
      enableCloseButton: false,
      motionTracking: false,
      motionTrackingControl: false,
      linksControl: false,
      clickToGo: false,
      panControl: true,
      zoomControl: true,
      pov: { heading: 0, pitch: 0 },
    });
    panorama.addListener("pov_changed", () => {
      cameraHeading.value = panorama?.getPov().heading ?? 0;
    });
    resizeObserver = new ResizeObserver(() => {
      if (panorama) google.maps.event.trigger(panorama, "resize");
    });
    resizeObserver.observe(host.value);
    cameraHeading.value = panorama.getPov().heading;
    show();
  } catch {
    const message =
      "The Street View viewer couldn’t load. Check your Google API configuration and reload.";
    if (props.current) emit("failed", props.current, message);
    else emit("error", message);
  }
});
watch(() => props.current, show);
onBeforeUnmount(() => {
  disposed = true;
  clearReadiness();
  cancelMotion();
  resizeObserver?.disconnect();
  document.removeEventListener("fullscreenchange", syncFullscreen);
  document.removeEventListener("keydown", escapeExpanded);
  if (expanded.value) document.body.style.overflow = previousOverflow;
  if (panorama) {
    panorama.setVisible(false);
    google.maps.event.clearInstanceListeners(panorama);
  }
});
</script>
<template>
  <section
    ref="panel"
    class="viewer"
    :class="[
      `viewer--${previewMode}`,
      {
        'viewer--expanded': expanded,
        'viewer--map-hidden': !mapVisible,
        'viewer--controls-hidden': !controlsVisible,
      },
    ]"
    aria-label="Interactive Street View player"
    @pointerdown.capture="beginTap"
    @pointermove.capture="moveTap"
    @pointerup.capture="finishTap"
    @pointercancel.capture="tapStart = undefined"
  >
    <div ref="host" class="panorama" />
    <VehicleCockpit v-if="previewMode !== 'street'" :mode="previewMode" />
    <div v-if="!current" class="viewer-empty">
      <div class="landscape" aria-hidden="true">
        <div class="sun" />
        <div class="mountain mountain-back" />
        <div class="mountain mountain-front" />
        <div class="road" />
        <div class="road-line" />
      </div>
      <div class="empty-copy">
        <div class="empty-icon"><Compass :size="26" /></div>
        <span class="eyebrow">A DIFFERENT WAY TO EXPLORE</span>
        <h1>Your next journey<br />starts here.</h1>
        <p>
          From familiar streets to roads less traveled.<br />Choose a route and
          take a look around.
        </p>
        <div class="empty-pill">
          <span class="live-dot" />Powered by Google Street View<ArrowUpRight
            :size="14"
          />
        </div>
      </div>
      <div class="scene-caption">
        ILLUSTRATION · YOUR STREET VIEW WILL APPEAR HERE
      </div>
    </div>
    <div
      v-if="previewMode === 'car'"
      class="windshield-reflection"
      aria-hidden="true"
    />
    <div class="viewer-top">
      <label class="preview-mode">
        <Eye :size="20" aria-hidden="true" />
        <select v-model="previewMode" aria-label="Preview viewpoint">
          <option value="street">Street View</option>
          <option value="car">Car cockpit</option>
          <option value="bike">Bike cockpit</option>
        </select>
      </label>
      <button
        class="glass-button"
        :aria-label="full ? 'Exit fullscreen' : 'Enter fullscreen'"
        @click="fullscreen"
      >
        <Minimize2 v-if="full" :size="18" /><Maximize2 v-else :size="18" />
      </button>
    </div>
    <div v-if="busy || message" class="viewer-notice" role="status">
      <LoaderCircle v-if="busy" :size="17" class="spin" />{{
        message || "Loading Street View…"
      }}
    </div>
    <div
      v-if="arrowRotation !== null"
      class="route-direction"
      role="img"
      aria-label="Direction toward the next route view"
    >
      <span class="route-direction-icon"
        ><ArrowUp
          :size="25"
          :style="{ transform: `rotate(${arrowRotation}deg)` }"
      /></span>
      <span>Next view</span>
    </div>
    <slot
      :map-visible="mapVisible"
      :toggle-map="toggleMap"
      :hide-playback-controls="hidePlaybackControls"
    />
  </section>
</template>
