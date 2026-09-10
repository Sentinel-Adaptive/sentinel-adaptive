import { dnsEventSchema, type ScenarioTag } from "@sentinel-adaptive/contracts";
import { processEvents } from "@sentinel-adaptive/detection";
import {
  defaultKafkaBroker,
  defaultKafkaTopic,
  generateScenario,
  publishDnsEvents,
} from "@sentinel-adaptive/generator";

import { consumeTopicRange, readTopicOffsets } from "./offsets.js";

const broker = process.env.KAFKA_BROKER ?? defaultKafkaBroker;
const topic = process.env.KAFKA_TOPIC ?? defaultKafkaTopic;

interface ScenarioCase {
  scenario: ScenarioTag;
  count: number;
  expectedType?: "dga" | "tunneling" | "beaconing" | "typosquatting";
}

const cases: ScenarioCase[] = [
  { scenario: "normal", count: 90 },
  { scenario: "dga", count: 20, expectedType: "dga" },
  { scenario: "tunnel", count: 8, expectedType: "tunneling" },
  { scenario: "beacon", count: 6, expectedType: "beaconing" },
  { scenario: "typosquat", count: 5, expectedType: "typosquatting" },
];

try {
  await publishDnsEvents([], { broker, topic, intervalMs: 0 });

  for (const [index, testCase] of cases.entries()) {
    const seed = 3_100_000 + index;
    const offsetsBefore = readTopicOffsets(topic);
    const published = generateScenario({
      scenario: testCase.scenario,
      count: testCase.count,
      seed,
    });
    await publishDnsEvents(published, { broker, topic, intervalMs: 0 });
    const offsetsAfter = readTopicOffsets(topic);
    const received = consumeTopicRange(topic, offsetsBefore, offsetsAfter).filter(
      (event) =>
        event.generator.seed === seed &&
        event.scenarioTag === testCase.scenario,
    );

    if (received.length !== testCase.count) {
      throw new Error(
        `${testCase.scenario}: consumed ${received.length}/${testCase.count} events.`,
      );
    }

    for (const event of received) {
      dnsEventSchema.parse(event);
    }

    const signals = processEvents(received);
    if (testCase.scenario === "normal") {
      if (signals.some((signal) => signal.severityHint === "high")) {
        throw new Error("Normal traffic emitted high-severity signals.");
      }
      console.log("Normal      PASS");
      continue;
    }

    const match = signals.find((signal) => signal.type === testCase.expectedType);
    if (!match || match.evidence.length === 0) {
      throw new Error(
        `${testCase.scenario}: expected ${testCase.expectedType} signal with evidence.`,
      );
    }
    console.log(`${testCase.scenario.padEnd(12)}PASS`);
  }

  console.log("Detection   PASS");
  console.log("Kafka       PASS");
} catch (error) {
  console.error("Detection stream smoke test: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
