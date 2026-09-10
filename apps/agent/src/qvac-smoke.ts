import { qvacAssessmentSchema, signalSchema } from "@sentinel-adaptive/contracts";
import { processEvents } from "@sentinel-adaptive/detection";
import { generateScenario } from "@sentinel-adaptive/generator";

import { assessSignals, type QvacRuntime } from "./qvac-assess.js";
import {
  assessAmbiguousSignals,
  closeQvacRuntime,
  createSdkRuntime,
} from "./qvac.js";

const ambiguous = signalSchema.parse({
  signalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
    {
      metric: "uniqueQnameRatio",
      value: 0.9,
      reason: "almost every query uses a distinct name",
    },
  ],
  source: "deterministic",
  incidentId: null,
});

const throwingLoad: QvacRuntime = {
  async load() {
    throw new Error("model missing");
  },
  async complete() {
    return "";
  },
};

const invalidComplete: QvacRuntime = {
  async load() {
    return "model-local";
  },
  async complete() {
    return "this is not an assessment object";
  },
};

try {
  const dga = processEvents(
    generateScenario({ scenario: "dga", count: 20 }),
  ).find((signal) => signal.type === "dga");
  if (!dga || dga.score < 0.75) {
    throw new Error("Expected a high-confidence DGA signal to skip QVAC.");
  }

  const skipped = await assessSignals([dga], throwingLoad);
  if (skipped[0]?.status !== "skipped") {
    throw new Error(`High-confidence signal was not skipped: ${skipped[0]?.status}`);
  }
  if (dga.source !== "deterministic" || dga.incidentId !== null) {
    throw new Error("QVAC must not mutate the original deterministic signal.");
  }

  const unavailable = await assessSignals([ambiguous], throwingLoad);
  if (unavailable[0]?.status !== "unavailable") {
    throw new Error("Load failure must be non-fatal unavailable.");
  }

  const invalid = await assessSignals([ambiguous], invalidComplete);
  if (invalid[0]?.status !== "invalid") {
    throw new Error("Invalid model JSON must be non-fatal invalid.");
  }

  const runtime = createSdkRuntime({
    onProgress(percentage) {
      console.log(`QVAC model download ${percentage}%`);
    },
  });
  await runtime.load();
  const [live] = await assessAmbiguousSignals([ambiguous], runtime);
  if (!live || live.status !== "ok" || !live.assessment) {
    throw new Error(
      `Local QVAC did not return a validated assessment: ${live?.status ?? "missing"}`,
    );
  }
  qvacAssessmentSchema.parse(live.assessment);

  console.log("Skip         PASS");
  console.log("Unavailable  PASS");
  console.log("Invalid      PASS");
  console.log(`QVAC         PASS (${live.assessment.assessment})`);
} catch (error) {
  console.error("QVAC inference smoke test: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeQvacRuntime().catch(() => undefined);
}
