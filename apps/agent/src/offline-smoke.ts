import { qvacAssessmentSchema, signalSchema } from "@sentinel-adaptive/contracts";

import {
  assessAmbiguousSignals,
  closeQvacRuntime,
  createSdkRuntime,
} from "./qvac.js";
import { findCachedGguf, qvacOfflineRequested } from "./qvac-source.js";

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

try {
  if (!qvacOfflineRequested()) {
    throw new Error("SENTINEL_OFFLINE=true is required for the offline QVAC proof.");
  }
  const gguf = findCachedGguf({ explicitPath: process.env.QVAC_MODEL_PATH });
  if (!gguf) {
    throw new Error(
      "Local LLAMA_3_2_1B_INST_Q4_0 GGUF is not available. Run npm run smoke:qvac once while online.",
    );
  }

  const runtime = createSdkRuntime({
    onProgress(percentage) {
      console.log(`QVAC local load ${percentage}%`);
    },
  });
  await runtime.load();
  const [live] = await assessAmbiguousSignals([ambiguous], runtime);
  if (!live || live.status !== "ok" || !live.assessment) {
    throw new Error(
      `Offline QVAC did not return a validated assessment: ${live?.status ?? "missing"}`,
    );
  }
  qvacAssessmentSchema.parse(live.assessment);
  console.log(`Weights      PASS (${gguf})`);
  console.log(`QVAC         PASS (${live.assessment.assessment})`);
} catch (error) {
  console.error("Offline QVAC smoke: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeQvacRuntime().catch(() => undefined);
}
