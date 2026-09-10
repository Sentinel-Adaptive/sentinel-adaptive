import { describe, expect, it } from "vitest";

import { isAmbiguousSignal } from "@sentinel-adaptive/detection";

import { buildDemoIncidents } from "./demo-fixtures.js";

describe("operator demo fixtures", () => {
  it("keeps the high-confidence case outside QVAC and the weak beacon inside it", () => {
    const demo = buildDemoIncidents();
    expect(demo.highConfidence.signalCount).toBeGreaterThanOrEqual(2);
    expect(demo.highMembers.every((signal) => !isAmbiguousSignal(signal))).toBe(true);
    expect(demo.ambiguousMembers.length).toBeGreaterThan(0);
    expect(demo.ambiguousMembers.every((signal) => isAmbiguousSignal(signal))).toBe(true);
    expect(demo.highConfidence.siteId).toBe("PTY-BANK-01");
    expect(demo.ambiguous.siteId).toBe("PTY-HEALTH-01");
    expect(demo.highConfidence.incidentId).not.toBe(demo.ambiguous.incidentId);
  });
});
