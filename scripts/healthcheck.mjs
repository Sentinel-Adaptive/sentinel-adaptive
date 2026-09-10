import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(root, "infra", "docker-compose.yml");

function runCheck(service, command) {
  return spawnSync(
    "docker",
    ["compose", "-f", composeFile, "exec", "-T", service, ...command],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    },
  );
}

const checks = [
  {
    name: "Kafka",
    commands: [
      [
        "kafka",
        "/opt/kafka/bin/kafka-broker-api-versions.sh",
        "--bootstrap-server",
        "localhost:29092",
      ],
    ],
  },
  {
    name: "ClickHouse",
    commands: [
      ["clickhouse", "wget", "--spider", "-q", "http://localhost:8123/ping"],
    ],
  },
  {
    name: "Grafana",
    commands: [
      ["grafana", "wget", "--spider", "-q", "http://localhost:3000/api/health"],
    ],
  },
  {
    name: "Wazuh",
    commands: [
      [
        "wazuh.manager",
        "bash",
        "-c",
        "/var/ossec/bin/wazuh-control status | grep -q 'wazuh-analysisd is running'",
      ],
      [
        "wazuh.indexer",
        "curl",
        "-kfsS",
        "-u",
        `${process.env.WAZUH_INDEXER_USER ?? "admin"}:${process.env.WAZUH_INDEXER_PASSWORD ?? "SecretPassword"}`,
        "https://localhost:9200/_cluster/health",
      ],
      [
        "wazuh.dashboard",
        "curl",
        "-kfsS",
        "-u",
        `${process.env.WAZUH_INDEXER_USER ?? "admin"}:${process.env.WAZUH_INDEXER_PASSWORD ?? "SecretPassword"}`,
        "https://localhost:5601/api/status",
      ],
    ],
  },
];

let failed = false;

for (const check of checks) {
  let failure;
  for (const [service, ...command] of check.commands) {
    const result = runCheck(service, command);
    if (result.status !== 0) {
      failure = result.stderr.trim() || result.stdout.trim() || "check failed";
      break;
    }
  }

  if (failure) {
    failed = true;
    console.error(`${check.name.padEnd(12)}FAIL`);
    console.error(`  ${failure}`);
  } else {
    console.log(`${check.name.padEnd(12)}PASS`);
  }
}

if (failed) {
  process.exitCode = 1;
}
