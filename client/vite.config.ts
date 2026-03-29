import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      "/colyseus": {
        target: "http://localhost:2567",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:2567",
        changeOrigin: true,
      },
      "/matchmake": {
        target: "http://localhost:2567",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      "@chat-roguelike/shared": "../shared/src",
    },
  },
});
