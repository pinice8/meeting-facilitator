// Builds the Teams app package: dist-app/meeting-facilitator.zip (manifest.json + icons).
// Usage: PAGES_BASE_URL=https://<user>.github.io/meeting-facilitator/ npm run package
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const baseUrl = (process.env.PAGES_BASE_URL ?? "https://pinice8.github.io/meeting-facilitator/").replace(/\/?$/, "/");
const version = process.env.APP_VERSION ?? JSON.parse(readFileSync("package.json", "utf8")).version;
const manifest = readFileSync("manifest/manifest.template.json", "utf8")
  .replaceAll("{{BASE_URL}}", baseUrl)
  .replaceAll("{{HOST}}", new URL(baseUrl).host)
  .replaceAll("{{VERSION}}", version);
JSON.parse(manifest); // fail early on invalid JSON

rmSync("dist-app", { recursive: true, force: true });
mkdirSync("dist-app");
writeFileSync("dist-app/manifest.json", manifest);
copyFileSync("manifest/color.png", "dist-app/color.png");
copyFileSync("manifest/outline.png", "dist-app/outline.png");
execFileSync("zip", ["-q", "-j", "meeting-facilitator.zip", "manifest.json", "color.png", "outline.png"], { cwd: "dist-app" });
console.log(`Wrote dist-app/meeting-facilitator.zip (v${version}, ${baseUrl})`);
