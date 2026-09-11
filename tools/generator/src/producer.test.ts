import { describe, expect, it } from "vitest";

import { defaultKafkaBroker, defaultKafkaTopic, resolveKafkaBrokers, resolveKafkaTopic } from "./producer.js";

describe("Kafka publisher configuration", () => {
  it("reads KAFKA_BROKERS and KAFKA_DNS_TOPIC aliases", () => {
    const previousBroker = process.env.KAFKA_BROKER;
    const previousBrokers = process.env.KAFKA_BROKERS;
    const previousTopic = process.env.KAFKA_TOPIC;
    const previousDnsTopic = process.env.KAFKA_DNS_TOPIC;
    delete process.env.KAFKA_BROKER;
    delete process.env.KAFKA_TOPIC;
    process.env.KAFKA_BROKERS = "127.0.0.1:9092";
    process.env.KAFKA_DNS_TOPIC = "dns.telemetry";
    try {
      expect(resolveKafkaBrokers()).toEqual(["127.0.0.1:9092"]);
      expect(resolveKafkaTopic()).toBe("dns.telemetry");
    } finally {
      restore("KAFKA_BROKER", previousBroker);
      restore("KAFKA_BROKERS", previousBrokers);
      restore("KAFKA_TOPIC", previousTopic);
      restore("KAFKA_DNS_TOPIC", previousDnsTopic);
    }
  });

  it("falls back to local defaults", () => {
    const previousBroker = process.env.KAFKA_BROKER;
    const previousBrokers = process.env.KAFKA_BROKERS;
    const previousTopic = process.env.KAFKA_TOPIC;
    const previousDnsTopic = process.env.KAFKA_DNS_TOPIC;
    delete process.env.KAFKA_BROKER;
    delete process.env.KAFKA_BROKERS;
    delete process.env.KAFKA_TOPIC;
    delete process.env.KAFKA_DNS_TOPIC;
    try {
      expect(resolveKafkaBrokers()).toEqual([defaultKafkaBroker]);
      expect(resolveKafkaTopic()).toBe(defaultKafkaTopic);
    } finally {
      restore("KAFKA_BROKER", previousBroker);
      restore("KAFKA_BROKERS", previousBrokers);
      restore("KAFKA_TOPIC", previousTopic);
      restore("KAFKA_DNS_TOPIC", previousDnsTopic);
    }
  });
});

function restore(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
