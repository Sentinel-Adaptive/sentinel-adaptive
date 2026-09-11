import { processEvents } from "@sentinel-adaptive/detection";
import { resolveConfiguredDatasetPath } from "./files.js";
import {
  defaultKafkaBroker,
  defaultKafkaTopic,
  generateScenario,
  publishDnsEvents,
} from "@sentinel-adaptive/generator";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { consumeTopicRange, readTopicOffsets } from "./kafka-offsets.js";
import { replayOvnicomLogs } from "./replay.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

function resolveDatasetPath(input?: string): string {
  return resolveConfiguredDatasetPath(input, repoRoot);
}

const broker = process.env.KAFKA_BROKER ?? defaultKafkaBroker;
const topic = process.env.KAFKA_TOPIC ?? defaultKafkaTopic;
const datasetPath = resolveDatasetPath(process.env.OVNICOM_DATASET_PATH);
const limit = 10_000;
const dgaSeed = 3_500_350;
const dgaCount = 20;

try {
  await publishDnsEvents([], { broker, topic, intervalMs: 0 });

  const replayBefore = readTopicOffsets(topic);
  const stats = await replayOvnicomLogs({
    path: datasetPath,
    limit,
    broker,
    topic,
    intervalMs: 0,
  });
  const replayAfter = readTopicOffsets(topic);
  const replayed = consumeTopicRange(topic, replayBefore, replayAfter).filter(
    (event) => event.source === "ovnicom-challenge",
  );

  if (stats.published !== limit) {
    throw new Error(
      `Replay published ${stats.published} records; expected ${limit}.`,
    );
  }
  if (replayed.length !== limit) {
    throw new Error(
      `Consumed ${replayed.length}/${limit} ovnicom-challenge events from Kafka.`,
    );
  }

  const backgroundSignals = processEvents(replayed);
  const backgroundHigh = backgroundSignals.filter(
    (signal) => signal.severityHint === "high",
  );
  if (backgroundHigh.length > 0) {
    throw new Error(
      `Background replay emitted high-severity signals: ${backgroundHigh
        .map((signal) => signal.type)
        .join(", ")}.`,
    );
  }

  const dgaBefore = readTopicOffsets(topic);
  const dgaEvents = generateScenario({
    scenario: "dga",
    count: dgaCount,
    seed: dgaSeed,
  });
  await publishDnsEvents(dgaEvents, { broker, topic, intervalMs: 0 });
  const dgaAfter = readTopicOffsets(topic);
  const dgaReceived = consumeTopicRange(topic, dgaBefore, dgaAfter).filter(
    (event) =>
      event.source === "sentinel-synthetic" &&
      event.scenarioTag === "dga" &&
      event.generator?.seed === dgaSeed,
  );

  if (dgaReceived.length !== dgaCount) {
    throw new Error(
      `Consumed ${dgaReceived.length}/${dgaCount} synthetic DGA events.`,
    );
  }

  const mixedSignals = processEvents([...replayed, ...dgaReceived]);
  const dgaSignal = mixedSignals.find((signal) => signal.type === "dga");
  if (!dgaSignal || dgaSignal.evidence.length === 0) {
    throw new Error("Stage 3 did not emit an evidenced DGA signal after mixed replay.");
  }

  console.log(`Ovnicom     PASS (${stats.published} challenge records, skipped ${stats.skipped})`);
  console.log("Kafka       PASS");
  console.log("Detection   PASS");
} catch (error) {
  console.error("Ovnicom challenge replay smoke test: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
