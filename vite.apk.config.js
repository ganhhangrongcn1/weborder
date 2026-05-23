import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "android-pos-printer/app/src/main/assets/kitchen",
    emptyOutDir: true,
    target: "es2020",
    minify: false
  },
  define: {
    "import.meta.env.VITE_APK_BUNDLE": JSON.stringify("true")
  }
});
