import tailwindcss from "@tailwindcss/vite";
// https://nuxt.com/docs/api/configuration/nuxt-config
const isProduction = process.env.NODE_ENV === "production";

export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  components: true,
  runtimeConfig: {
    public: {
      wsBase: "wss://maresnest-test.harmonylink.io",
    },
  },
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  modules: [
    "@nuxt/eslint",
    "@nuxt/test-utils",
    "@nuxt/fonts",
    "@vueuse/nuxt",
    "@prisma/nuxt",
  ],
  vite: {
    server: {
      allowedHosts: isProduction ? [] : ["maresnest-test.harmonylink.io"],
    },
    plugins: [tailwindcss()],
  },
  nitro: {
    experimental: {
      websocket: true,
    },
  },
});
