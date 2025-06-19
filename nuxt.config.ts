import tailwindcss from "@tailwindcss/vite";
// https://nuxt.com/docs/api/configuration/nuxt-config
const isProduction = process.env.NODE_ENV === "production";

export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  components: true,
  runtimeConfig: {
    public: {
      wsBase: isProduction
        ? "wss://maresnest.harmonylink.io" // Production URL
        : "wss://maresnest-test.harmonylink.io", // Development URL
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
    resolve: {
      alias: {
        ".prisma/client/index-browser":
          "./node_modules/.prisma/client/index-browser.js",
      },
    },
    server: {
      allowedHosts: isProduction
        ? ["maresnest.harmonylink.io"]
        : ["maresnest-test.harmonylink.io"],
    },
    plugins: [tailwindcss()],
  },
  nitro: {
    experimental: {
      websocket: true,
    },
  },
});
