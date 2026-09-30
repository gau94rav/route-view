<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
defineProps<{ mode: "car" | "bike" }>();
const compact = ref(false);
let framingObserver: ResizeObserver | undefined;
const syncFraming = () => {
  compact.value = document.documentElement.clientWidth <= 699;
};
onMounted(() => {
  syncFraming();
  framingObserver = new ResizeObserver(syncFraming);
  framingObserver.observe(document.documentElement);
});
onBeforeUnmount(() => framingObserver?.disconnect());
</script>

<template>
  <div
    class="vehicle-cockpit"
    :class="`vehicle-cockpit--${mode}`"
    aria-hidden="true"
  >
    <svg
      v-if="mode === 'car'"
      :viewBox="compact ? '60 0 356 400' : '0 0 1000 400'"
      :preserveAspectRatio="compact ? 'xMidYMin slice' : 'xMinYMin slice'"
    >
      <defs>
        <linearGradient id="car-dash" x2="0" y2="1">
          <stop stop-color="#454e50" />
          <stop offset=".3" stop-color="#20292c" />
          <stop offset="1" stop-color="#10191d" />
        </linearGradient>
        <linearGradient id="car-metal" x2="0" y2="1">
          <stop stop-color="#a2b2b4" />
          <stop offset="1" stop-color="#394a50" />
        </linearGradient>
      </defs>
      <!-- Dashboard and windshield sill, illustrated independently of Google imagery. -->
      <path d="M0 0 Q500 38 1000 0 V400 H0Z" fill="url(#car-dash)" />
      <path
        d="M0 12 Q500 54 1000 12"
        fill="none"
        stroke="#758183"
        stroke-width="3"
      />
      <path
        d="M0 68 Q500 96 1000 68"
        fill="none"
        stroke="#0b1519"
        stroke-width="14"
      />
      <rect
        x="95"
        y="65"
        width="290"
        height="110"
        rx="48"
        fill="#091317"
        stroke="#536469"
        stroke-width="4"
      />
      <g fill="#10282e" stroke="#597d7c" stroke-width="2">
        <circle cx="180" cy="117" r="39" />
        <circle cx="297" cy="117" r="39" />
      </g>
      <g fill="none" stroke="#a5cbc2" stroke-width="4" stroke-dasharray="2 13">
        <circle cx="180" cy="117" r="31" />
        <circle cx="297" cy="117" r="31" />
      </g>
      <g stroke="#dfede5" stroke-width="3">
        <path d="M180 117l-20-15M297 117l17-19" />
      </g>
      <rect
        x="462"
        y="91"
        width="153"
        height="82"
        rx="9"
        fill="#0a191d"
        stroke="#516168"
        stroke-width="3"
      />
      <path
        d="M474 132h31l19-21 24 38 17-18h35"
        fill="none"
        stroke="#8dbaaa"
        stroke-width="2"
      />
      <g stroke="#071215" stroke-width="7">
        <path d="M683 91h179M683 105h179M683 119h179" />
      </g>
      <path
        d="M447 196h182l35 204H407Z"
        fill="#172227"
        stroke="#3b4c51"
        stroke-width="3"
      />
      <g fill="#4b5e62">
        <circle cx="478" cy="209" r="13" />
        <circle cx="596" cy="209" r="13" />
      </g>
      <circle
        cx="238"
        cy="239"
        r="105"
        fill="none"
        stroke="#080f12"
        stroke-width="35"
      />
      <circle
        cx="238"
        cy="239"
        r="105"
        fill="none"
        stroke="#56656a"
        stroke-width="2"
      />
      <path d="M143 219l80 17 15 109 19-109 78-17" fill="url(#car-metal)" />
      <ellipse
        cx="238"
        cy="238"
        rx="48"
        ry="35"
        fill="#233237"
        stroke="#607278"
        stroke-width="2"
      />
      <path d="M224 238h28" stroke="#a3c1b6" stroke-width="3" />
    </svg>
    <svg v-else viewBox="70 0 860 355" preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id="bike-tank" x2="0" y2="1">
          <stop stop-color="#365956" />
          <stop offset="1" stop-color="#102629" />
        </linearGradient>
      </defs>
      <g transform="translate(0 55)">
        <path
          d="M347 300q20-195 153-195t153 195"
          fill="url(#bike-tank)"
          stroke="#74958c"
          stroke-width="3"
        />
        <ellipse
          cx="500"
          cy="170"
          rx="32"
          ry="17"
          fill="#536b6c"
          stroke="#a2b4ae"
          stroke-width="3"
        />
        <path
          d="M217 59l102 44 181 19 181-19 102-44"
          fill="none"
          stroke="#0c1a1e"
          stroke-width="25"
          stroke-linejoin="round"
        />
        <path
          d="M217 56l102 44 181 19 181-19 102-44"
          fill="none"
          stroke="#849a9b"
          stroke-width="8"
          stroke-linejoin="round"
        />
        <g fill="#14252a" stroke="#627d7e" stroke-width="3">
          <rect
            x="131"
            y="40"
            width="107"
            height="35"
            rx="12"
            transform="rotate(14 185 57)"
          />
          <rect
            x="762"
            y="40"
            width="107"
            height="35"
            rx="12"
            transform="rotate(-14 815 57)"
          />
          <circle cx="500" cy="69" r="53" />
        </g>
        <circle
          cx="500"
          cy="69"
          r="40"
          fill="#09232a"
          stroke="#96b8ad"
          stroke-width="2"
        />
        <circle
          cx="500"
          cy="69"
          r="32"
          fill="none"
          stroke="#bdd8ce"
          stroke-width="4"
          stroke-dasharray="2 11"
        />
        <path d="M500 69l20-20" stroke="#d2ebe1" stroke-width="3" />
        <g fill="none" stroke="#758d8e" stroke-width="6">
          <path d="M249 74L199 9M751 74L801 9" />
        </g>
        <g fill="#aac3bc" stroke="#1b3035" stroke-width="6">
          <ellipse cx="178" cy="4" rx="55" ry="22" />
          <ellipse cx="822" cy="4" rx="55" ry="22" />
        </g>
      </g>
    </svg>
    <span class="cockpit-caption"
      >{{ mode === "car" ? "CAR" : "BIKE" }} · ILLUSTRATED COCKPIT</span
    >
  </div>
</template>
