import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  root: "frontend",
  base: command === "serve" ? "/" : "/static/dist/",
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:5050",
      "/static/uploads":
        process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:5050",
    },
  },
  build: {
    outDir: "../static/dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: ({ name }) =>
          name?.endsWith(".css") ? "assets/app.css" : "assets/[name][extname]",
      },
    },
  },
}));
