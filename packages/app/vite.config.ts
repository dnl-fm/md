import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [solid(), wasm(), topLevelAwait()],
  
  resolve: {
    alias: {
      "@md/shared": path.resolve(__dirname, "../shared"),
    },
  },
  
  // Externalize mermaid - loaded via script tag to avoid bundling issues
  optimizeDeps: {
    exclude: ["mermaid"],
  },
  
  build: {
    target: "esnext",
    rollupOptions: {
      external: ["mermaid"],
      output: {
        globals: {
          mermaid: "mermaid",
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
