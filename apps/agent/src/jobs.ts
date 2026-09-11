import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  datasetStatsSchema,
  type BackgroundSimulationRequest,
  type DatasetStats,
  type DnsEvent,
  type MixedSimulationRequest,
  type SimulationJob,
  type SimulationMode,
  type SimulationStatus,
  type SiteId,
  type SyntheticSimulationRequest,
} from "@sentinel-adaptive/contracts";
import {
  createDnsPublisher,
  generateScenario,
  type DnsPublisher,
} from "@sentinel-adaptive/generator";
import {
  DatasetLookupError,
  discoverQueryFiles,
  replayOvnicomLogs,
  resolveConfiguredDatasetPath,
} from "@sentinel-adaptive/ovnicom-replay";

import { operatorStore } from "./store.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

export const simulationErrorCodes = [
  "dataset_not_found",
  "queries_not_found",
  "kafka_unavailable",
  "generator_failed",
  "cancelled",
  "job_failed",
] as const;

export type SimulationErrorCode = (typeof simulationErrorCodes)[number];

class JobCancelledError extends Error {
  constructor() {
    super("cancelled");
    this.name = "JobCancelledError";
  }
}

interface JobUpdate {
  status?: SimulationStatus;
  progress?: Record<string, unknown>;
  error?: string;
  finishedAt?: string;
}

function readStatsCache(datasetPath: string): DatasetStats | undefined {
  const resolved = path.resolve(datasetPath);
  const parent = path.dirname(resolved);
  const cachePath = path.join(parent, "dataset-stats.json");
  if (!existsSync(cachePath)) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(readFileSync(cachePath, "utf8"));
    return datasetStatsSchema.parse(parsed);
  } catch {
    return undefined;
  }
}

export function resolveSimulationDatasetPath(input?: string): string {
  return resolveConfiguredDatasetPath(input, repoRoot);
}

