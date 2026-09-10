import { spawn } from "node:child_process";
import { existsSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const probeUrl = "https://example.com";
const firewallScript = path.join(root, "scripts", "windows-offline-net.ps1");
const blockedPrograms = collectBlockedPrograms();
let isolationEnabled = false;

try {
  const compliance = await runCommand(process.execPath, [
    path.join(root, "scripts", "verify-compliance.mjs"),
  ]);
  if (compliance !== 0) {
    throw new Error("Compliance check failed.");
  }
  console.log("Compliance  PASS");

  const gguf = findCachedGguf();
  if (!gguf) {
    throw new Error(
      "Local LLAMA_3_2_1B_INST_Q4_0 GGUF is not available. Run npm run smoke:qvac once while online.",
    );
  }
  console.log(`Weights     PASS (${gguf})`);

  await enableOutboundIsolation();
  isolationEnabled = true;

  await assertPublicHttpsBlocked();
  console.log(`Isolation   PASS (${probeUrl} unreachable)`);

  const smoke = await runCommand(
    process.execPath,
    [
      path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
      "--disable-warning=TimeoutNegativeWarning",
      path.join(root, "apps", "agent", "src", "offline-smoke.ts"),
    ],
    {
      cwd: path.join(root, "apps", "agent"),
      env: {
        ...process.env,
        SENTINEL_OFFLINE: "true",
        QVAC_LOCAL_ONLY: "true",
      },
    },
  );
  if (smoke !== 0) {
    throw new Error("Live offline QVAC assessment failed.");
  }
  console.log("Offline QVAC proof: PASS");
} catch (error) {
  console.error("Offline QVAC proof: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (isolationEnabled) {
    await disableOutboundIsolation().catch((error) => {
      console.error(
        "WARNING: Stage 9 firewall rules may still be active. Run scripts/windows-offline-net.ps1 -Action remove",
      );
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  }
}

function collectBlockedPrograms() {
  const programs = [process.execPath];
  const platformBare = {
    "win32-x64": path.join(root, "node_modules", "bare-runtime-win32-x64", "bin", "bare.exe"),
    "win32-arm64": path.join(root, "node_modules", "bare-runtime-win32-arm64", "bin", "bare.exe"),
    "linux-x64": path.join(root, "node_modules", "bare-runtime-linux-x64", "bin", "bare"),
    "linux-arm64": path.join(root, "node_modules", "bare-runtime-linux-arm64", "bin", "bare"),
    "darwin-x64": path.join(root, "node_modules", "bare-runtime-darwin-x64", "bin", "bare"),
    "darwin-arm64": path.join(root, "node_modules", "bare-runtime-darwin-arm64", "bin", "bare"),
  };
  const bare = platformBare[`${process.platform}-${process.arch}`];
  if (bare && existsSync(bare)) {
    programs.push(bare);
  }
  return programs;
}

function findCachedGguf() {
  if (process.env.QVAC_MODEL_PATH && existsSync(process.env.QVAC_MODEL_PATH)) {
    return path.resolve(process.env.QVAC_MODEL_PATH);
  }
  const directory = path.join(os.homedir(), ".qvac", "models");
  if (!existsSync(directory)) {
    return undefined;
  }
  const match = readdirSync(directory).find((name) =>
    /Llama-3\.2-1B-Instruct-Q4_0\.gguf$/i.test(name),
  );
  return match ? path.join(directory, match) : undefined;
}

async function assertPublicHttpsBlocked() {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("offline-probe-timeout")), 4000);
  });
  try {
    const response = await Promise.race([fetch(probeUrl), timeout]);
    throw new Error(
      `Expected ${probeUrl} to be unreachable after outbound isolation, got HTTP ${response.status}.`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Expected ")) {
      throw error;
    }
  }
}

async function enableOutboundIsolation() {
  if (process.platform === "win32") {
    await runFirewall("add");
    return;
  }
  throw new Error(
    "Outbound isolation is implemented for Windows Firewall on this host. Re-run on Windows or add a Linux/macOS isolator.",
  );
}

async function disableOutboundIsolation() {
  if (process.platform === "win32") {
    await runFirewall("remove");
  }
}

async function runFirewall(action) {
  const requestPath = path.join(
    os.tmpdir(),
    `sentinel-stage9-${process.pid}-${action}.json`,
  );
  writeFileSync(
    requestPath,
    JSON.stringify({ Action: action, Programs: blockedPrograms }),
  );
  try {
    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      firewallScript,
      "-RequestPath",
      requestPath,
    ];
    let code = await runCommand("powershell", args);
    if (code === 2) {
      const argumentList = args
        .map((value) => `'${value.replaceAll("'", "''")}'`)
        .join(",");
      code = await runCommand("powershell", [
        "-NoProfile",
        "-Command",
        [
          `$p = Start-Process -FilePath powershell -Verb RunAs -Wait -PassThru -ArgumentList @(${argumentList})`,
          "if ($null -eq $p) { exit 2 }",
          "exit $p.ExitCode",
        ].join("; "),
      ]);
    }
    if (code === 2) {
      throw new Error(
        "Administrator rights are required to disable outbound internet. Approve the UAC prompt or re-run this terminal as Administrator.",
      );
    }
    if (code !== 0) {
      throw new Error(`Windows offline firewall ${action} failed with exit ${code}.`);
    }
  } finally {
    try {
      unlinkSync(requestPath);
    } catch {
      // The request file is only a firewall argument payload.
    }
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
