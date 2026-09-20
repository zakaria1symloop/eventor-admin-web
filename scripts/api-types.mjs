// Generates src/lib/api/schema.d.ts from the backend's committed openapi.json.
// Usage: pnpm api:types [path-or-url]   (default: ../backend/openapi.json)
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const source = process.argv[2] ?? resolve(import.meta.dirname, "../../backend/openapi.json");
const output = resolve(import.meta.dirname, "../src/lib/api/schema.d.ts");

if (!/^https?:\/\//.test(source) && !existsSync(source)) {
  console.warn(`[api:types] ${source} not found — keeping the placeholder schema.d.ts.`);
  console.warn(
    "[api:types] Run `pnpm spec:export` in the backend first, or pass a URL to /api/v1/docs-json.",
  );
  process.exit(0);
}

const bin = resolve(import.meta.dirname, "../node_modules/.bin/openapi-typescript");
// Quote for the Windows shell (paths may contain spaces).
const q = (v) => (process.platform === "win32" ? `"${v}"` : v);
const result = spawnSync(q(bin), [q(source), "-o", q(output)], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
