import { setTimeout as delay } from "node:timers/promises";

import {
  Kafka,
  logLevel,
  Partitioners,
  type Message,
  type Producer,
} from "kafkajs";

import type { DnsEvent } from "@sentinel-adaptive/contracts";

export const defaultKafkaBroker = "localhost:9092";
export const defaultKafkaTopic = "dns.telemetry";

export interface PublishOptions {
  readonly broker?: string;
  readonly intervalMs?: number;
  readonly topic?: string;
}

export interface DnsPublisher {
  readonly topic: string;
  publish(
    events: readonly DnsEvent[],
    intervalMs?: number,
  ): Promise<void>;
  close(): Promise<void>;
}

function toMessage(event: DnsEvent): Message {
  return {
    key: event.siteId,
    value: JSON.stringify(event),
    headers: {
      scenario: event.scenarioTag,
      source: event.source,
      synthetic: event.synthetic ? "true" : "false",
    },
  };
}

export function resolveKafkaBrokers(options: PublishOptions = {}): string[] {
  const raw =
    options.broker ??
    process.env.KAFKA_BROKER ??
    process.env.KAFKA_BROKERS ??
    defaultKafkaBroker;
  const brokers = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (brokers.length === 0) {
    throw new Error("Kafka broker list is empty.");
  }
  return brokers;
}

export function resolveKafkaTopic(options: PublishOptions = {}): string {
  return (
    options.topic ??
    process.env.KAFKA_TOPIC ??
    process.env.KAFKA_DNS_TOPIC ??
    defaultKafkaTopic
  );
}

function assertInterval(intervalMs: number): void {
  if (!Number.isInteger(intervalMs) || intervalMs < 0) {
    throw new Error("Publish interval must be a non-negative integer.");
  }
}

async function sendAll(
  producer: Producer,
  topic: string,
  events: readonly DnsEvent[],
  intervalMs: number,
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  for (let offset = 0; offset < events.length; offset += 500) {
    await producer.send({
      topic,
      acks: -1,
      messages: events.slice(offset, offset + 500).map(toMessage),
    });
    if (intervalMs > 0 && offset + 500 < events.length) {
      await delay(intervalMs);
    }
  }
  if (intervalMs > 0) {
    await delay(intervalMs);
  }
}

export async function createDnsPublisher(
  options: PublishOptions = {},
): Promise<DnsPublisher> {
  assertInterval(options.intervalMs ?? 0);
  const brokers = resolveKafkaBrokers(options);
  const topic = resolveKafkaTopic(options);
  const kafka = new Kafka({
    clientId: "sentinel-synthetic-generator",
    brokers,
    logLevel: logLevel.NOTHING,
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
    retry: {
      retries: 8,
      initialRetryTime: 300,
      maxRetryTime: 5_000,
    },
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
  let closed = false;

  return {
    topic,
    async publish(events, intervalMs = options.intervalMs ?? 25) {
      assertInterval(intervalMs);
      if (closed) {
        throw new Error("Kafka publisher is closed.");
      }
      await sendAll(producer, topic, events, intervalMs);
    },
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      await producer.disconnect();
    },
  };
}

export async function publishDnsEvents(
  events: readonly DnsEvent[],
  options: PublishOptions = {},
): Promise<void> {
  const publisher = await createDnsPublisher(options);
  try {
    await publisher.publish(events, options.intervalMs ?? 25);
  } finally {
    await publisher.close();
  }
}
