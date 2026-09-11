import { describe, expect, it } from "vitest";

import { DatasetLookupError } from "@sentinel-adaptive/ovnicom-replay";

import { classifySimulationError } from "./jobs.js";

describe("simulation operator errors", () => {
  it("maps dataset and Kafka failures without exposing stacks", () => {
    expect(classifySimulationError(new DatasetLookupError("dataset_not_found"))).toBe(
      "dataset_not_found",
    );
    expect(classifySimulationError(new DatasetLookupError("queries_not_found"))).toBe(
      "queries_not_found",
    );
    expect(classifySimulationError(new Error("Connection timeout"))).toBe(
      "kafka_unavailable",
    );
    expect(classifySimulationError(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }))).toBe(
      "kafka_unavailable",
    );
    expect(classifySimulationError(new Error("ENOENT: no such file or directory"))).toBe(
      "dataset_not_found",
    );
    expect(classifySimulationError(new Error("Publish interval must be a non-negative integer."))).toBe(
      "generator_failed",
    );
  });
});
