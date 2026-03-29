import { defineConfig, Plugin } from "vite";
import fs from "fs";
import path from "path";

const buildVersion = Date.now().toString();

function versionPlugin(): Plugin {
  return {
    name: "version-json",
    writeBundle(options) {
      const outDir = options.dir || "dist";
      fs.writeFileSync(
        path.resolve(outDir, "version.json"),
        JSON.stringify({ version: buildVersion })
      );
    },
  };
}

export default defineConfig({
  plugins: [versionPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion),
  },
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
      "@chat-roguelike/shared": "../shared/src/index.ts",
    },
  },
});
