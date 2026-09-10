import { isAmbiguousSignal } from "@sentinel-adaptive/detection";

import { closeDemoQvac, seedOperatorDemo } from "./demo-fixtures.js";

try {
  const demo = await seedOperatorDemo({ assessQvac: true, emitWazuh: true });
  const skipped = demo.qvac.filter((result) => result.status === "skipped");
  const live = demo.qvac.filter((result) => result.status !== "skipped");
  const assessed = live.find((result) => result.status === "ok");
  if (skipped.length === 0) {
    throw new Error("High-confidence signals did not record a QVAC skip.");
  }
  if (!assessed?.assessment) {
    throw new Error(
      `Local QVAC did not return a validated assessment: ${live.map((item) => item.status).join(", ") || "missing"}`,
    );
  }
  if (demo.ambiguousMembers.some((signal) => !isAmbiguousSignal(signal))) {
    throw new Error("Ambiguous demo members left the QVAC routing band.");
  }

  console.log(`QoE windows     seeded (${demo.events.length} events)`);
  console.log(
    `High-confidence ${demo.highConfidence.incidentId}  skip QVAC (${skipped.length} skipped)`,
  );
  console.log(
    `Ambiguous       ${demo.ambiguous.incidentId}  QVAC ${assessed.status} ${assessed.assessment.assessment}`,
  );
  console.log(`QVAC rationale  ${assessed.assessment.rationale}`);
  console.log(`Used evidence   ${assessed.assessment.usedEvidence.join(", ")}`);
  console.log("Wazuh           event log written for both incidents");
  console.log("Demo seed       PASS");
} catch (error) {
  console.error("Demo seed: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDemoQvac();
}
