import { incidentDetailSchema, overviewResponseSchema } from "@sentinel-adaptive/contracts";
import { isAmbiguousSignal } from "@sentinel-adaptive/detection";

import { listenOperatorApi } from "./api.js";
import { closeDemoQvac, seedOperatorDemo } from "./demo-fixtures.js";

try {
  const demo = await seedOperatorDemo({ assessQvac: true, emitWazuh: true });
  const skipped = demo.qvac.filter((result) => result.status === "skipped");
  const live = demo.qvac.find((result) => result.status === "ok" && result.assessment);
  if (skipped.length === 0 || !live?.assessment) {
    throw new Error("Demo seed did not prove both QVAC skip and live local assessment.");
  }
  if (!demo.ambiguousMembers.every((signal) => isAmbiguousSignal(signal))) {
    throw new Error("Ambiguous members left the existing QVAC routing band.");
  }

  const api = await listenOperatorApi(demo.store, 0);
  const base = `http://127.0.0.1:${api.port}`;
  try {
    const system = await getJson(`${base}/api/system`);
    if (
      typeof system !== "object" ||
      system === null ||
      (system as { cloudInference?: unknown }).cloudInference !== false
    ) {
      throw new Error("System view is not local-only.");
    }
    const overview = overviewResponseSchema.parse(await getJson(`${base}/api/overview`));
    if (overview.sites.some((site) => site.latestQoe === null)) {
      throw new Error("Overview is missing local QoE windows for one or more sites.");
    }
    const high = incidentDetailSchema.parse(
      await getJson(`${base}/api/incidents/${demo.highConfidence.incidentId}`),
    );
    const ambiguous = incidentDetailSchema.parse(
      await getJson(`${base}/api/incidents/${demo.ambiguous.incidentId}`),
    );
    if (high.signals.length < 2 || high.signals.some((signal) => signal.evidence.length === 0)) {
      throw new Error("High-confidence detail dropped member evidence.");
    }
    if (!high.qvac.some((result) => result.status === "skipped")) {
      throw new Error("High-confidence incident did not record a QVAC skip.");
    }
    if (high.qvac.some((result) => result.status === "ok")) {
      throw new Error("High-confidence incident incorrectly ran QVAC inference.");
    }
    if (
      ambiguous.qvac.every((result) => result.status !== "ok") ||
      !ambiguous.qvac.some((result) => result.assessment)
    ) {
      throw new Error("Ambiguous incident detail has no validated local QVAC assessment.");
    }
    if (!high.wazuh.emitted || !ambiguous.wazuh.emitted) {
      throw new Error("Wazuh emit state is not truthful for seeded demo incidents.");
    }
    if (!high.currentWindow || !ambiguous.currentWindow) {
      throw new Error("Incident detail is missing site window context.");
    }
    const bank = await getJson(`${base}/api/sites/${demo.highConfidence.siteId}`);
    const health = await getJson(`${base}/api/sites/${demo.ambiguous.siteId}`);
    if (
      typeof bank !== "object" ||
      bank === null ||
      (bank as { siteId?: unknown }).siteId !== demo.highConfidence.siteId ||
      typeof health !== "object" ||
      health === null ||
      (health as { siteId?: unknown }).siteId !== demo.ambiguous.siteId
    ) {
      throw new Error("Site detail did not return the seeded sites.");
    }

    console.log("System / QoE     PASS");
    console.log(`High-confidence  PASS (${high.incident.incidentId}, QVAC skipped)`);
    console.log(
      `Ambiguous QVAC   PASS (${ambiguous.incident.incidentId}, ${live.assessment.assessment})`,
    );
    console.log("Wazuh emit       PASS");
    console.log("Site windows     PASS");
  } finally {
    await api.close();
  }
} catch (error) {
  console.error("Operator UI smoke test: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDemoQvac();
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${url} -> ${response.status} ${body}`);
  }
  return JSON.parse(body) as unknown;
}
