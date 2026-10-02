import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  build: {
    rollupOptions: { output: { manualChunks: (id: string) => { if (id.includes("node_modules")) { if (id.includes("recharts") || id.includes("d3-")) return "charts"; if (id.includes("@supabase")) return "supabase"; if (/\/(react|react-dom|react-router|react-router-dom)\//.test(id)) return "react"; } } } },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
}));
