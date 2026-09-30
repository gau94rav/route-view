<script setup lang="ts">
import { ref } from "vue";
import {
  ArrowUpRight,
  Route,
  Compass,
  ShieldCheck,
  Info,
  X,
  MapPin,
} from "@lucide/vue";
import RouteSearch from "./components/RouteSearch.vue";
import RouteMap from "./components/RouteMap.vue";
import StreetViewPlayer from "./components/StreetViewPlayer.vue";
import PlaybackControls from "./components/PlaybackControls.vue";
import TripStats from "./components/TripStats.vue";
import { useTrip } from "./composables/useTrip";
import { hasApiKey } from "./services/googleMapsLoader";
const {
  origin,
  destination,
  route,
  routePoints,
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
} = useTrip();
const helpDialog = ref<HTMLDialogElement>();
</script>
<template>
  <div class="app-shell">
    <header class="header">
      <a class="brand" href="/" aria-label="RouteView home"
        ><span class="brand-icon"><Route :size="22" /></span>Route<span
          class="brand-light"
          >View</span
        ><span class="beta">BETA</span></a
      ><span class="header-tagline">See the road ahead.</span
      ><button class="help-button" @click="helpDialog?.showModal()">
        How it works<ArrowUpRight :size="16" />
      </button>
    </header>
    <main class="workspace">
      <aside class="sidebar">
        <RouteSearch
          :busy="loadingRoute"
          :interval="interval"
          @origin="origin = $event"
          @destination="destination = $event"
          @update:interval="interval = $event"
          @preview="preview"
        />
        <TripStats
          :route="route"
          :progress="progress"
          :remaining-distance="remainingDistance"
          :remaining-duration="remainingDuration"
        />
        <div class="sidebar-bottom">
          <div class="tip">
            <Compass :size="21" />
            <div>
              <strong>Take the scenic preview.</strong>
              <p>
                Drag to look around. Press play to let the road come to you.
              </p>
            </div>
          </div>
          <div class="privacy">
            <ShieldCheck :size="14" />No sign-up. Just the open road.
          </div>
        </div>
      </aside>
      <div class="main-content">
        <div class="content-heading">
          <div>
            <span class="eyebrow">EXPLORE AT STREET LEVEL</span>
            <h2>
              {{ route ? "Your window to the road." : "A window to wherever." }}
            </h2>
          </div>
          <span class="view-badge"><Compass :size="14" />360° exploration</span>
        </div>
        <div v-if="!hasApiKey" class="setup-banner">
          <Info :size="18" /><span
            ><strong>One small step before the journey.</strong> Add
            <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>.env.local</code> and
            restart the app. Setup details are in README.md.</span
          >
        </div>
        <div v-if="error" class="error-banner" role="alert">
          <Info :size="18" /><span>{{ error }}</span
          ><button aria-label="Dismiss error" @click="error = ''">
            <X :size="16" />
          </button>
        </div>
        <StreetViewPlayer
          v-slot="{ mapVisible, toggleMap }"
          :current="current"
          :next-view-position="nextViewPosition"
          :busy="loadingPanorama || renderingPanorama"
          :message="
            renderingPanorama ? 'Loading Street View imagery…' : message
          "
          @error="
            pause();
            error = $event;
          "
          @ready="panoramaReady"
          @failed="panoramaFailed"
        >
          <RouteMap v-show="mapVisible" :route="route" :position="position" />
          <PlaybackControls
            :map-visible="mapVisible"
            @toggle-map="toggleMap"
            :playing="isPlaying"
            :busy="loadingPanorama || renderingPanorama"
            :enabled="!!route"
            :can-previous="currentIndex > 0"
            :ended="ended"
            @play="play"
            @pause="pause"
            @restart="restart"
            @previous="previous"
            @next="next"
          />
        </StreetViewPlayer>
        <div class="viewer-footer">
          <span
            ><MapPin :size="14" />{{
              current?.description || "Your route will appear here"
            }}<span v-if="position" class="coordinates"
              >{{ position.lat.toFixed(4) }},
              {{ position.lng.toFixed(4) }}</span
            ></span
          ><span>{{
            route
              ? `${routePoints.length.toLocaleString()} route samples · imagery varies by location`
              : "Real streets. A fresh perspective."
          }}</span>
        </div>
      </div>
    </main>
    <footer class="footer">
      <span>Made for the journey, before the journey.</span
      ><span
        >ROUTEVIEW <span class="footer-dot">·</span> EXPLORE WITH
        CURIOSITY</span
      >
    </footer>
    <dialog
      ref="helpDialog"
      class="help-dialog"
      aria-labelledby="help-title"
      @click.self="helpDialog?.close()"
    >
      <section class="help-modal">
        <button
          class="modal-close"
          aria-label="Close help"
          @click="helpDialog?.close()"
        >
          <X :size="20" /></button
        ><Compass :size="30" class="green" />
        <h2 id="help-title">Meet the road before you go.</h2>
        <ol>
          <li>
            Select a start and destination from Google’s location suggestions.
          </li>
          <li>Choose your view spacing and select Preview Route.</li>
          <li>
            Use Play or the next/previous controls to explore. Drag the panorama
            to look around.
          </li>
        </ol>
        <p>
          Views are snapshots of available imagery. Uncovered sections are
          skipped; ETA estimates the real driving time remaining. Each loaded
          view stays on screen for one second before the next transition.
        </p>
        <button class="primary" @click="helpDialog?.close()">
          Let’s explore<ArrowUpRight :size="17" />
        </button>
      </section>
    </dialog>
  </div>
</template>
