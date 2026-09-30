<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { ArrowRight, Circle, MapPin, Route, LoaderCircle } from "@lucide/vue";
import { hasApiKey, loadGoogleMaps } from "../services/googleMapsLoader";
import type { LocationSelection } from "../types";
const props = defineProps<{ busy: boolean; interval: number }>();
const emit = defineEmits<{
  origin: [value: LocationSelection | null];
  destination: [value: LocationSelection | null];
  preview: [];
  "update:interval": [value: number];
}>();
const originHost = ref<HTMLElement>(),
  destinationHost = ref<HTMLElement>();
const origin = ref<LocationSelection | null>(null),
  destination = ref<LocationSelection | null>(null);
const ready = ref(false),
  failure = ref("");
let disposed = false;
const cleanups: (() => void)[] = [];
onMounted(async () => {
  if (!hasApiKey) return;
  try {
    await loadGoogleMaps();
    if (disposed) return;
    for (const [host, kind] of [
      [originHost.value, "origin"],
      [destinationHost.value, "destination"],
    ] as const) {
      if (!host) continue;
      const widget = new google.maps.places.PlaceAutocompleteElement({});
      widget.setAttribute(
        "placeholder",
        kind === "origin" ? "Where are you starting?" : "Where are you headed?",
      );
      widget.setAttribute(
        "aria-label",
        kind === "origin" ? "Start location" : "Destination",
      );
      const reset = () => {
        if (kind === "origin") origin.value = null;
        else destination.value = null;
        if (kind === "origin") emit("origin", null);
        else emit("destination", null);
      };
      const select = (event: Event) => {
        const { placePrediction } =
          event as google.maps.places.PlacePredictionSelectEvent;
        // Route computation needs only the place ID: no extra Place Details request.
        const value = {
          id: placePrediction.placeId,
          label: placePrediction.text.toString(),
        };
        if (kind === "origin") origin.value = value;
        else destination.value = value;
        if (kind === "origin") emit("origin", value);
        else emit("destination", value);
      };
      const fail = () => {
        failure.value =
          "Location search is unavailable. Check Places API access and your connection.";
      };
      widget.addEventListener("input", reset);
      widget.addEventListener("gmp-select", select);
      widget.addEventListener("gmp-error", fail);
      host.append(widget);
      cleanups.push(() => {
        widget.removeEventListener("input", reset);
        widget.removeEventListener("gmp-select", select);
        widget.removeEventListener("gmp-error", fail);
        widget.remove();
      });
    }
    ready.value = true;
  } catch {
    failure.value =
      "Google Maps couldn’t load. Check your key, billing, and connection, then reload.";
  }
});
onBeforeUnmount(() => {
  disposed = true;
  cleanups.forEach((cleanup) => cleanup());
});
</script>
<template>
  <form class="search-form" @submit.prevent="emit('preview')">
    <div class="eyebrow">YOUR JOURNEY</div>
    <h2>See the road <br />before you go.</h2>
    <p class="muted intro">A little curiosity. A whole new perspective.</p>
    <div class="location-fields">
      <div class="field">
        <Circle :size="17" class="origin-icon" /><label
          >START LOCATION
          <div ref="originHost" class="autocomplete-host" />
          <input
            v-if="!ready"
            disabled
            placeholder="Where are you starting?"
            aria-label="Start location"
        /></label>
      </div>
      <div class="connector" />
      <div class="field">
        <MapPin :size="19" /><label
          >DESTINATION
          <div ref="destinationHost" class="autocomplete-host" />
          <input
            v-if="!ready"
            disabled
            placeholder="Where are you headed?"
            aria-label="Destination"
        /></label>
      </div>
    </div>
    <p v-if="failure" class="inline-error" role="alert">{{ failure }}</p>
    <button
      class="primary preview-button"
      :disabled="!origin || !destination || props.busy"
      type="submit"
    >
      <LoaderCircle v-if="busy" :size="18" class="spin" /><Route
        v-else
        :size="18"
      />{{ busy ? "Preparing your journey…" : "Preview Route"
      }}<ArrowRight v-if="!busy" :size="18" />
    </button>
    <div class="sampling">
      <label for="sampling">View spacing</label
      ><select
        id="sampling"
        :value="interval"
        :disabled="busy"
        @change="
          emit(
            'update:interval',
            Number(($event.target as HTMLSelectElement).value),
          )
        "
      >
        <option v-if="![30, 50, 60].includes(interval)" :value="interval">{{ interval }} meters · custom</option>
        <option :value="30">30 meters · detailed</option>
        <option :value="50">50 meters · balanced</option>
        <option :value="60">60 meters · efficient</option>
      </select>
    </div>
  </form>
</template>
