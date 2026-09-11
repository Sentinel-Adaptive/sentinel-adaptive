import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { datasetStatsSchema, type BackgroundSimulationRequest, type DatasetStats, type MixedSimulationRequest, type SimulationJob, type SimulationMode, type SimulationStatus, type SyntheticSimulationRequest } from "@sentinel-adaptive/contracts";
import {
  generateScenario,
  publishDnsEvents,
  type PublishOptions,
} from "@sentinel-adaptive/generator";
import {
  computeDatasetStats,
  replayOvnicomLogs,
  type ReplayOptions,
} from "@sentinel-adaptive/ovnicom-replay";

import { operatorStore } from "./store.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

const DEFAULT_DATASET_PATH = "data/ovnicom/LogsDNSQueries";

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

function resolveDatasetPath(input?: string): string {
  const trimmed = input?.trim() ?? "";
  if (!trimmed) {
    return path.resolve(repoRoot, DEFAULT_DATASET_PATH);
  }
  return path.isAbsolute(trimmed) ? trimmed : path.resolve(repoRoot, trimmed);
}

interface JobUpdate {
  status?: SimulationStatus;
  progress?: Record<string, unknown>;
  error?: string;
  finishedAt?: string;
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
    return this.update(id, { status: "cancelled", finishedAt: new Date().toISOString() });
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
    this.runBackground(job.id, request);
    return job;
  }

  async startSynthetic(
    request: SyntheticSimulationRequest,
  ): Promise<SimulationJob> {
    const job = this.create("synthetic", request as Record<string, unknown>);
    this.runSynthetic(job.id, request);
    return job;
  }

  async startMixed(request: MixedSimulationRequest): Promise<SimulationJob> {
    const job = this.create("mixed", request as Record<string, unknown>);
    this.runMixed(job.id, request);
    return job;
  }

  private async runBackground(
    id: string,
    request: BackgroundSimulationRequest,
  ): Promise<void> {
    await this.acquire();
    const datasetPath = resolveDatasetPath(request.path);
    this.update(id, { status: "running", progress: { stage: "publishing" } });
    try {
      const stats = await replayOvnicomLogs({
        path: datasetPath,
        limit: request.limit,
        intervalMs: request.intervalMs,
      });
      this.update(id, {
        status: "completed",
        progress: { ...stats, stage: "completed" },
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.fail(id, error);
    } finally {
      this.release();
    }
  }

  private async runSynthetic(
    id: string,
    request: SyntheticSimulationRequest,
  ): Promise<void> {
    await this.acquire();
    this.update(id, {
      status: "running",
      progress: { stage: "generating", generated: 0, published: 0 },
    });
    try {
      const options = {
        scenario: request.scenario,
        count: request.count,
        siteId: request.siteId,
        seed: request.seed,
      };
      const events = generateScenario(options);
      this.update(id, {
        progress: { stage: "publishing", generated: events.length },
      });
      await publishDnsEvents(events, { intervalMs: request.intervalMs });
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
      this.release();
    }
  }

  private async runMixed(
    id: string,
    request: MixedSimulationRequest,
  ): Promise<void> {
    await this.acquire();
    const datasetPath = resolveDatasetPath(request.path);
    const {
      burstScenario,
      burstCount,
      burstEvery,
      intervalMs,
    } = request;

    let realPublished = 0;
    let syntheticPublished = 0;
    let burstsInjected = 0;
    let nextInjectAt = burstEvery;

    this.update(id, {
      status: "running",
      progress: {
        stage: "publishing",
        realPublished: 0,
        burstsInjected: 0,
        syntheticPublished: 0,
      },
    });

    const publishMixed = async (
      events: readonly import("@sentinel-adaptive/contracts").DnsEvent[],
      options: PublishOptions,
    ): Promise<void> => {
      realPublished += events.length;

      const injected: import("@sentinel-adaptive/contracts").DnsEvent[] = [];
      while (realPublished >= nextInjectAt) {
        const siteId =
          events[0]?.siteId ??
          (request.siteId as import("@sentinel-adaptive/contracts").SiteId | undefined) ??
          "PTY-BANK-01";
        const burst = generateScenario({
          scenario: burstScenario,
          count: burstCount,
          siteId,
          startTime: new Date().toISOString(),
        });
        injected.push(...burst);
        burstsInjected += 1;
        syntheticPublished += burst.length;
        nextInjectAt += burstEvery;
      }

      const combined = injected.length > 0 ? [...events, ...injected] : events;
      await publishDnsEvents(combined, options);

      this.update(id, {
        progress: {
          stage: "publishing",
          realPublished,
          burstsInjected,
          syntheticPublished,
        },
      });
    };

    try {
      const stats = await replayOvnicomLogs({
        path: datasetPath,
        limit: request.realLimit,
        intervalMs,
        publish: publishMixed,
      } as ReplayOptions);
      this.update(id, {
        status: "completed",
        progress: {
          ...stats,
          stage: "completed",
          realPublished,
          burstsInjected,
          syntheticPublished,
        },
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.fail(id, error);
    } finally {
      this.release();
    }
  }

  private fail(id: string, error: unknown): void {
    this.update(id, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      finishedAt: new Date().toISOString(),
    });
  }

  async getDatasetStats(pathOverride?: string): Promise<DatasetStats | null> {
    const datasetPath = resolveDatasetPath(pathOverride);
    const cached = readStatsCache(datasetPath);
    if (cached) {
      return cached;
    }
    try {
      return await computeDatasetStats(datasetPath);
    } catch {
      return null;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const simulationJobs = new JobManager();
