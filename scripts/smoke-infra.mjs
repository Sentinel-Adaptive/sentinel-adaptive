import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
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

const marker = `sentinel-stage1-${randomUUID()}`;

try {
  smokeKafka(marker);
  console.log("Kafka       PASS");

  await smokeClickHouse(marker);
  console.log("ClickHouse  PASS");
} catch (error) {
  console.error("Infrastructure smoke test: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
