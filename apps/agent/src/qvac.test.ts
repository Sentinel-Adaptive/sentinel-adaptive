import { afterEach, describe, expect, it } from "vitest";

import { signalSchema } from "@sentinel-adaptive/contracts";

import { assessAmbiguousSignals, qvacLocalOnly } from "./qvac.js";

const previousLocalOnly = process.env.QVAC_LOCAL_ONLY;

afterEach(() => {
  if (previousLocalOnly === undefined) {
    delete process.env.QVAC_LOCAL_ONLY;
  } else {
    process.env.QVAC_LOCAL_ONLY = previousLocalOnly;
  }
});

describe("QVAC local-only guard", () => {
  it("defaults to local-only and refuses the SDK when disabled", async () => {
    delete process.env.QVAC_LOCAL_ONLY;
    expect(qvacLocalOnly()).toBe(true);

    process.env.QVAC_LOCAL_ONLY = "false";
    const signal = signalSchema.parse({
      signalId: "11111111-1111-4111-8111-111111111111",
      timestamp: "2026-09-10T12:34:56.000Z",
      siteId: "PTY-BANK-01",
      type: "dga",
      score: 0.68,
      severityHint: "medium",
      evidence: [
        {
          metric: "nxdomainRatio",
          value: 0.41,
          reason: "many names in this window fail to resolve",
        },
      ],
      source: "deterministic",
      incidentId: null,
    });

    await expect(assessAmbiguousSignals([signal])).resolves.toEqual([
      { signalId: signal.signalId, status: "unavailable" },
    ]);
  });
});
