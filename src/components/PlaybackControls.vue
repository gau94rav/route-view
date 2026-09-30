<script setup lang="ts">
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Map as MapIcon,
} from "@lucide/vue";
defineProps<{
  playing: boolean;
  busy: boolean;
  enabled: boolean;
  canPrevious: boolean;
  ended: boolean;
  mapVisible: boolean;
}>();
const emit = defineEmits<{
  play: [];
  pause: [];
  restart: [];
  previous: [];
  next: [];
  toggleMap: [];
}>();
</script>
<template>
  <div class="playback" aria-label="Playback controls">
    <button
      title="Restart"
      aria-label="Restart journey"
      :disabled="!enabled || busy"
      @click="emit('restart')"
    >
      <RotateCcw :size="18" />
    </button>
    <div class="control-divider" />
    <button
      aria-label="Previous view"
      title="Previous view"
      :disabled="!canPrevious || busy"
      @click="emit('previous')"
    >
      <SkipBack :size="18" /></button
    ><button
      class="play-button"
      :aria-label="playing || busy ? 'Pause' : ended ? 'Replay' : 'Play'"
      :disabled="!enabled"
      @click="playing || busy ? emit('pause') : emit('play')"
    >
      <Pause v-if="playing || busy" :size="20" fill="currentColor" /><Play
        v-else
        :size="20"
        fill="currentColor"
      /></button
    ><button
      aria-label="Next view"
      title="Next view"
      :disabled="!enabled || busy || ended"
      @click="emit('next')"
    >
      <SkipForward :size="18" />
    </button>
    <button
      :aria-label="mapVisible ? 'Hide minimap' : 'Show minimap'"
      :title="mapVisible ? 'Hide minimap' : 'Show minimap'"
      :aria-pressed="mapVisible"
      @click="emit('toggleMap')"
    >
      <MapIcon :size="18" />
    </button>
  </div>
</template>
