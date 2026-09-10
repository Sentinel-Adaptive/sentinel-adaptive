import { correlateSignals, processEvents } from "@sentinel-adaptive/detection";
import {
  defaultKafkaBroker,
  defaultKafkaTopic,
  generateScenario,
  publishDnsEvents,
} from "@sentinel-adaptive/generator";

import {
  clickHouseQuery,
  ensureTelemetrySchema,
  persistIncidents,
} from "./clickhouse.js";
import { consumeTopicRange, readTopicOffsets } from "./offsets.js";
import { emitWazuhIncidents, waitForWazuhAlert } from "./wazuh.js";

const broker = process.env.KAFKA_BROKER ?? defaultKafkaBroker;
const topic = process.env.KAFKA_TOPIC ?? defaultKafkaTopic;
const siteId = "PTY-BANK-01" as const;
const dgaSeed = 7_107_100;
const beaconSeed = 7_107_101;

try {
  await ensureTelemetrySchema();
  await publishDnsEvents([], { broker, topic, intervalMs: 0 });

  const beforeDga = readTopicOffsets(topic);
  const dgaEvents = generateScenario({
    scenario: "dga",
    count: 20,
    seed: dgaSeed,
    siteId,
    startTime: "2026-09-10T12:00:00.000Z",
  });
  await publishDnsEvents(dgaEvents, { broker, topic, intervalMs: 0 });
  const afterDga = readTopicOffsets(topic);
  const receivedDga = consumeTopicRange(topic, beforeDga, afterDga).filter(
    (event) => event.generator?.seed === dgaSeed && event.siteId === siteId,
  );
  if (receivedDga.length !== dgaEvents.length) {
    throw new Error(`Consumed ${receivedDga.length}/${dgaEvents.length} DGA events.`);
  }

  const beforeBeacon = readTopicOffsets(topic);
  const beaconEvents = generateScenario({
    scenario: "beacon",
    count: 4,
    seed: beaconSeed,
    siteId,
    startTime: "2026-09-10T12:00:00.000Z",
  });
  await publishDnsEvents(beaconEvents, { broker, topic, intervalMs: 0 });
  const afterBeacon = readTopicOffsets(topic);
  const receivedBeacon = consumeTopicRange(
    topic,
    beforeBeacon,
    afterBeacon,
  ).filter(
    (event) => event.generator?.seed === beaconSeed && event.siteId === siteId,
  );
  if (receivedBeacon.length !== beaconEvents.length) {
    throw new Error(
      `Consumed ${receivedBeacon.length}/${beaconEvents.length} beacon events.`,
    );
  }

  const dga = processEvents(receivedDga).find((signal) => signal.type === "dga");
  const beacon = processEvents(receivedBeacon).find(
    (signal) => signal.type === "beaconing",
  );
  if (!dga || !beacon) {
    throw new Error("Expected independently evidenced DGA and beaconing signals.");
  }

  const [incident] = correlateSignals([dga, beacon]);
  if (!incident || incident.signalCount < 2) {
    throw new Error("Correlator did not merge the same-site signals.");
  }
  if (dga.incidentId !== null || beacon.incidentId !== null) {
    throw new Error("Raw detection signals must keep incidentId null.");
  }

  await persistIncidents([incident]);
  const stored = (
    await clickHouseQuery(
      `SELECT signal_count FROM incidents FINAL WHERE incident_id = '${incident.incidentId}' FORMAT TabSeparated`,
    )
  ).trim();
  if (Number(stored) !== incident.signalCount) {
    throw new Error(`ClickHouse stored signal_count ${stored}, expected ${incident.signalCount}.`);
  }

  const [event] = await emitWazuhIncidents([incident]);
  if (!event) {
    throw new Error("Wazuh emitter produced no incident JSON.");
  }
  await waitForWazuhAlert(event.incident_id);

  console.log("Correlation PASS");
  console.log(`ClickHouse  PASS (${incident.signalCount} signals)`);
  console.log(`Wazuh       PASS (${event.incident_id})`);
} catch (error) {
  console.error("Incident correlation smoke test: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
