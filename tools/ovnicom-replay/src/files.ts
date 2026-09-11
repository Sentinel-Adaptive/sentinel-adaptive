import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const QUERY_FILE = /^queries\.\d+$/;
export const DEFAULT_DATASET_RELATIVE_PATH = "data/ovnicom/LogsDNSQueries";
const NESTED_DATASET_FOLDER = "LogsDNSQueries";

export type DatasetLookupCode = "dataset_not_found" | "queries_not_found";

export class DatasetLookupError extends Error {
  constructor(readonly code: DatasetLookupCode) {
    super(code);
    this.name = "DatasetLookupError";
  }
}

export function discoverQueryFiles(rootPath: string): string[] {
  const resolved = path.resolve(rootPath);
  const stats = statSync(resolved);

  if (stats.isFile()) {
    return [resolved];
  }
  if (!stats.isDirectory()) {
    throw new DatasetLookupError("queries_not_found");
  }

  const files: string[] = [];
  collectQueryFiles(resolved, files);
  files.sort(compareQueryFiles);
  return files;
}

export function resolveConfiguredDatasetPath(
  input: string | undefined,
  repoRoot: string,
): string {
  const candidates: string[] = [];
  const trimmed = input?.trim() ?? "";
  if (trimmed.length > 0) {
    candidates.push(resolveMaybeRelative(trimmed, repoRoot));
  }
  const fromEnv = process.env.OVNICOM_DATASET_PATH?.trim() ?? "";
  if (fromEnv.length > 0) {
    candidates.push(resolveMaybeRelative(fromEnv, repoRoot));
  }
  candidates.push(path.resolve(repoRoot, DEFAULT_DATASET_RELATIVE_PATH));

  const seen = new Set<string>();
  let lastError: DatasetLookupError | undefined;
  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    try {
      return resolveExistingDatasetRoot(candidate);
    } catch (error) {
      if (error instanceof DatasetLookupError) {
        lastError = error;
      } else {
        lastError = new DatasetLookupError("dataset_not_found");
      }
    }
  }

  throw lastError ?? new DatasetLookupError("dataset_not_found");
}

export function resolveExistingDatasetRoot(rootPath: string): string {
  const resolved = path.resolve(rootPath);
  if (!existsSync(resolved)) {
    throw new DatasetLookupError("dataset_not_found");
  }

  const stats = statSync(resolved);
  if (stats.isFile()) {
    return resolved;
  }
  if (!stats.isDirectory()) {
    throw new DatasetLookupError("queries_not_found");
  }

  if (discoverQueryFiles(resolved).length > 0) {
    return resolved;
  }

  const nested = path.join(resolved, NESTED_DATASET_FOLDER);
  if (existsSync(nested) && discoverQueryFiles(nested).length > 0) {
    return nested;
  }

  throw new DatasetLookupError("queries_not_found");
}

function resolveMaybeRelative(value: string, repoRoot: string): string {
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(repoRoot, value);
}

function collectQueryFiles(directory: string, files: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "__MACOSX" || entry.name === ".DS_Store") {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectQueryFiles(fullPath, files);
    } else if (entry.isFile() && QUERY_FILE.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

function compareQueryFiles(left: string, right: string): number {
  const leftName = path.basename(left);
  const rightName = path.basename(right);
  const leftMatch = /^queries\.(\d+)$/.exec(leftName);
  const rightMatch = /^queries\.(\d+)$/.exec(rightName);

  if (leftMatch && rightMatch) {
    const byNumber = Number(leftMatch[1]) - Number(rightMatch[1]);
    if (byNumber !== 0) {
      return byNumber;
    }
  }

  return leftName.localeCompare(rightName);
}
