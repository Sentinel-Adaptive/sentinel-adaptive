import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "README.md",
  "docs/DEMO.md",
  "docs/ARCHITECTURE.md",
  "docs/COMPLIANCE.md",
  "docs/DATA.md",
  "docs/STATUS.md",
  "docs/PREEXISTING.md",
  ".env.example",
];

const forbiddenTracked = [
  { label: "private agent rules directory", pattern: /^\.local-ai\// },
  { label: "Cursor private directory", pattern: /^\.cursor\// },
  { label: "private build spec", pattern: /MASTER_BUILD_SPEC_PRIVATE/ },
  { label: "dotenv secrets file", pattern: /(^|\/)\.env$/ },
  { label: "GGUF weights", pattern: /\.gguf$/i },
];

const failures = [];

const { stdout } = await execFileAsync("git", ["ls-files", "-z"], { cwd: root });
const tracked = stdout.split("\0").filter(Boolean);

for (const relativePath of requiredFiles) {
  if (!tracked.includes(relativePath.replaceAll("\\", "/"))) {
    failures.push(`missing required public file: ${relativePath}`);
  }
}

for (const file of tracked) {
  const normalized = file.split(path.sep).join("/");
  for (const rule of forbiddenTracked) {
    if (rule.pattern.test(normalized)) {
      failures.push(`${normalized}: tracked ${rule.label}`);
    }
  }
}

const readme = await readFile(path.join(root, "README.md"), "utf8");
for (const token of [
  "Track 03",
  "Track 04",
  "@qvac/sdk 0.19.0",
  "LLAMA_3_2_1B_INST_Q4_0",
  "docs/DEMO.md",
]) {
  if (!readme.includes(token)) {
    failures.push(`README.md does not mention '${token}'`);
  }
}

if (failures.length > 0) {
  console.error("Sentinel submission check: FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("Sentinel submission check: PASS");
  console.log(`Tracked files: ${tracked.length}.`);
  console.log("Required public docs: present.");
  console.log("Private rules, dotenv secrets, and GGUF weights: not tracked.");
}
