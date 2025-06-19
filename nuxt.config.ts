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
  modules: ["@nuxt/eslint", "@nuxt/test-utils", "@nuxt/fonts", "@vueuse/nuxt"],
  vite: {
    server: {
      allowedHosts: isProduction ? [] : ["maresnest-test.harmonylink.io"],
    },
  },
  nitro: {
    experimental: {
      websocket: true,
    },
  },
});
