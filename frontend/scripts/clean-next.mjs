import fs from "node:fs";
import path from "node:path";

const target = path.resolve(process.cwd(), ".next");
fs.rmSync(target, { recursive: true, force: true });
console.log(`[VITALE] Cache/build Next.js rimossa: ${target}`);
