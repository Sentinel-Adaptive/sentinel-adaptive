import { Kafka, logLevel, type Consumer } from "kafkajs";

import { dnsEventSchema, type Incident, type Signal } from "@sentinel-adaptive/contracts";
import { DetectionEngine, IncidentCorrelator } from "@sentinel-adaptive/detection";
import {
  resolveKafkaBrokers,
  resolveKafkaTopic,
} from "@sentinel-adaptive/generator";

import {
  ensureTelemetrySchema,
  persistBucket,
  persistIncidents,
  persistQvacResults,
  persistSignals,
  type ClickHouseSettings,
} from "./clickhouse.js";
import { assessAmbiguousSignals } from "./qvac.js";
import { operatorStore, type OperatorStore } from "./store.js";
import { emitWazuhIncidents } from "./wazuh.js";

export { defaultKafkaBroker, defaultKafkaTopic } from "@sentinel-adaptive/generator";

export interface ConsumeStreamOptions {
  readonly broker?: string;
  readonly topic?: string;
  readonly groupId?: string;
  readonly fromBeginning?: boolean;
  readonly persist?: boolean;
  readonly emitWazuh?: boolean;
  readonly assessQvac?: boolean;
  readonly clickhouse?: ClickHouseSettings;
  readonly onSignals?: (signals: readonly Signal[]) => void;
  readonly onIncidents?: (incidents: readonly Incident[]) => void;
  readonly store?: OperatorStore;
}

export async function consumeDnsStream(
  options: ConsumeStreamOptions = {},
): Promise<Consumer> {
  const topic = options.topic ?? resolveKafkaTopic();
  const persist = options.persist ?? true;
  const emitWazuh = options.emitWazuh ?? true;
  const assessQvac = options.assessQvac ?? true;
  const store = options.store ?? operatorStore;
  const kafka = new Kafka({
    clientId: "sentinel-agent",
    brokers: options.broker ? [options.broker] : resolveKafkaBrokers(),
    logLevel: logLevel.NOTHING,
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
  });
  const consumer = kafka.consumer({
    groupId: options.groupId ?? "sentinel-agent",
  });
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
  const correlator = new IncidentCorrelator();

  await consumer.connect();
  await consumer.subscribe({
    topic,
    fromBeginning: options.fromBeginning ?? false,
  });
  console.log(`Kafka consumer subscribed to ${topic}`);
  if (persist) {
    void ensureTelemetrySchema(options.clickhouse).catch((error: unknown) => {
      console.error(
        "ClickHouse schema ensure failed:",
        error instanceof Error ? error.message : error,
      );
    });
  }
  let loggedFirst = false;
  await consumer.run({
    eachMessage: async ({ message, heartbeat }) => {
      try {
        await heartbeat();
        if (!loggedFirst) {
          loggedFirst = true;
          console.log(
            `Kafka consumer first message offset=${message.offset ?? "unknown"}`,
          );
        }
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
        if (signals.length === 0) {
          return;
        }
        options.onSignals?.(signals);
        const incidents = correlator.ingest(signals);
        if (incidents.length > 0) {
          const members = incidents.flatMap((incident) =>
            correlator.membersOf(incident.incidentId),
          );
          store.recordIncidents(incidents, members);
          options.onIncidents?.(incidents);
          if (persist) {
            void persistIncidents(incidents, options.clickhouse).catch(
              (error: unknown) => {
                console.error(
                  "ClickHouse incident persist failed:",
                  error instanceof Error ? error.message : error,
                );
              },
            );
            void persistSignals(members, options.clickhouse).catch(
              (error: unknown) => {
                console.error(
                  "ClickHouse signal persist failed:",
                  error instanceof Error ? error.message : error,
                );
              },
            );
          }
          if (emitWazuh) {
            void emitWazuhIncidents(incidents)
              .then(() => {
                store.markWazuhEmitted(incidents.map((item) => item.incidentId));
              })
              .catch((error: unknown) => {
                console.error(
                  "Wazuh emit failed:",
                  error instanceof Error ? error.message : error,
                );
              });
          }
        }
        if (assessQvac) {
          void assessAmbiguousSignals(signals)
            .then((results) => {
              store.recordQvac(results);
              if (persist) {
                void persistQvacResults(results, options.clickhouse).catch(
                  (error: unknown) => {
                    console.error(
                      "ClickHouse QVAC persist failed:",
                      error instanceof Error ? error.message : error,
                    );
                  },
                );
              }
              for (const result of results) {
                if (result.status === "invalid" || result.status === "unavailable") {
                  console.error(
                    `QVAC ${result.status} for signal ${result.signalId}`,
                  );
                }
              }
            })
            .catch((error: unknown) => {
              console.error(
                "QVAC assess failed:",
                error instanceof Error ? error.message : error,
              );
            });
        }
      } catch (error) {
        console.error(
          "Kafka message failed:",
          error instanceof Error ? error.message : error,
        );
      }
    },
  });

  return consumer;
}
