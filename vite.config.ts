import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_ORIGIN || "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
