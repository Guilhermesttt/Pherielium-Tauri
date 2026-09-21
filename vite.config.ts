import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
        pure_funcs: ["console.log", "console.debug", "console.info"],
      },
    },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        overlay: path.resolve(__dirname, "overlay.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@supabase")) return "supabase-vendor";
            if (
              id.includes("framer-motion") ||
              id.includes("lucide-react") ||
              id.includes("@radix-ui")
            ) return "ui-vendor";
          }
        },
      },
    },
  },
  // Tauri requires a specific dev server configuration
  server: {
    host: host || "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**", "**/release/**", "**/dist/**", "**/.git/**"],
    },
    proxy: {
      "/api": {
        target: "https://checkpoint-launcher.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/auth": {
        target: "https://checkpoint-launcher.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/health": {
        target: "https://checkpoint-launcher.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/rum": {
        target: "https://checkpoint-launcher.onrender.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  preview: {
    port: 1421,
  },
});
