<script setup lang="ts"></script>
<template>
  <div class="px-2 mb-12">
    <img
      src="/regions/the-mares-nest/icon.png"
      class="max-w-2xs md:max-w-sm mx-auto mt-6 mb-6"
    />
    <Container class="text-center">
      <nav
        class="bg-[#ff189d]/50 px-4 py-2 rounded-lg text-center mx-auto inline-block mb-6"
      >
        <NuxtLink to="/" class="hover:underline font-semibold mx-2"
          >Home</NuxtLink
        >
        <NuxtLink to="/credits" class="hover:underline font-semibold mx-2"
          >Credits</NuxtLink
        >
      </nav>
    </Container>
    <slot />
  </div>
</template>
<style>
body {
  background-color: #00061e;
  color: #fff;
}
</style>
