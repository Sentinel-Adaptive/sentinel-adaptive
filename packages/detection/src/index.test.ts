import { describe, expect, it } from "vitest";

import { detectionStage } from "./index.js";

describe("Stage 0 test harness", () => {
  it("loads the detection workspace", () => {
    expect(detectionStage).toBe(0);
  });
});
