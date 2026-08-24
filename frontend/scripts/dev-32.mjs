import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, "..");
const nextBin = require.resolve("next/dist/bin/next");

// Una cache PackFile gia creata da Webpack puo essere molto grande o
// incompleta dopo un crash. La rimuoviamo prima dell'avvio low-memory.
const cacheDir = path.join(frontendDir, ".next", "cache");
try {
  fs.rmSync(cacheDir, { recursive: true, force: true });
} catch (error) {
  console.warn(`[VITALE] Impossibile pulire ${cacheDir}: ${error.message}`);
}

// Evita che un NODE_OPTIONS precedente (es. 4096/6144 MB) venga ereditato
// su un processo Node 32-bit. Manteniamo eventuali altre opzioni valide.
const previousNodeOptions = process.env.NODE_OPTIONS ?? "";
const sanitizedNodeOptions = previousNodeOptions
  .replace(/--max-old-space-size(?:=|\s+)\d+/g, "")
  .replace(/--max_old_space_size(?:=|\s+)\d+/g, "")
  .trim();

const nodeOptions = [sanitizedNodeOptions, "--max-old-space-size=768"]
  .filter(Boolean)
  .join(" ");

console.log(`[VITALE] Node arch: ${process.arch}`);
console.log("[VITALE] Avvio frontend low-memory su http://localhost:4000");
console.log("[VITALE] Heap massimo richiesto: 768 MB");
console.log("[VITALE] Cache Webpack PackFile: disabilitata");

const child = spawn(process.execPath, [nextBin, "dev", "-p", "4000"], {
  cwd: frontendDir,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
    VITALE_LOW_MEMORY: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
