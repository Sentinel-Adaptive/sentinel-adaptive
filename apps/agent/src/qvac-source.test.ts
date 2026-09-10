import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  catalogModelUrl,
  findCachedGguf,
  qvacOfflineRequested,
  resolveQvacFallbackSrc,
} from "./qvac-source.js";

describe("QVAC local weight resolution", () => {
  it("prefers a cached GGUF over the catalog HTTPS URL", () => {
    const cacheDir = path.join(
      os.tmpdir(),
      `sentinel-qvac-cache-${process.pid}-${Date.now()}`,
    );
    mkdirSync(cacheDir, { recursive: true });
    const gguf = path.join(cacheDir, "f2bade0bc5cd4a8c_Llama-3.2-1B-Instruct-Q4_0.gguf");
    writeFileSync(gguf, "");

    expect(
      resolveQvacFallbackSrc({
        registryPath: "org/repo/blob/main/model.gguf",
        cacheDir,
        requireLocal: false,
      }),
    ).toBe(gguf);
    expect(findCachedGguf({ cacheDir })).toBe(gguf);
  });

  it("refuses HTTPS fallback when offline proof requires local weights", () => {
    expect(qvacOfflineRequested({ SENTINEL_OFFLINE: "true" })).toBe(true);
    expect(() =>
      resolveQvacFallbackSrc({
        registryPath: "org/repo/blob/main/model.gguf",
        cacheDir: path.join(os.tmpdir(), "sentinel-qvac-missing"),
        requireLocal: true,
      }),
    ).toThrow(/Local LLAMA_3_2_1B_INST_Q4_0 GGUF is not available/);
  });

  it("uses the catalog URL only when no local file exists", () => {
    expect(
      resolveQvacFallbackSrc({
        registryPath: "org/repo/blob/main/model.gguf",
        cacheDir: path.join(os.tmpdir(), "sentinel-qvac-missing"),
        requireLocal: false,
      }),
    ).toBe(catalogModelUrl("org/repo/blob/main/model.gguf"));
  });
});
