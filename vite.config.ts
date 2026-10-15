import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) throw new Error('Missing public Supabase build configuration');
  }
  return ({
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
});
});
