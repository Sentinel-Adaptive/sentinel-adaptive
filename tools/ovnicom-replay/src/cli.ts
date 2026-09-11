import path from "node:path";
import { fileURLToPath } from "node:url";

import { DatasetLookupError, resolveConfiguredDatasetPath } from "./files.js";
import { defaultReplayLimit, replayOvnicomLogs } from "./replay.js";
import {
  computeDatasetStats,
  writeDatasetStatsCache,
  type DatasetStats,
} from "./stats.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

function resolveDatasetPath(input: string): string {
  if (input.trim().length === 0) {
    throw new Error("Dataset path is required via --path or OVNICOM_DATASET_PATH.");
  }
  return resolveConfiguredDatasetPath(input, repoRoot);
}

const usage = `Usage: npm run ovnicom:replay -- [options]

Replay BIND query logs from the Ovnicom challenge dataset onto dns.telemetry.
The dataset path is never hardcoded; set OVNICOM_DATASET_PATH or pass --path.

Options:
  --path <dir-or-file>     Challenge dataset root or a single queries.<n> file
  --limit <number>         Maximum successfully parsed records (default: ${defaultReplayLimit})
  --interval-ms <number>   Delay between Kafka publishes (default: 0)
  --broker <host:port>     Kafka broker (default: localhost:9092)
  --topic <name>           Kafka topic (default: dns.telemetry)
  --stats                  Compute dataset statistics and write cache without publishing
  --cache <path>           Stats cache output path (default: <dataset-path>/../dataset-stats.json)
  --dry-run                Parse and count without publishing`;

function parseInteger(value: string | undefined, option: string): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(`${option} requires a non-negative integer.`);
  }
  return Number(value);
}

function defaultDatasetPath(): string {
  return resolveConfiguredDatasetPath(undefined, repoRoot);
}

function defaultCachePath(datasetPath: string): string {
  const resolved = path.resolve(datasetPath);
  const parent = path.dirname(resolved);
  return path.join(parent, "dataset-stats.json");
}

function parseArguments(arguments_: readonly string[]): {
  path: string;
  limit: number;
  intervalMs: number;
  broker?: string;
  topic?: string;
  dryRun: boolean;
  stats: boolean;
  cache?: string;
} {
  const options = {
    path: defaultDatasetPath(),
    limit: defaultReplayLimit,
    intervalMs: 0,
    broker: undefined as string | undefined,
    topic: undefined as string | undefined,
    dryRun: false,
    stats: false,
    cache: undefined as string | undefined,
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    switch (argument) {
      case "--path":
        options.path = resolveDatasetPath(arguments_[index + 1] ?? "");
        index += 1;
        break;
      case "--limit":
        options.limit = parseInteger(arguments_[index + 1], argument);
        index += 1;
        break;
      case "--interval-ms":
        options.intervalMs = parseInteger(arguments_[index + 1], argument);
        index += 1;
        break;
      case "--broker":
        options.broker = arguments_[index + 1];
        index += 1;
        break;
      case "--topic":
        options.topic = arguments_[index + 1];
        index += 1;
        break;
      case "--stats":
        options.stats = true;
        break;
      case "--cache":
        options.cache = arguments_[index + 1];
        index += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      default:
        throw new Error(`Unknown option '${argument ?? ""}'.\n${usage}`);
    }
  }

  if (options.path.trim().length === 0) {
    throw new Error(
      `Dataset path is required via --path or OVNICOM_DATASET_PATH.\n${usage}`,
    );
  }

  return options;
}

function printStats(stats: DatasetStats): void {
  console.log(JSON.stringify(stats, null, 2));
}

try {
  const arguments_ = process.argv.slice(2);
  if (arguments_.includes("--help")) {
    console.log(usage);
  } else {
    const options = parseArguments(arguments_);

    if (options.stats) {
      const stats = await computeDatasetStats(options.path);
      const cachePath = options.cache ?? defaultCachePath(options.path);
      writeDatasetStatsCache(stats, cachePath);
      printStats(stats);
    } else {
      const stats = await replayOvnicomLogs({
        path: options.path,
        limit: options.limit,
        intervalMs: options.intervalMs,
        broker: options.broker,
        topic: options.topic,
        dryRun: options.dryRun,
      });
      console.log(
        `${options.dryRun ? "Parsed" : "Published"} ${stats.published} ovnicom-challenge events ` +
          `(skipped ${stats.skipped}, files ${stats.files}, lines ${stats.linesRead}) ` +
          `to ${stats.topic}.`,
      );
    }
  }
} catch (error) {
  if (error instanceof DatasetLookupError) {
    console.error(
      error.code === "queries_not_found"
        ? "No queries.* files were found in the configured dataset."
        : "The configured dataset was not found.",
    );
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
}
