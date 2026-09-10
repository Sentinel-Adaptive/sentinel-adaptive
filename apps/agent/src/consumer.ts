import { Kafka, logLevel, type Consumer } from "kafkajs";

import { dnsEventSchema, type Signal } from "@sentinel-adaptive/contracts";
import { DetectionEngine } from "@sentinel-adaptive/detection";

import {
  ensureTelemetrySchema,
  persistBucket,
  type ClickHouseSettings,
} from "./clickhouse.js";

export const defaultKafkaBroker = "localhost:9092";
export const defaultKafkaTopic = "dns.telemetry";

export interface ConsumeStreamOptions {
  readonly broker?: string;
  readonly topic?: string;
  readonly groupId?: string;
  readonly fromBeginning?: boolean;
  readonly persist?: boolean;
  readonly clickhouse?: ClickHouseSettings;
  readonly onSignals?: (signals: readonly Signal[]) => void;
}

export async function consumeDnsStream(
  options: ConsumeStreamOptions = {},
): Promise<Consumer> {
  const broker = options.broker ?? process.env.KAFKA_BROKER ?? defaultKafkaBroker;
  const topic = options.topic ?? process.env.KAFKA_TOPIC ?? defaultKafkaTopic;
  const persist = options.persist ?? true;
  const kafka = new Kafka({
    clientId: "sentinel-agent",
    brokers: [broker],
    logLevel: logLevel.NOTHING,
  });
  const consumer = kafka.consumer({
    groupId: options.groupId ?? "sentinel-agent",
  });
  if (persist) {
    await ensureTelemetrySchema(options.clickhouse);
  }
  const engine = new DetectionEngine({
    onBucketComplete(metrics, events, qoe) {
      if (!persist) {
        return;
      }
      void persistBucket(metrics, events, qoe, options.clickhouse).catch(
        (error: unknown) => {
          console.error(
            "ClickHouse persist failed:",
            error instanceof Error ? error.message : error,
          );
        },
      );
    },
  });
  const seen = new Set<string>();

  await consumer.connect();
  await consumer.subscribe({
    topic,
    fromBeginning: options.fromBeginning ?? false,
  });
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }
      const parsed = dnsEventSchema.safeParse(
        JSON.parse(message.value.toString()),
      );
      if (!parsed.success) {
        return;
      }
      engine.ingest(parsed.data);
      const signals = engine.evaluate().filter((signal) => {
        if (seen.has(signal.signalId)) {
          return false;
        }
        seen.add(signal.signalId);
        return true;
      });
      if (signals.length > 0) {
        options.onSignals?.(signals);
      }
    },
  });

  return consumer;
}
