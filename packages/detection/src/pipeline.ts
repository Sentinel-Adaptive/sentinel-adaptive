import {
  dnsEventSchema,
  type DnsEvent,
  type Signal,
  type SiteId,
  type SiteQoe,
  type SiteWindowMetrics,
} from "@sentinel-adaptive/contracts";

import { computeBaseline, type SiteBaseline } from "./baseline.js";
import { calculateQoe } from "./qoe.js";
import { evaluateRules } from "./rules.js";
import {
  BUCKET_MS,
  MAX_BUCKETS,
  bucketStartMs,
  buildBucketMetrics,
  windowCutoffMs,
} from "./window.js";

interface SiteState {
  events: DnsEvent[];
  completedBuckets: SiteWindowMetrics[];
  currentBucketStart: number | null;
  currentEvents: DnsEvent[];
}

export interface DetectionEngineOptions {
  readonly onBucketComplete?: (
    metrics: SiteWindowMetrics,
    events: readonly DnsEvent[],
    qoe: SiteQoe,
  ) => void;
}

export class DetectionEngine {
  private readonly sites = new Map<SiteId, SiteState>();

  constructor(private readonly options: DetectionEngineOptions = {}) {}

  ingest(raw: unknown): void {
    const event = dnsEventSchema.parse(raw);
    const state = this.stateFor(event.siteId);
    const start = bucketStartMs(event.timestamp);

    if (state.currentBucketStart === null) {
      state.currentBucketStart = start;
    } else if (start > state.currentBucketStart) {
      this.finalizeCurrent(event.siteId, state);
      state.currentBucketStart = start;
      state.currentEvents = [];
    }

    if (start === state.currentBucketStart) {
      state.currentEvents.push(event);
    }
    state.events.push(event);
    this.trim(state, Date.parse(event.timestamp));
  }

  flush(): Signal[] {
    for (const [siteId, state] of this.sites) {
      if (state.currentEvents.length > 0 && state.currentBucketStart !== null) {
        this.finalizeCurrent(siteId, state);
        state.currentBucketStart = null;
        state.currentEvents = [];
      }
    }
    return this.evaluate();
  }

  completedWindows(): SiteWindowMetrics[] {
    return [...this.sites.values()]
      .flatMap((state) => state.completedBuckets)
      .sort(
        (left, right) =>
          Date.parse(left.bucketStart) - Date.parse(right.bucketStart),
      );
  }

  evaluate(): Signal[] {
    const signals: Signal[] = [];
    for (const [siteId, state] of this.sites) {
      const current = state.completedBuckets.at(-1);
      const history = state.completedBuckets.slice(0, -1);
      const baseline: SiteBaseline = computeBaseline(history);
      signals.push(
        ...evaluateRules({
          siteId,
          events: state.events,
          current,
          baseline,
          historyCount: history.length,
        }),
      );
    }
    return signals;
  }

  private stateFor(siteId: SiteId): SiteState {
    const existing = this.sites.get(siteId);
    if (existing) {
      return existing;
    }
    const created: SiteState = {
      events: [],
      completedBuckets: [],
      currentBucketStart: null,
      currentEvents: [],
    };
    this.sites.set(siteId, created);
    return created;
  }

  private finalizeCurrent(siteId: SiteId, state: SiteState): void {
    if (state.currentBucketStart === null) {
      return;
    }
    const metrics = buildBucketMetrics(
      siteId,
      state.currentBucketStart,
      state.currentEvents,
    );
    const qoe = calculateQoe(
      metrics,
      state.completedBuckets.length > 0
        ? computeBaseline(state.completedBuckets)
        : undefined,
    );
    state.completedBuckets.push(metrics);
    this.options.onBucketComplete?.(metrics, state.currentEvents, qoe);
    if (state.completedBuckets.length > MAX_BUCKETS) {
      state.completedBuckets.splice(
        0,
        state.completedBuckets.length - MAX_BUCKETS,
      );
    }
  }

  private trim(state: SiteState, nowMs: number): void {
    const cutoff = windowCutoffMs(nowMs);
    state.events = state.events.filter(
      (event) => Date.parse(event.timestamp) >= cutoff,
    );
    state.completedBuckets = state.completedBuckets.filter(
      (bucket) => Date.parse(bucket.bucketStart) >= cutoff,
    );
  }
}

export function processEvents(events: readonly unknown[]): Signal[] {
  const engine = new DetectionEngine();
  const parsed = events
    .map((event) => dnsEventSchema.parse(event))
    .sort(
      (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
    );
  for (const event of parsed) {
    engine.ingest(event);
  }
  return engine.flush();
}

export function collectSiteWindows(
  events: readonly unknown[],
): SiteWindowMetrics[] {
  const engine = new DetectionEngine();
  const parsed = events
    .map((event) => dnsEventSchema.parse(event))
    .sort(
      (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
    );
  for (const event of parsed) {
    engine.ingest(event);
  }
  engine.flush();
  return engine.completedWindows();
}

export const windowConstants = { BUCKET_MS, MAX_BUCKETS };
