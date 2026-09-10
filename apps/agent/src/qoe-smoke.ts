import { collectSiteWindows } from "@sentinel-adaptive/detection";
import {
  defaultKafkaBroker,
  defaultKafkaTopic,
  generateScenario,
  publishDnsEvents,
} from "@sentinel-adaptive/generator";

import {
  clickHouseQuery,
  ensureTelemetrySchema,
  persistTelemetry,
} from "./clickhouse.js";
import { consumeTopicRange, readTopicOffsets } from "./offsets.js";

const broker = process.env.KAFKA_BROKER ?? defaultKafkaBroker;
const topic = process.env.KAFKA_TOPIC ?? defaultKafkaTopic;
const grafanaUrl = process.env.GRAFANA_URL ?? "http://localhost:3000";
const grafanaUser = process.env.GRAFANA_ADMIN_USER ?? "admin";
const grafanaPassword = process.env.GRAFANA_ADMIN_PASSWORD ?? "sentinel-local";
const siteId = "PTY-BANK-01" as const;
const normalSeed = 4_104_100;
const degradeSeed = 4_104_200;

async function readGrafanaDashboard(): Promise<{
  dashboard?: { panels?: Array<{ targets?: Array<{ rawSql?: string }> }> };
}> {
  const response = await fetch(
    new URL("/api/dashboards/uid/sentinel-site-qoe", grafanaUrl),
    {
      headers: {
        authorization: `Basic ${Buffer.from(`${grafanaUser}:${grafanaPassword}`).toString("base64")}`,
      },
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Grafana dashboard lookup failed (${response.status}): ${body}`,
    );
  }
  return JSON.parse(body) as {
    dashboard?: { panels?: Array<{ targets?: Array<{ rawSql?: string }> }> };
  };
}

function averageScore(output: string): number {
  const scores = output
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => Number(line));
  if (scores.length === 0 || scores.some((score) => !Number.isFinite(score))) {
    throw new Error(`No QoE scores in ClickHouse output: ${output}`);
  }
  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

try {
  await ensureTelemetrySchema();
  await publishDnsEvents([], { broker, topic, intervalMs: 0 });

  const beforeNormal = readTopicOffsets(topic);
  const normal = generateScenario({
    scenario: "normal",
    count: 40,
    seed: normalSeed,
    siteId,
    startTime: "2026-09-10T12:00:00.000Z",
  });
  await publishDnsEvents(normal, { broker, topic, intervalMs: 0 });
  const afterNormal = readTopicOffsets(topic);
  const consumedNormal = consumeTopicRange(
    topic,
    beforeNormal,
    afterNormal,
  ).filter(
    (event) => event.generator?.seed === normalSeed && event.siteId === siteId,
  );
  if (consumedNormal.length !== normal.length) {
    throw new Error(
      `Normal: consumed ${consumedNormal.length}/${normal.length} events.`,
    );
  }

  const beforeDegrade = readTopicOffsets(topic);
  const degraded = generateScenario({
    scenario: "degrade-qoe",
    count: 40,
    seed: degradeSeed,
    siteId,
    startTime: "2026-09-10T12:01:00.000Z",
  });
  await publishDnsEvents(degraded, { broker, topic, intervalMs: 0 });
  const afterDegrade = readTopicOffsets(topic);
  const consumedDegrade = consumeTopicRange(
    topic,
    beforeDegrade,
    afterDegrade,
  ).filter(
    (event) => event.generator?.seed === degradeSeed && event.siteId === siteId,
  );
  if (consumedDegrade.length !== degraded.length) {
    throw new Error(
      `degrade-qoe: consumed ${consumedDegrade.length}/${degraded.length} events.`,
    );
  }

  const combined = [...consumedNormal, ...consumedDegrade];
  await persistTelemetry(combined, collectSiteWindows(combined));

  const storedEvents = Number.parseInt(
    (
      await clickHouseQuery(
        `SELECT count() FROM dns_events WHERE site_id = '${siteId}' AND timestamp >= toDateTime64('2026-09-10 12:00:00.000', 3, 'UTC') AND timestamp < toDateTime64('2026-09-10 12:02:00.000', 3, 'UTC') FORMAT TabSeparated`,
      )
    ).trim(),
    10,
  );
  if (storedEvents < 80) {
    throw new Error(`ClickHouse stored ${storedEvents} expected DNS events.`);
  }

  const normalQoe = averageScore(
    await clickHouseQuery(
      `SELECT qoe_score FROM site_metrics WHERE site_id = '${siteId}' AND bucket_start >= toDateTime64('2026-09-10 12:00:00.000', 3, 'UTC') AND bucket_start < toDateTime64('2026-09-10 12:01:00.000', 3, 'UTC') FORMAT TabSeparated`,
    ),
  );
  const degradedQoe = averageScore(
    await clickHouseQuery(
      `SELECT qoe_score FROM site_metrics WHERE site_id = '${siteId}' AND bucket_start >= toDateTime64('2026-09-10 12:01:00.000', 3, 'UTC') AND bucket_start < toDateTime64('2026-09-10 12:02:00.000', 3, 'UTC') FORMAT TabSeparated`,
    ),
  );
  if (degradedQoe >= normalQoe * 0.75) {
    throw new Error(
      `Expected degrade-qoe (${degradedQoe}) to be lower than normal (${normalQoe}).`,
    );
  }

  const dashboard = await readGrafanaDashboard();
  const sql = (dashboard.dashboard?.panels ?? [])
    .flatMap((panel) => panel.targets ?? [])
    .map((target) => target.rawSql ?? "")
    .join("\n");
  if (!sql.includes("sentinel.site_metrics") || !sql.includes("qoe_score")) {
    throw new Error("Grafana QoE dashboard is missing site_metrics QoE queries.");
  }

  console.log("ClickHouse  PASS");
  console.log(
    `QoE         PASS (normal ${normalQoe.toFixed(3)} > degrade ${degradedQoe.toFixed(3)})`,
  );
  console.log("Grafana     PASS");
} catch (error) {
  console.error("QoE persistence smoke test: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
