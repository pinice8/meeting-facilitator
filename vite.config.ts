import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { fileURLToPath } from "node:url";

const page = (name: string) => fileURLToPath(new URL(name, import.meta.url));

// Served from https://<user>.github.io/meeting-facilitator/ in production.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/meeting-facilitator/" : "/",
  plugins: [react(), nodePolyfills({ globals: { Buffer: true, global: true, process: true } })],
  build: {
    rollupOptions: {
      input: {
        main: page("index.html"),
        config: page("config.html"),
        authStart: page("auth-start.html"),
        authEnd: page("auth-end.html"),
      },
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
}));
