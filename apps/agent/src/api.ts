import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  backgroundSimulationRequestSchema,
  mixedSimulationRequestSchema,
  syntheticSimulationRequestSchema,
  type SystemStatus,
} from "@sentinel-adaptive/contracts";

import {
  buildIncidentDetail,
  buildOverview,
  buildSiteDetail,
  buildSystemStatus,
  parseSiteId,
  readIncidents,
} from "./api-read.js";
import { simulationJobs } from "./jobs.js";
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
      json(response, 200, buildSystemStatus(await probeServices()));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/overview") {
      json(response, 200, await buildOverview(store));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/incidents") {
      const stored = store.listIncidents();
      const incidents = stored.length > 0 ? stored : await readIncidents();
      json(response, 200, incidents.slice(0, 100));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/events") {
      sse(request, response, store);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/simulation/jobs") {
      json(response, 200, store.listJobs());
      return;
    }
    const jobMatch = /^\/api\/simulation\/jobs\/([^/]+)$/.exec(url.pathname);
    if (request.method === "GET" && jobMatch?.[1]) {
      const job = store.getJob(jobMatch[1]);
      if (!job) {
        json(response, 404, { error: "job not found" });
        return;
      }
      json(response, 200, job);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/simulation/jobs/cancel") {
      const body = await readJsonBody(request);
      const jobId = typeof body === "object" && body !== null && "id" in body ? String(body.id) : "";
      const job = jobId ? simulationJobs.cancel(jobId) : undefined;
      if (!job) {
        json(response, 404, { error: "job not found" });
        return;
      }
      json(response, 200, job);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/simulation/dataset") {
      const stats = await simulationJobs.getDatasetStats();
      json(response, 200, stats);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/simulation/background") {
      const body = await readJsonBody(request);
      const request_ = backgroundSimulationRequestSchema.parse(body);
      const job = await simulationJobs.startBackground(request_);
      json(response, 202, job);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/simulation/synthetic") {
      const body = await readJsonBody(request);
      const request_ = syntheticSimulationRequestSchema.parse(body);
      const job = await simulationJobs.startSynthetic(request_);
      json(response, 202, job);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/simulation/mixed") {
      const body = await readJsonBody(request);
      const request_ = mixedSimulationRequestSchema.parse(body);
      const job = await simulationJobs.startMixed(request_);
      json(response, 202, job);
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

const healthCacheMs = 15_000;
const unknownServices: SystemStatus["services"] = {
  kafka: "unknown",
  clickhouse: "unknown",
  grafana: "unknown",
  wazuh: "unknown",
};

let healthCache:
  | { at: number; services: SystemStatus["services"] }
  | undefined;
let healthInflight: Promise<SystemStatus["services"]> | undefined;

export async function probeServices(): Promise<SystemStatus["services"]> {
  if (healthCache && Date.now() - healthCache.at < healthCacheMs) {
    return healthCache.services;
  }
  if (healthInflight) {
    return healthInflight;
  }
  healthInflight = collectHealth()
    .then((services) => {
      healthCache = { at: Date.now(), services };
      return services;
    })
    .finally(() => {
      healthInflight = undefined;
    });
  return healthInflight;
}

function collectHealth(): Promise<SystemStatus["services"]> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/healthcheck.mjs"], {
      cwd: root,
      windowsHide: true,
    });
    let output = "";
    let settled = false;
    const finish = (services: SystemStatus["services"]) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(services);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(unknownServices);
    }, 25_000);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("close", () => {
      clearTimeout(timer);
      finish({
        kafka: serviceState(output, "Kafka"),
        clickhouse: serviceState(output, "ClickHouse"),
        grafana: serviceState(output, "Grafana"),
        wazuh: serviceState(output, "Wazuh"),
      });
    });
    child.on("error", () => {
      clearTimeout(timer);
      finish(unknownServices);
    });
  });
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
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body.length > 0 ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
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
