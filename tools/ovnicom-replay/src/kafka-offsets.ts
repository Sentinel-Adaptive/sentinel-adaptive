import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { dnsEventSchema, type DnsEvent } from "@sentinel-adaptive/contracts";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const composeFile = path.join(root, "infra", "docker-compose.yml");

export function runKafkaCommand(arguments_: readonly string[]): string {
  const result = spawnSync(
    "docker",
    ["compose", "-f", composeFile, "exec", "-T", "kafka", ...arguments_],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
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

export function readTopicOffsets(topic: string): Map<number, number> {
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

export function consumeTopicRange(
  topic: string,
  offsetsBefore: Map<number, number>,
  offsetsAfter: Map<number, number>,
): DnsEvent[] {
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
      "60000",
    ]);

    for (const line of output.trim().split(/\r?\n/).filter(Boolean)) {
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        continue;
      }
      const parsed = dnsEventSchema.safeParse(value);
      if (parsed.success) {
        received.push(parsed.data);
      }
    }
  }

  return received;
}
