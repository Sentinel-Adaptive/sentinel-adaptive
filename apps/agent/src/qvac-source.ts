import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const permittedQvacModelId = "LLAMA_3_2_1B_INST_Q4_0";
const cachedGgufName = /Llama-3\.2-1B-Instruct-Q4_0\.gguf$/i;

export function qvacOfflineRequested(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.SENTINEL_OFFLINE === "true";
}

export function qvacCacheDir(homeDir: string = os.homedir()): string {
  return path.join(homeDir, ".qvac", "models");
}

export function catalogModelUrl(registryPath: string): string {
  return `https://huggingface.co/${registryPath.replace("/blob/", "/resolve/")}`;
}

export function findCachedGguf(options: {
  explicitPath?: string;
  cacheDir?: string;
} = {}): string | undefined {
  if (options.explicitPath && existsSync(options.explicitPath)) {
    return path.resolve(options.explicitPath);
  }
  const directory = options.cacheDir ?? qvacCacheDir();
  if (!existsSync(directory)) {
    return undefined;
  }
  const match = readdirSync(directory).find((name) => cachedGgufName.test(name));
  return match ? path.join(directory, match) : undefined;
}

export function resolveQvacFallbackSrc(options: {
  registryPath: string;
  explicitPath?: string;
  cacheDir?: string;
  requireLocal: boolean;
}): string {
  const local = findCachedGguf({
    explicitPath: options.explicitPath,
    cacheDir: options.cacheDir,
  });
  if (local) {
    return local;
  }
  if (options.requireLocal) {
    throw new Error(
      "Local LLAMA_3_2_1B_INST_Q4_0 GGUF is not available. Run npm run smoke:qvac once while online to cache the model.",
    );
  }
  return catalogModelUrl(options.registryPath);
}
