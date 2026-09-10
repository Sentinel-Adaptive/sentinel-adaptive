import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(root, "infra", "docker-compose.yml");

function runCompose(args, options = {}) {
  const result = spawnSync(
    "docker",
    ["compose", "-f", composeFile, ...args],
    {
      cwd: root,
      encoding: "utf8",
      input: options.input,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (!options.allowFailure && result.status !== 0) {
    throw new Error(
      `docker compose ${args.join(" ")} failed:\n${result.stderr || result.stdout}`,
    );
  }

  return result;
}

async function clickHouseQuery(query, body) {
  const baseUrl = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
  const database = process.env.CLICKHOUSE_DATABASE ?? "sentinel";
  const user = process.env.CLICKHOUSE_USER ?? "sentinel";
  const password = process.env.CLICKHOUSE_PASSWORD ?? "sentinel-local";
  const url = new URL(baseUrl);

  url.searchParams.set("database", database);
  url.searchParams.set("query", query);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
    },
    body,
  });

  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(
      `ClickHouse query failed (${response.status}): ${responseBody}`,
    );
  }

  return responseBody;
}

async function grafanaRequest(pathname) {
  const baseUrl = process.env.GRAFANA_URL ?? "http://localhost:3000";
  const user = process.env.GRAFANA_ADMIN_USER ?? "admin";
  const password = process.env.GRAFANA_ADMIN_PASSWORD ?? "sentinel-local";
  const response = await fetch(new URL(pathname, baseUrl), {
    headers: {
      authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
    },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Grafana request '${pathname}' failed (${response.status}): ${body}`,
    );
  }

  return body ? JSON.parse(body) : {};
}

function smokeKafka(marker) {
  const topic = process.env.KAFKA_DNS_TOPIC ?? "dns.telemetry";
  const kafkaBin = "/opt/kafka/bin";

  runCompose([
    "exec",
    "-T",
    "kafka",
    `${kafkaBin}/kafka-topics.sh`,
    "--bootstrap-server",
    "localhost:29092",
    "--create",
    "--if-not-exists",
    "--topic",
    topic,
    "--partitions",
    "1",
    "--replication-factor",
    "1",
  ]);

  runCompose(
    [
      "exec",
      "-T",
      "kafka",
      `${kafkaBin}/kafka-console-producer.sh`,
      "--bootstrap-server",
      "localhost:29092",
      "--topic",
      topic,
    ],
    { input: `${marker}\n` },
  );

  const consumed = runCompose(
    [
      "exec",
      "-T",
      "kafka",
      `${kafkaBin}/kafka-console-consumer.sh`,
      "--bootstrap-server",
      "localhost:29092",
      "--topic",
      topic,
      "--from-beginning",
      "--timeout-ms",
      "5000",
    ],
    { allowFailure: true },
  );

  if (!consumed.stdout.includes(marker)) {
    throw new Error(
      `Kafka did not return marker '${marker}':\n${consumed.stderr || consumed.stdout}`,
    );
  }
}

async function smokeClickHouse(marker) {
  const timestamp = new Date().toISOString().replace("T", " ").replace("Z", "");

  await clickHouseQuery(
    "INSERT INTO infra_smoke FORMAT JSONEachRow",
    `${JSON.stringify({
      observed_at: timestamp,
      component: "stage1-smoke",
      marker,
      value: 1,
    })}\n`,
  );

  const count = await clickHouseQuery(
    `SELECT count() FROM infra_smoke WHERE marker = '${marker}' FORMAT TabSeparated`,
  );

  if (Number.parseInt(count.trim(), 10) !== 1) {
    throw new Error(`ClickHouse did not persist marker '${marker}'.`);
  }
}

async function smokeGrafana() {
  const health = await grafanaRequest("/api/health");
  if (health.database !== "ok") {
    throw new Error(`Grafana database health is '${health.database}'.`);
  }

  await grafanaRequest("/api/datasources/uid/sentinel-clickhouse/health");
  const dashboard = await grafanaRequest(
    "/api/dashboards/uid/sentinel-infra-smoke",
  );
  const panels = dashboard.dashboard?.panels ?? [];
  const hasClickHousePanel = panels.some((panel) =>
    panel.targets?.some((target) =>
      target.rawSql?.includes("sentinel.infra_smoke"),
    ),
  );

  if (!hasClickHousePanel) {
    throw new Error("Grafana smoke dashboard has no ClickHouse-backed panel.");
  }
}

async function findWazuhAlert(incidentId) {
  const user = process.env.WAZUH_INDEXER_USER ?? "admin";
  const password = process.env.WAZUH_INDEXER_PASSWORD ?? "SecretPassword";
  const query = JSON.stringify({
    query: {
      match: {
        "data.incident_id": incidentId,
      },
    },
  });
  const result = runCompose(
    [
      "exec",
      "-T",
      "wazuh.indexer",
      "curl",
      "-kfsS",
      "-u",
      `${user}:${password}`,
      "-H",
      "Content-Type: application/json",
      "https://localhost:9200/wazuh-alerts-*/_search",
      "--data-binary",
      "@-",
    ],
    { allowFailure: true, input: query },
  );

  if (result.status !== 0) {
    return false;
  }

  const response = JSON.parse(result.stdout);
  return (response.hits?.total?.value ?? 0) > 0;
}

async function smokeWazuh(marker) {
  const fixturePath = path.join(
    root,
    "infra",
    "wazuh",
    "fixtures",
    "sentinel-event.json",
  );
  const runtimeDirectory = path.join(root, "infra", "wazuh", "runtime");
  const eventLog = path.join(runtimeDirectory, "events.json");
  const event = JSON.parse(await readFile(fixturePath, "utf8"));
  event.incident_id = `INC-STAGE1-${marker.slice(-12).toUpperCase()}`;

  await mkdir(runtimeDirectory, { recursive: true });
  await appendFile(eventLog, `${JSON.stringify(event)}\n`, "utf8");

  const dashboard = runCompose(
    [
      "exec",
      "-T",
      "wazuh.dashboard",
      "curl",
      "-kfsS",
      "-u",
      `${process.env.WAZUH_INDEXER_USER ?? "admin"}:${process.env.WAZUH_INDEXER_PASSWORD ?? "SecretPassword"}`,
      "https://localhost:5601/api/status",
    ],
    { allowFailure: true },
  );

  if (dashboard.status !== 0) {
    throw new Error(
      `Wazuh dashboard health failed:\n${dashboard.stderr || dashboard.stdout}`,
    );
  }

  for (let attempt = 0; attempt < 18; attempt += 1) {
    if (await findWazuhAlert(event.incident_id)) {
      return;
    }
    await delay(5000);
  }

  throw new Error(
    `Wazuh did not index processed incident '${event.incident_id}' within 90 seconds.`,
  );
}

const marker = `sentinel-stage1-${randomUUID()}`;

try {
  smokeKafka(marker);
  console.log("Kafka       PASS");

  await smokeClickHouse(marker);
  console.log("ClickHouse  PASS");

  await smokeGrafana();
  console.log("Grafana     PASS");

  await smokeWazuh(marker);
  console.log("Wazuh       PASS");
} catch (error) {
  console.error("Infrastructure smoke test: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
