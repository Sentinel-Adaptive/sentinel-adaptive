import { processEvents } from "@sentinel-adaptive/detection";
import {
  defaultKafkaBroker,
  defaultKafkaTopic,
  generateScenario,
  publishDnsEvents,
} from "@sentinel-adaptive/generator";

import { consumeTopicRange, readTopicOffsets } from "./offsets.js";
import { emitWazuhIncidents, waitForWazuhAlert } from "./wazuh.js";

const broker = process.env.KAFKA_BROKER ?? defaultKafkaBroker;
const topic = process.env.KAFKA_TOPIC ?? defaultKafkaTopic;
const seed = 5_105_100;
const count = 20;

try {
  await publishDnsEvents([], { broker, topic, intervalMs: 0 });
  const before = readTopicOffsets(topic);
  const published = generateScenario({
    scenario: "dga",
    count,
    seed,
  });
  await publishDnsEvents(published, { broker, topic, intervalMs: 0 });
  const after = readTopicOffsets(topic);
  const received = consumeTopicRange(topic, before, after).filter(
    (event) =>
      event.generator?.seed === seed && event.scenarioTag === "dga",
  );

  if (received.length !== count) {
    throw new Error(`Consumed ${received.length}/${count} DGA events.`);
  }

  const signal = processEvents(received).find((item) => item.type === "dga");
  if (!signal || signal.evidence.length === 0) {
    throw new Error("Stage 3 did not emit an evidenced DGA signal.");
  }

  const [event] = await emitWazuhIncidents([signal]);
  if (!event) {
    throw new Error("Wazuh emitter produced no incident JSON.");
  }

  await waitForWazuhAlert(event.incident_id);

  console.log("Detection   PASS");
  console.log(`Wazuh       PASS (${event.incident_id})`);
} catch (error) {
  console.error("Wazuh integration smoke test: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
