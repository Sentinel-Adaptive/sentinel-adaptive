import { setTimeout as delay } from "node:timers/promises";

import {
  Kafka,
  logLevel,
  Partitioners,
  type Message,
} from "kafkajs";

import type { DnsEvent } from "@sentinel-adaptive/contracts";

export const defaultKafkaBroker = "localhost:9092";
export const defaultKafkaTopic = "dns.telemetry";

export interface PublishOptions {
  readonly broker?: string;
  readonly intervalMs?: number;
  readonly topic?: string;
}

function toMessage(event: DnsEvent): Message {
  return {
    key: event.siteId,
    value: JSON.stringify(event),
    headers: {
      scenario: event.scenarioTag,
      synthetic: "true",
    },
  };
}

export async function publishDnsEvents(
  events: readonly DnsEvent[],
  options: PublishOptions = {},
): Promise<void> {
  const broker = options.broker ?? process.env.KAFKA_BROKER ?? defaultKafkaBroker;
  const topic = options.topic ?? process.env.KAFKA_TOPIC ?? defaultKafkaTopic;
  const intervalMs = options.intervalMs ?? 25;

  if (!Number.isInteger(intervalMs) || intervalMs < 0) {
    throw new Error("Publish interval must be a non-negative integer.");
  }

  const kafka = new Kafka({
    clientId: "sentinel-synthetic-generator",
    brokers: [broker],
    logLevel: logLevel.NOTHING,
  });
  const admin = kafka.admin();
  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
  });

  await admin.connect();
  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [{ topic, numPartitions: 3, replicationFactor: 1 }],
    });
  } finally {
    await admin.disconnect();
  }

  await producer.connect();
  try {
    if (intervalMs === 0) {
      for (let offset = 0; offset < events.length; offset += 500) {
        await producer.send({
          topic,
          acks: -1,
          messages: events.slice(offset, offset + 500).map(toMessage),
        });
      }
      return;
    }

    for (const event of events) {
      await producer.send({
        topic,
        acks: -1,
        messages: [toMessage(event)],
      });
      await delay(intervalMs);
    }
  } finally {
    await producer.disconnect();
  }
}
