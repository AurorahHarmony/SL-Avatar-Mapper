<script setup lang="ts">
interface AvatarInfo {
  id: string;
  name: string;
  displayName: string;
  image: string;
  x: number;
  y: number;
  z: number;
}

const { data } = useWebSocket(`wss://${location.host}/map/avatar-positions`);

const avatars = computed<AvatarInfo[]>(() => {
  try {
    const parsed = JSON.parse(data.value || "{}");
    console.log(parsed.data);

    return parsed.data;
  } catch {
    return [];
  }
});
</script>
<template>
  <div>
    <h2>Avatar Positions</h2>
    <p>Members in region: {{ avatars.length }}</p>
    <ul>
      <li v-for="a in avatars" :key="a.id">
        <img style="height: 50px; border-radius: 100%" :src="a.image" />
        {{ a.displayName }} at ({{ a.x }}, {{ a.y }}, {{ a.z }})
      </li>
    </ul>
  </div>
</template>
