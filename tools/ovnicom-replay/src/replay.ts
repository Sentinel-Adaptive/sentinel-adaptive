import {
  publishDnsEvents,
  type PublishOptions,
} from "@sentinel-adaptive/generator";
import type { DnsEvent } from "@sentinel-adaptive/contracts";

import { toReplayEvent } from "./enrich.js";
import { discoverQueryFiles } from "./files.js";
import { parseBindQueryLine } from "./parse.js";
import { readQueryLines } from "./stream.js";

export const defaultReplayLimit = 10_000;

export interface ReplayOptions extends PublishOptions {
  readonly path: string;
  readonly limit?: number;
  readonly dryRun?: boolean;
  readonly publish?: (
    events: readonly DnsEvent[],
    options?: PublishOptions,
  ) => Promise<void>;
}

export interface ReplayStats {
  readonly files: number;
  readonly linesRead: number;
  readonly published: number;
  readonly skipped: number;
  readonly topic: string;
}

async function flushBatch(
  batch: DnsEvent[],
  options: ReplayOptions,
): Promise<void> {
  if (batch.length === 0 || options.dryRun) {
    batch.length = 0;
    return;
  }

  const publish = options.publish ?? publishDnsEvents;
  await publish(batch, {
    broker: options.broker,
    topic: options.topic,
    intervalMs: options.intervalMs ?? 0,
  });
  batch.length = 0;
}

export async function replayOvnicomLogs(
  options: ReplayOptions,
): Promise<ReplayStats> {
  const limit = options.limit ?? defaultReplayLimit;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Replay limit must be a positive integer.");
  }

  const files = discoverQueryFiles(options.path);
  const topic = options.topic ?? process.env.KAFKA_TOPIC ?? "dns.telemetry";
  const batch: DnsEvent[] = [];
  let linesRead = 0;
  let published = 0;
  let skipped = 0;

  for await (const line of readQueryLines(options.path)) {
    linesRead += 1;
    if (line.text.trim().length === 0) {
      continue;
    }

    const parsed = parseBindQueryLine(line.text);
    const event = parsed
      ? toReplayEvent(parsed, line.originalFile, line.originalLine)
      : undefined;

    if (!event) {
      skipped += 1;
      continue;
    }

    batch.push(event);
    published += 1;

    if (batch.length >= 500) {
      await flushBatch(batch, options);
    }

    if (published >= limit) {
      break;
    }
  }

  await flushBatch(batch, options);

  return {
    files: files.length,
    linesRead,
    published,
    skipped,
    topic,
  };
}
