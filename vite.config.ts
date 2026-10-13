import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const page = (name: string) => fileURLToPath(new URL(name, import.meta.url));

const pkg = JSON.parse(readFileSync(page("package.json"), "utf8")) as { version: string };
// Changes on every build; the page compares it with version.json to notice it is stale.
const buildId = Date.now().toString(36);

function emitVersionFile() {
  return {
    name: "emit-version-file",
    generateBundle(this: { emitFile: (file: { type: "asset"; fileName: string; source: string }) => void }) {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: buildId }) });
    },
  };
}

// Served from https://<user>.github.io/meeting-facilitator/ in production.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/meeting-facilitator/" : "/",
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), nodePolyfills({ globals: { Buffer: true, global: true, process: true } }), emitVersionFile()],
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
