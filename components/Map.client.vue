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

watch(avatars, (newAvatars) => {
  if (!map) return;

  const activeIds = new Set<string>();

  for (const avatar of newAvatars) {
    activeIds.add(avatar.id);
    const latlng = L.latLng(avatar.y, avatar.x);

    let marker = avatarMarkers.get(avatar.id);

    if (marker) {
      //   marker.setLatLng(latlng); // ✨ Move marker smoothly
      const currentPos = marker.getLatLng();

      if (currentPos.lat !== latlng.lat || currentPos.lng !== latlng.lng) {
        tweenMarkerPosition(marker, currentPos, latlng, 400); // 400ms animation
      }
    } else {
      // Create a new marker
      marker = L.marker(latlng, {
        icon: L.icon({
          iconUrl: avatar.image,
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
    <h2>Avatar Positions</h2>
    <p>Members in region: {{ avatars.length }}</p>
    <div style="height: 600px">
      <div ref="mapElement" style="height: 100%; width: 100%" />
    </div>
    <ul>
      <li v-for="a in avatars" :key="a.id">
        <img
          style="height: 50px; border-radius: 100%"
          :src="a.image || '/images/avatar-placeholder.png'"
        />
        {{ a.displayName }} at ({{ a.x }}, {{ a.y }}, {{ a.z }})
      </li>
    </ul>
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
