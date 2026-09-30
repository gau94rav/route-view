<script setup lang="ts">
import { Clock3, Route, Flag } from "@lucide/vue";
import { formatDistance, formatDuration } from "../utils/geometry";
import type { TripRoute } from "../types";
defineProps<{
  route: TripRoute | null;
  progress: number;
  remainingDistance: number;
  remainingDuration: number;
}>();
</script>
<template>
  <section class="trip-stats">
    <div class="eyebrow">TRIP AT A GLANCE</div>
    <div class="stats-pair">
      <div>
        <Route :size="17" /><strong>{{
          route ? formatDistance(route.distance) : "—"
        }}</strong
        ><span>Total distance</span>
      </div>
      <div>
        <Clock3 :size="17" /><strong>{{
          route ? formatDuration(route.duration) : "—"
        }}</strong
        ><span>Estimated drive</span>
      </div>
    </div>
    <div class="progress-heading">
      <span>Journey progress</span
      ><strong>{{ Math.round(progress * 100) }}<small>%</small></strong>
    </div>
    <div
      class="progress-track"
      role="progressbar"
      aria-label="Journey progress"
      :aria-valuenow="Math.round(progress * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div :style="{ width: `${progress * 100}%` }" />
    </div>
    <div class="remaining">
      <span
        >{{ route ? formatDistance(remainingDistance) : "—" }} remaining</span
      ><span>{{ route ? formatDuration(remainingDuration) : "—" }} ETA</span>
    </div>
    <div v-if="route" class="route-name">
      <Flag :size="14" />{{ route.description }}
    </div>
  </section>
</template>
