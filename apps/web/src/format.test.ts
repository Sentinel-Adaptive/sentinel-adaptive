import { describe, expect, it } from "vitest";

import {
  formatEnumLabel,
  formatEvidenceValue,
  formatLatencyMs,
  formatPercent,
  qvacConfidenceToken,
  qvacExplanation,
} from "./format.js";

describe("operator display formatting", () => {
  it("formats labels and units without changing source enums", () => {
    expect(formatEnumLabel("possible_c2_beaconing")).toBe("Possible C2 Beaconing");
    expect(formatPercent(0.82)).toBe("82%");
    expect(formatLatencyMs(36.16642105263156)).toBe("36.17 ms");
    expect(formatLatencyMs(104.55)).toBe("104.55 ms");
    expect(formatEvidenceValue("nxdomainRatio", 0.82)).toBe("82%");
    expect(formatEvidenceValue("latencyP95", 36.16642105263156)).toBe("36.17 ms");
    expect(formatEvidenceValue("interArrivalCv", 0.149)).toBe("0.15");
    expect(formatEvidenceValue("dominantQname", "heartbeat-probe.edge-service.test")).toBe(
      "heartbeat-probe.edge-service.test",
    );
  });

  it("does not treat a lone severity token as an explanation", () => {
    expect(qvacExplanation("high")).toBeUndefined();
    expect(qvacExplanation("The inter-arrival CV is 0.149 in a 4-query window.")).toBe(
      "The inter-arrival CV is 0.149 in a 4-query window.",
    );
    expect(qvacConfidenceToken("high")).toBe("high");
    expect(qvacConfidenceToken("periodic queries", "medium")).toBe("medium");
  });
});
