import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  dnsEventSchema,
  siteIds,
  type DnsEvent,
} from "@sentinel-adaptive/contracts";

import { runScenario } from "./controller.js";
import {
  defaultKafkaBroker,
  defaultKafkaTopic,
  publishDnsEvents,
} from "./producer.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const composeFile = path.join(root, "infra", "docker-compose.yml");
const broker = process.env.KAFKA_BROKER ?? defaultKafkaBroker;
const topic = process.env.KAFKA_TOPIC ?? defaultKafkaTopic;
const count = 24;
const seed = 902_010;

function runKafkaCommand(arguments_: readonly string[]): string {
  const result = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      composeFile,
      "exec",
      "-T",
      "kafka",
      ...arguments_,
    ],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim());
  }
  return result.stdout;
}

function readOffsets(): Map<number, number> {
  const output = runKafkaCommand([
    "/opt/kafka/bin/kafka-get-offsets.sh",
    "--bootstrap-server",
    "localhost:29092",
    "--topic",
    topic,
  ]);
  return new Map(
    output
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [, partition, offset] = line.split(":");
        return [Number(partition), Number(offset)] as const;
      }),
  );
}

try {
  await publishDnsEvents([], { broker, topic, intervalMs: 0 });
  const offsetsBefore = readOffsets();
  await runScenario({
    scenario: "combined",
    count,
    seed,
    intervalMs: 0,
    broker,
    topic,
  });
  const offsetsAfter = readOffsets();
  const received: DnsEvent[] = [];

  for (const [partition, offsetAfter] of offsetsAfter) {
    const offsetBefore = offsetsBefore.get(partition) ?? 0;
    const partitionCount = offsetAfter - offsetBefore;
    if (partitionCount === 0) {
      continue;
    }

    const output = runKafkaCommand([
      "/opt/kafka/bin/kafka-console-consumer.sh",
      "--bootstrap-server",
      "localhost:29092",
      "--topic",
      topic,
      "--partition",
      String(partition),
      "--offset",
      String(offsetBefore),
      "--max-messages",
      String(partitionCount),
      "--timeout-ms",
      "15000",
    ]);
    for (const line of output.trim().split(/\r?\n/).filter(Boolean)) {
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        continue;
      }
      const parsed = dnsEventSchema.safeParse(value);
      if (
        parsed.success &&
        parsed.data.scenarioTag === "combined" &&
        parsed.data.generator.seed === seed
      ) {
        received.push(parsed.data);
      }
    }
  }

  if (received.length !== count) {
    throw new Error(
      `Consumed ${received.length}/${count} newly published synthetic events.`,
    );
  }

  if (new Set(received.map((event) => event.siteId)).size !== siteIds.length) {
    throw new Error("Combined stream did not include all fictional sites.");
  }
  if (
    received.some(
      (event) =>
        event.scenarioTag !== "combined" ||
        event.generator.seed !== seed ||
        event.synthetic !== true,
    )
  ) {
    throw new Error("Synthetic stream metadata was invalid.");
  }
  const sequences = received
    .map((event) => event.generator.sequence)
    .sort((left, right) => left - right);
  if (sequences.some((sequence, index) => sequence !== index)) {
    throw new Error("Synthetic stream sequence was incomplete.");
  }

  console.log("Generator   PASS");
  console.log(`Kafka       PASS (${count} validated synthetic events)`);
} catch (error) {
  console.error("Synthetic streaming smoke test: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
