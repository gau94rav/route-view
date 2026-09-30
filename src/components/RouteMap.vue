<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { Map as MapIcon } from "@lucide/vue";
import type { Coordinate, TripRoute } from "../types";
import { hasApiKey, loadGoogleMaps } from "../services/googleMapsLoader";
const props = defineProps<{
  route: TripRoute | null;
  position: Coordinate | null;
}>();
const host = ref<HTMLElement>(),
  failure = ref(false);
let map: google.maps.Map | undefined,
  polyline: google.maps.Polyline | undefined,
  marker: google.maps.Marker | undefined,
  disposed = false;
function draw() {
  if (!map) return;
  polyline?.setMap(null);
  marker?.setMap(null);
  if (!props.route) return;
  polyline = new google.maps.Polyline({
    map,
    path: props.route.path,
    strokeColor: "#287551",
    strokeWeight: 5,
    strokeOpacity: 0.95,
  });
  const bounds = new google.maps.LatLngBounds();
  props.route.path.forEach((p) => bounds.extend(p));
  map.fitBounds(bounds, 28);
  marker = new google.maps.Marker({
    map,
    position: props.position ?? props.route.path[0],
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: "#287551",
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 3,
    },
  });
}
onMounted(async () => {
  if (!hasApiKey) return;
  try {
    await loadGoogleMaps();
    if (disposed || !host.value) return;
    map = new google.maps.Map(host.value, {
      center: { lat: 37.77, lng: -122.42 },
      zoom: 11,
      disableDefaultUI: true,
      zoomControl: true,
      streetViewControl: false,
      clickableIcons: false,
      gestureHandling: "cooperative",
      styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
    });
    draw();
  } catch {
    failure.value = true;
  }
});
watch(() => props.route, draw);
watch(
  () => props.position,
  (point) => {
    if (point && marker) {
      marker.setPosition(point);
      if (!map?.getBounds()?.contains(point)) map?.panTo(point);
    }
  },
);
onBeforeUnmount(() => {
  disposed = true;
  polyline?.setMap(null);
  marker?.setMap(null);
  if (map) google.maps.event.clearInstanceListeners(map);
});
</script>
<template>
  <aside class="mini-map">
    <div class="map-title">
      <MapIcon :size="14" /> ROUTE OVERVIEW<span
        v-if="route"
        class="live-dot"
      />
    </div>
    <div ref="host" class="map-canvas" />
    <div v-if="!hasApiKey || failure" class="map-placeholder">
      <div class="map-grid" />
      <MapIcon :size="26" /><span>Your route, at a glance</span>
    </div>
  </aside>
</template>
