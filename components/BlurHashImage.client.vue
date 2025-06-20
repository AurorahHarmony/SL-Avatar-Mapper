<script setup lang="ts">
import { decode } from "blurhash";

const props = defineProps<{
  hash: string;
  image: string;
  decodeWidth: number;
  decodeHeight: number;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const imageLoaded = ref(false);

const punch = 1;

const drawBlurHash = () => {
  if (!canvasRef.value || !props.hash) return;
  const ctx = canvasRef.value.getContext("2d");
  if (!ctx) return;

  try {
    const pixels = decode(
      props.hash,
      props.decodeWidth,
      props.decodeHeight,
      punch
    );
    const imageData = ctx.createImageData(
      props.decodeWidth,
      props.decodeHeight
    );
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
  } catch (err) {
    console.warn("❌ Failed to decode blurhash:", err);
  }
};
onMounted(() => {
  if (props.hash) drawBlurHash();
});
watch(
  () => props.hash,
  () => {
    if (props.hash) drawBlurHash();
  }
);
</script>
<template>
  <div class="relative overflow-hidden">
    <canvas
      v-if="hash"
      ref="canvasRef"
      class="absolute inset w-full h-full object-cover"
      :width="decodeWidth"
      :height="decodeHeight"
    />
    <img
      v-if="image"
      :src="image"
      class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
      :class="{ 'opacity-100': imageLoaded, 'opacity-0': !imageLoaded }"
      @load="imageLoaded = true"
    />
  </div>
</template>
