import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [] } },
  base: "./",
  server: { strictPort: true, proxy: { "/api/zalo": "http://127.0.0.1:5181" } },
  build: {
    target: "es2020",
    manifest: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: { output: {
      entryFileNames: "assets/[name].[hash].module.js",
      chunkFileNames: "assets/[name].[hash].module.js"
    } }
  },
});
