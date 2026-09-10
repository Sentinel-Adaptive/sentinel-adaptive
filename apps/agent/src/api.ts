import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { SystemStatus } from "@sentinel-adaptive/contracts";

import {
  buildIncidentDetail,
  buildOverview,
  buildSiteDetail,
  buildSystemStatus,
  parseSiteId,
} from "./api-read.js";
import { OperatorStore } from "./store.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

export const defaultApiPort = 3001;

export function createOperatorApi(store: OperatorStore) {
  return createServer((request, response) => {
    void handleOperatorRequest(request, response, store);
  });
}

export async function handleOperatorRequest(
  request: IncomingMessage,
  response: ServerResponse,
  store: OperatorStore,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  cors(response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (request.method === "GET" && url.pathname === "/api/system") {
      json(response, 200, buildSystemStatus(probeServices()));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/overview") {
      json(response, 200, await buildOverview(store));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/incidents") {
      const overview = await buildOverview(store);
      json(response, 200, overview.recentIncidents);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/events") {
      sse(request, response, store);
      return;
    }
    const incidentMatch = /^\/api\/incidents\/([^/]+)$/.exec(url.pathname);
    if (request.method === "GET" && incidentMatch?.[1]) {
      const detail = await buildIncidentDetail(
        store,
        decodeURIComponent(incidentMatch[1]),
      );
      if (!detail) {
        json(response, 404, { error: "incident not found" });
        return;
      }
      json(response, 200, detail);
      return;
    }
    const siteMatch = /^\/api\/sites\/([^/]+)$/.exec(url.pathname);
    if (request.method === "GET" && siteMatch?.[1]) {
      const siteId = parseSiteId(decodeURIComponent(siteMatch[1]));
      if (!siteId) {
        json(response, 404, { error: "unknown site" });
        return;
      }
      json(response, 200, await buildSiteDetail(store, siteId));
      return;
    }
    json(response, 404, { error: "not found" });
  } catch (error) {
    json(response, 500, {
      error: error instanceof Error ? error.message : "operator api failed",
    });
  }
}

export function probeServices(): SystemStatus["services"] {
  const result = spawnSync(process.execPath, ["scripts/healthcheck.mjs"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 25_000,
  });
  const output = `${result.stdout}\n${result.stderr}`;
  return {
    kafka: serviceState(output, "Kafka"),
    clickhouse: serviceState(output, "ClickHouse"),
    grafana: serviceState(output, "Grafana"),
    wazuh: serviceState(output, "Wazuh"),
  };
}

function serviceState(
  output: string,
  name: "Kafka" | "ClickHouse" | "Grafana" | "Wazuh",
): "ok" | "down" | "unknown" {
  if (new RegExp(`${name}\\s+PASS`).test(output)) {
    return "ok";
  }
  if (new RegExp(`${name}\\s+FAIL`).test(output)) {
    return "down";
  }
  return "unknown";
}

function cors(response: ServerResponse): void {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body)}\n`);
}

function sse(
  request: IncomingMessage,
  response: ServerResponse,
  store: OperatorStore,
): void {
  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  response.write("event: ready\ndata: {}\n\n");
  const unsubscribe = store.subscribe((event) => {
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const keepalive = setInterval(() => {
    response.write(": keepalive\n\n");
  }, 15_000);
  request.on("close", () => {
    clearInterval(keepalive);
    unsubscribe();
  });
}

export function listenOperatorApi(
  store: OperatorStore,
  port = Number(process.env.SENTINEL_API_PORT ?? defaultApiPort),
): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createOperatorApi(store);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const bound =
        typeof address === "object" && address !== null ? address.port : port;
      resolve({
        port: bound,
        close: () =>
          new Promise((done, fail) => {
            server.close((error) => (error ? fail(error) : done()));
          }),
      });
    });
  });
}
