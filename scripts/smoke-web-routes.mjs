import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(root, "apps", "web");
const previewUrl = "http://127.0.0.1:4173";
const routes = [
  "/",
  "/incidents",
  "/incidents/INC-0000000000000000",
  "/sites/PTY-BANK-01",
  "/system",
];

const preview = spawn(
  process.execPath,
  [
    path.join(root, "node_modules", "vite", "bin", "vite.js"),
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4173",
    "--strictPort",
  ],
  {
    cwd: webRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  },
);

preview.stdout.on("data", (chunk) => process.stdout.write(chunk));
preview.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  await waitUntilReady();
  for (const route of routes) {
    const response = await fetch(`${previewUrl}${route}`);
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`${route} -> ${response.status}`);
    }
    if (!body.includes("Sentinel Adaptive") && !body.includes('id="root"')) {
      throw new Error(`${route} did not return the operator shell.`);
    }
    console.log(`Route ${route}  PASS`);
  }
} catch (error) {
  console.error("Operator web route smoke: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await stopPreview(preview.pid);
}

async function waitUntilReady(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "vite preview did not become ready";
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) {
      throw new Error(`vite preview exited with code ${preview.exitCode}`);
    }
    try {
      const response = await fetch(previewUrl);
      if (response.ok) {
        return;
      }
      lastError = `preview returned ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(200);
  }
  throw new Error(lastError);
}

function stopPreview(pid) {
  if (pid === undefined) {
    return Promise.resolve();
  }
  if (process.platform === "win32") {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
    });
  }
  preview.kill("SIGTERM");
  return Promise.resolve();
}
