import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");

const ports = [3000, 8080, 8081, 8082];

for (const port of ports) {
  const killer = spawn("npx", ["--yes", "kill-port", String(port)], {
    stdio: "inherit",
    shell: true,
  });
  await new Promise((resolve) => killer.on("exit", resolve));
}

// Let Windows release the port before Vite binds.
await sleep(800);

const vite = spawn(process.execPath, [viteBin, "dev"], { stdio: "inherit", cwd: root });
vite.on("exit", (code) => process.exit(code ?? 0));
