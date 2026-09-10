import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const skippedDirectories = new Set([
  ".cursor",
  ".git",
  ".local-ai",
  "coverage",
  "dist",
  "docs",
  "node_modules",
]);

const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const forbiddenPackages = new Set([
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "@google/genai",
  "@huggingface/inference",
  "anthropic",
  "fireworks-ai",
  "groq-sdk",
  "openai",
  "replicate",
  "together-ai",
]);

const forbiddenContent = [
  {
    label: "cloud inference endpoint",
    pattern:
      /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.groq\.com|api\.together\.xyz|api\.fireworks\.ai|api\.replicate\.com|api-inference\.huggingface\.co/i,
  },
  {
    label: "cloud AI credential",
    pattern:
      /\b(?:OPENAI|ANTHROPIC|GEMINI|GROQ|TOGETHER|FIREWORKS)_API_KEY\b|\bREPLICATE_API_TOKEN\b|\bHUGGINGFACEHUB_API_TOKEN\b/i,
  },
  {
    label: "removed QVAC provider or DHT API",
    pattern: /\b(?:startQVACProvider|stopQVACProvider)\b|\.delegate\s*\(/,
  },
];

const sourceExtensions = new Set([
  ".cjs",
  ".js",
  ".json",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

const failures = [];
const files = await collectFiles(root);
const manifests = files.filter((file) => path.basename(file) === "package.json");
const qvacVersions = new Map();

for (const manifestPath of manifests) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  for (const section of dependencySections) {
    const dependencies = manifest[section] ?? {};

    for (const [name, version] of Object.entries(dependencies)) {
      const normalizedName = name.toLowerCase();

      if (forbiddenPackages.has(normalizedName)) {
        failures.push(
          `${relative(manifestPath)}: forbidden package '${name}' in ${section}`,
        );
      }

      if (name === "@qvac/sdk" || name === "@qvac/inference") {
        qvacVersions.set(name, version);
      }
    }
  }
}

for (const qvacPackage of ["@qvac/sdk", "@qvac/inference"]) {
  if (qvacVersions.get(qvacPackage) !== "0.19.0") {
    failures.push(`${qvacPackage} must be pinned exactly to 0.19.0`);
  }
}

for (const file of files) {
  const relativePath = relative(file);
  const isEnvironmentExample = path.basename(file) === ".env.example";
  const shouldScan =
    sourceExtensions.has(path.extname(file)) || isEnvironmentExample;

  if (
    !shouldScan ||
    relativePath === "scripts/verify-compliance.mjs" ||
    path.basename(file) === "package-lock.json"
  ) {
    continue;
  }

  const content = await readFile(file, "utf8");

  for (const rule of forbiddenContent) {
    if (rule.pattern.test(content)) {
      failures.push(`${relativePath}: contains ${rule.label}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Sentinel compliance check: FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("Sentinel compliance check: PASS");
  console.log(`Checked ${manifests.length} package manifests.`);
  console.log("QVAC dependencies: pinned to 0.19.0.");
  console.log("Cloud AI dependencies, credentials, and endpoints: none found.");
}
