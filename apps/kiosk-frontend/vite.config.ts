import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy orchestrator API so the frontend can fetch ephemeral tokens in dev.
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
