import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DatasetLookupError,
  discoverQueryFiles,
  resolveConfiguredDatasetPath,
  resolveExistingDatasetRoot,
} from "./files.js";

function makeDataset(rootName: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), rootName));
  const nested = path.join(directory, "LogsDNSQueries");
  mkdirSync(nested);
  writeFileSync(path.join(nested, "queries.0"), "query 0\n");
  writeFileSync(path.join(nested, "queries.1"), "query 1\n");
  return directory;
}

describe("challenge dataset discovery", () => {
  it("walks a nested LogsDNSQueries folder", () => {
    const parent = makeDataset("sentinel-dataset-nested-");
    const files = discoverQueryFiles(parent);
    expect(files.map((file) => path.basename(file))).toEqual([
      "queries.0",
      "queries.1",
    ]);
    expect(resolveExistingDatasetRoot(parent)).toBe(parent);
  });

  it("resolves OVNICOM_DATASET_PATH when the request path is empty", () => {
    const parent = makeDataset("sentinel-dataset-env-");
    const previous = process.env.OVNICOM_DATASET_PATH;
    process.env.OVNICOM_DATASET_PATH = parent;
    try {
      expect(resolveConfiguredDatasetPath(undefined, tmpdir())).toBe(parent);
    } finally {
      if (previous === undefined) {
        delete process.env.OVNICOM_DATASET_PATH;
      } else {
        process.env.OVNICOM_DATASET_PATH = previous;
      }
    }
  });

  it("throws a lookup error when no queries.* files exist", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "sentinel-dataset-empty-"));
    expect(() => resolveExistingDatasetRoot(directory)).toThrow(DatasetLookupError);
    try {
      resolveExistingDatasetRoot(directory);
    } catch (error) {
      expect(error).toBeInstanceOf(DatasetLookupError);
      expect((error as DatasetLookupError).code).toBe("queries_not_found");
    }
  });
});
