<script setup lang="ts">
import "leaflet/dist/leaflet.css";
import * as L from "leaflet";
import type { Map } from "leaflet";

const mapElement = ref<HTMLDivElement | null>(null);
let map: Map | null = null;

const config = useRuntimeConfig();

interface AvatarInfo {
  id: string;
  name: string;
  displayName: string;
  image: string;
  blurHash: string;
  isStaff: boolean;
  x: number;
  y: number;
  z: number;
}

const { data } = useWebSocket(`${config.public.wsBase}/map/avatar-positions`);

const avatars = ref<AvatarInfo[]>([]);

watch(data, (newValue) => {
  try {
    const parsed = JSON.parse(newValue || "{}");
    console.log(parsed.data);
    avatars.value = parsed.data;
  } catch {
    avatars.value = [];
  }
});

const avatarLayer = L.layerGroup();
const avatarMarkers = new Map<string, L.Marker>();

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function tweenMarkerPosition(
  marker: L.Marker,
  from: L.LatLng,
  to: L.LatLng,
  duration = 400
) {
  if (from.lat === to.lat && from.lng === to.lng) return;

  const start = performance.now();

  function animate(time: number) {
    const elapsed = time - start;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(t); // Or easeOutQuad(t)

    const lat = from.lat + (to.lat - from.lat) * eased;
    const lng = from.lng + (to.lng - from.lng) * eased;

    marker.setLatLng([lat, lng]);

    if (t < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

function zoomToAvatar(avatar: AvatarInfo) {
  if (!map) return;

  const latlng = L.latLng(avatar.y, avatar.x);
  map.setView(latlng, 3, {
    animate: true,
    duration: 0.5,
  });

  const marker = avatarMarkers.get(avatar.id);
  if (marker) {
    marker.openPopup();
  }
}

watch(avatars, (newAvatars) => {
  if (!map) return;

  const activeIds = new Set<string>();

  for (const avatar of newAvatars) {
    activeIds.add(avatar.id);
    const latlng = L.latLng(avatar.y, avatar.x);

    let marker = avatarMarkers.get(avatar.id);

    if (marker) {
      const currentPos = marker.getLatLng();

      if (currentPos.lat !== latlng.lat || currentPos.lng !== latlng.lng) {
        tweenMarkerPosition(marker, currentPos, latlng, 2000); // 2s animation
      }
    } else {
      // Create a new marker

      const iconUrl = avatar.image || "/images/avatar-placeholder.jpg";
      marker = L.marker(latlng, {
        icon: L.icon({
          iconUrl,
          iconSize: [32, 32],
          className: "avatar-icon",
        }),
      }).bindPopup(
        `${avatar.displayName}<br/><a href="secondlife://THE%20MARES%20NEST/${avatar.x}/${avatar.y}/${avatar.z}">Teleport</>`,
        {
          direction: "top",
        }
      );

      avatarMarkers.set(avatar.id, marker);
      avatarLayer.addLayer(marker);
    }
  }

  // Remove any markers not in the new data
  for (const [id, marker] of avatarMarkers.entries()) {
    if (!activeIds.has(id)) {
      avatarLayer.removeLayer(marker);
      avatarMarkers.delete(id);
    }
  }
});

onMounted(async () => {
  await nextTick();
  if (!mapElement.value) return;

  map = L.map(mapElement.value, {
    crs: L.CRS.Simple,
    minZoom: 1,
    maxZoom: 4,
    attributionControl: false,
  });

  const bounds = [
    [0, 0],
    [256, 256],
  ];

  const mapImg =
    "https://secondlife-maps-cdn.akamaized.net/map-1-1005-1101-objects.jpg";
  L.imageOverlay(mapImg, bounds).addTo(map);

  map.setMaxBounds(bounds);
  map.fitBounds(bounds);

  map.addLayer(avatarLayer);
});
</script>
<template>
  <div>
    <p class="mb-2 text-center">Members in region: {{ avatars.length }}</p>
    <div style="height: 600px" class="mb-6">
      <div ref="mapElement" style="height: 100%; width: 100%" />
    </div>
    <p class="text-2xl">Online Members:</p>
    <div
      class="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <div
        v-for="avatar in avatars"
        :key="avatar.id"
        class="bg-slate-400/15 rounded-xl p-1 flex items-center duration-200 hover:bg-slate-400/30 cursor-pointer"
        @click="zoomToAvatar(avatar)"
      >
        <BlurHashImage
          :hash="avatar.blurHash"
          :image="avatar.image || '/images/avatar-placeholder.jpg'"
          decode-width="4"
          decode-height="3"
          class="w-14 h-14 rounded-lg"
        />
        <div class="px-4">
          <p>{{ avatar.displayName }}</p>
          <p v-if="avatar.isStaff" class="text-xs text-yellow-200">Staff</p>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.leaflet-container {
  background-color: #08174e;
  border-radius: 1rem;
}
:deep(.avatar-icon) {
  border-radius: 50%;
  /* border: 2px solid white; */
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
}
</style>