export function classifySimulationError(error: unknown): SimulationErrorCode {
  if (error instanceof JobCancelledError) {
    return "cancelled";
  }
  if (error instanceof DatasetLookupError) {
    return error.code;
  }

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  const code =
    error !== null && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const combined = `${name} ${code} ${message}`.toLowerCase();

  if (
    code === "ENOENT" ||
    combined.includes("enoent") ||
    combined.includes("dataset_not_found")
  ) {
    return "dataset_not_found";
  }
  if (
    combined.includes("queries_not_found") ||
    combined.includes("no query files") ||
    combined.includes("queries.*")
  ) {
    return "queries_not_found";
  }
  if (
    combined.includes("kafka") ||
    combined.includes("broker") ||
    combined.includes("econnrefused") ||
    combined.includes("enotfound") ||
    combined.includes("connection timeout") ||
    combined.includes("request timed out") ||
    combined.includes("network")
  ) {
    return "kafka_unavailable";
  }
  if (
    combined.includes("generate") ||
    combined.includes("scenario") ||
    combined.includes("publish interval")
  ) {
    return "generator_failed";
  }
  return "job_failed";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class JobManager {
  private readonly jobs = new Map<string, SimulationJob>();
  private active = 0;
  private readonly maxConcurrent = 1;

  list(): SimulationJob[] {
    return [...this.jobs.values()].sort(
      (left, right) =>
        Date.parse(right.startedAt) - Date.parse(left.startedAt),
    );
  }

  get(id: string): SimulationJob | undefined {
    return this.jobs.get(id);
  }

  cancel(id: string): SimulationJob | undefined {
    const job = this.jobs.get(id);
    if (!job || job.status === "completed" || job.status === "failed") {
      return job;
    }
    return this.update(id, {
      status: "cancelled",
      error: "cancelled",
      finishedAt: new Date().toISOString(),
    });
  }

  private create(mode: SimulationMode, params: Record<string, unknown>): SimulationJob {
    const job: SimulationJob = {
      id: randomUUID(),
      mode,
      status: "queued",
      params,
      progress: { stage: "queued" },
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    this.emit(job);
    return job;
  }

  private update(id: string, changes: JobUpdate): SimulationJob {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job ${id} not found`);
    }
    if (
      (job.status === "cancelled" || job.status === "failed" || job.status === "completed") &&
      changes.status !== undefined &&
      changes.status !== job.status
    ) {
      return job;
    }
    const next: SimulationJob = {
      ...job,
      ...changes,
      progress: { ...job.progress, ...(changes.progress ?? {}) },
    };
    this.jobs.set(id, next);
    this.emit(next);
    return next;
  }

  private emit(job: SimulationJob): void {
    operatorStore.recordJob(job);
  }

  private assertActive(id: string): void {
    if (this.get(id)?.status === "cancelled") {
      throw new JobCancelledError();
    }
  }

  private async acquire(): Promise<void> {
    while (this.active >= this.maxConcurrent) {
      await delay(250);
    }
    this.active += 1;
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
  }

  async startBackground(
    request: BackgroundSimulationRequest,
  ): Promise<SimulationJob> {
    const job = this.create("background", request as Record<string, unknown>);
    void this.runBackground(job.id, request);
    return job;
  }

  async startSynthetic(
    request: SyntheticSimulationRequest,
  ): Promise<SimulationJob> {
    const job = this.create("synthetic", request as Record<string, unknown>);
    void this.runSynthetic(job.id, request);
    return job;
  }

  async startMixed(request: MixedSimulationRequest): Promise<SimulationJob> {
    const job = this.create("mixed", request as Record<string, unknown>);
    void this.runMixed(job.id, request);
    return job;
  }

  private async runBackground(
    id: string,
    request: BackgroundSimulationRequest,
  ): Promise<void> {
    await this.acquire();
    let publisher: DnsPublisher | undefined;
    try {
      this.assertActive(id);
      const datasetPath = resolveSimulationDatasetPath(request.path);
      const files = discoverQueryFiles(datasetPath);
      if (files.length === 0) {
        throw new DatasetLookupError("queries_not_found");
      }
      this.update(id, {
        status: "running",
        progress: {
          stage: "publishing",
          published: 0,
          skipped: 0,
          limit: request.limit,
          files: files.length,
        },
      });
      publisher = await createDnsPublisher({ intervalMs: request.intervalMs });
      this.assertActive(id);
      const stats = await replayOvnicomLogs({
        path: datasetPath,
        limit: request.limit,
        intervalMs: request.intervalMs,
        publish: async (events) => {
          this.assertActive(id);
          await publisher?.publish(events, request.intervalMs);
        },
      });
      this.assertActive(id);
      this.update(id, {
        status: "completed",
        progress: {
          ...stats,
          stage: "completed",
          limit: request.limit,
          datasetPublished: stats.published,
        },
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.fail(id, error);
    } finally {
      await publisher?.close().catch(() => undefined);
      this.release();
    }
  }

  private async runSynthetic(
    id: string,
    request: SyntheticSimulationRequest,
  ): Promise<void> {
    await this.acquire();
    let publisher: DnsPublisher | undefined;
    try {
      this.assertActive(id);
      this.update(id, {
        status: "running",
        progress: { stage: "generating", generated: 0, published: 0 },
      });
      const events = generateScenario({
        scenario: request.scenario,
        count: request.count,
        siteId: request.siteId,
        seed: request.seed,
      });
      this.update(id, {
        progress: {
          stage: "publishing",
          generated: events.length,
          published: 0,
        },
      });
      publisher = await createDnsPublisher({ intervalMs: request.intervalMs });
      this.assertActive(id);
      await publisher.publish(events, request.intervalMs);
      this.assertActive(id);
      this.update(id, {
        status: "completed",
        progress: {
          stage: "completed",
          generated: events.length,
          published: events.length,
        },
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.fail(id, error);
    } finally {
      await publisher?.close().catch(() => undefined);
      this.release();
    }
  }

  private async runMixed(
    id: string,
    request: MixedSimulationRequest,
  ): Promise<void> {
    await this.acquire();
    let publisher: DnsPublisher | undefined;
    try {
      this.assertActive(id);
      const datasetPath = resolveSimulationDatasetPath(request.path);
      const files = discoverQueryFiles(datasetPath);
      if (files.length === 0) {
        throw new DatasetLookupError("queries_not_found");
      }

      const {
        burstScenario,
        burstCount,
        burstEvery,
        intervalMs,
      } = request;
      const burstSiteId: SiteId = request.siteId ?? "PTY-HEALTH-01";

      let datasetPublished = 0;
      let syntheticPublished = 0;
      let burstsInjected = 0;
      let skipped = 0;
      let nextInjectAt = burstEvery;

      const snapshot = (): Record<string, unknown> => ({
        stage: "publishing",
        limit: request.realLimit,
        files: files.length,
        published: datasetPublished,
        skipped,
        datasetPublished,
        realPublished: datasetPublished,
        syntheticPublished,
        burstsInjected,
      });

      this.update(id, { status: "running", progress: snapshot() });
      publisher = await createDnsPublisher({ intervalMs });
      this.assertActive(id);

      const publishMixed = async (events: readonly DnsEvent[]): Promise<void> => {
        this.assertActive(id);
        datasetPublished += events.length;

        const injected: DnsEvent[] = [];
        while (datasetPublished >= nextInjectAt) {
          const burst = generateScenario({
            scenario: burstScenario,
            count: burstCount,
            siteId: burstSiteId,
            startTime: new Date().toISOString(),
          });
          injected.push(...burst);
          burstsInjected += 1;
          syntheticPublished += burst.length;
          nextInjectAt += burstEvery;
        }

        this.update(id, { progress: snapshot() });
        const combined = injected.length > 0 ? [...events, ...injected] : events;
        await publisher?.publish(combined, intervalMs);
        this.update(id, { progress: snapshot() });
      };

      const stats = await replayOvnicomLogs({
        path: datasetPath,
        limit: request.realLimit,
        intervalMs,
        publish: publishMixed,
      });
      skipped = stats.skipped;
      this.assertActive(id);
      this.update(id, {
        status: "completed",
        progress: {
          ...stats,
          ...snapshot(),
          stage: "completed",
          skipped: stats.skipped,
        },
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.fail(id, error);
    } finally {
      await publisher?.close().catch(() => undefined);
      this.release();
    }
  }

  private fail(id: string, error: unknown): void {
    const job = this.get(id);
    if (!job || job.status === "cancelled" || job.status === "completed") {
      return;
    }
    const code = classifySimulationError(error);
    if (code === "cancelled") {
      this.update(id, {
        status: "cancelled",
        error: code,
        finishedAt: new Date().toISOString(),
      });
      return;
    }
    console.error(`Simulation job ${id} failed (${code}):`, error);
    this.update(id, {
      status: "failed",
      error: code,
      progress: {
        ...job.progress,
        errorCode: code,
      },
      finishedAt: new Date().toISOString(),
    });
  }

  async getDatasetStats(pathOverride?: string): Promise<DatasetStats | null> {
    try {
      const datasetPath = resolveSimulationDatasetPath(pathOverride);
      const cached = readStatsCache(datasetPath);
      if (cached) {
        return cached;
      }
      const files = discoverQueryFiles(datasetPath);
      if (files.length === 0) {
        return null;
      }
      return {
        path: datasetPath,
        generatedAt: new Date().toISOString(),
        files: files.length,
        linesRead: 0,
        parsed: 0,
        skipped: 0,
        uniqueClients: 0,
        uniqueQnames: 0,
        topQnames: [],
        topClients: [],
        qtypeCounts: {},
        fileStats: files.map((file) => ({
          file: path.basename(file),
          lines: 0,
          parsed: 0,
          skipped: 0,
        })),
      };
    } catch {
      return null;
    }
  }
}

export const simulationJobs = new JobManager();
