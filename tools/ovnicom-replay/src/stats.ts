import { writeFileSync } from "node:fs";
import path from "node:path";

import { parseBindQueryLine, type ParsedBindQuery } from "./parse.js";
import { readQueryLines } from "./stream.js";

export interface FileStat {
  readonly file: string;
  readonly lines: number;
  readonly parsed: number;
  readonly skipped: number;
}

export interface CountedExample {
  readonly value: string;
  readonly count: number;
}

export interface DatasetStats {
  path: string;
  generatedAt: string;
  files: number;
  linesRead: number;
  parsed: number;
  skipped: number;
  uniqueClients: number;
  uniqueQnames: number;
  earliestTimestamp?: string;
  latestTimestamp?: string;
  topQnames: CountedExample[];
  topClients: CountedExample[];
  qtypeCounts: Record<string, number>;
  fileStats: FileStat[];
}

function topExamples(
  counts: Map<string, number>,
  limit: number,
): CountedExample[] {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function normalizeQname(qname: string): string {
  return qname.toLowerCase();
}

export async function computeDatasetStats(
  datasetPath: string,
): Promise<DatasetStats> {
  const clientCounts = new Map<string, number>();
  const qnameCounts = new Map<string, number>();
  const qtypeCounts: Record<string, number> = {};
  const fileStats = new Map<string, FileStat>();

  let linesRead = 0;
  let parsed = 0;
  let skipped = 0;

  const context: IngestContext = {
    clientCounts,
    qnameCounts,
    qtypeCounts,
    earliest: undefined,
    latest: undefined,
  };

  for await (const line of readQueryLines(datasetPath)) {
    linesRead += 1;

    let current = fileStats.get(line.originalFile);
    if (!current) {
      current = { file: line.originalFile, lines: 0, parsed: 0, skipped: 0 };
      fileStats.set(line.originalFile, current);
    }
    current = { ...current, lines: current.lines + 1 };

    const record = parseBindQueryLine(line.text);
    if (!record) {
      skipped += 1;
      current = { ...current, skipped: current.skipped + 1 };
      fileStats.set(line.originalFile, current);
      continue;
    }

    parsed += 1;
    current = { ...current, parsed: current.parsed + 1 };
    fileStats.set(line.originalFile, current);

    ingestRecord(record, context);
  }

  return {
    path: path.resolve(datasetPath),
    generatedAt: new Date().toISOString(),
    files: fileStats.size,
    linesRead,
    parsed,
    skipped,
    uniqueClients: clientCounts.size,
    uniqueQnames: qnameCounts.size,
    earliestTimestamp: context.earliest?.toISOString(),
    latestTimestamp: context.latest?.toISOString(),
    topQnames: topExamples(qnameCounts, 10),
    topClients: topExamples(clientCounts, 10),
    qtypeCounts,
    fileStats: [...fileStats.values()].sort((left, right) =>
      left.file.localeCompare(right.file),
    ),
  };
}

interface IngestContext {
  clientCounts: Map<string, number>;
  qnameCounts: Map<string, number>;
  qtypeCounts: Record<string, number>;
  earliest: Date | undefined;
  latest: Date | undefined;
}

function ingestRecord(record: ParsedBindQuery, context: IngestContext): void {
  const timestamp = new Date(record.timestamp);
  if (!context.earliest || timestamp < context.earliest) {
    context.earliest = timestamp;
  }
  if (!context.latest || timestamp > context.latest) {
    context.latest = timestamp;
  }

  context.clientCounts.set(
    record.clientIp,
    (context.clientCounts.get(record.clientIp) ?? 0) + 1,
  );

  const qnameKey = normalizeQname(record.qname);
  context.qnameCounts.set(
    qnameKey,
    (context.qnameCounts.get(qnameKey) ?? 0) + 1,
  );

  context.qtypeCounts[record.qtype] =
    (context.qtypeCounts[record.qtype] ?? 0) + 1;
}

export function writeDatasetStatsCache(
  stats: DatasetStats,
  cachePath: string,
): void {
  writeFileSync(cachePath, `${JSON.stringify(stats, null, 2)}\n`, "utf8");
}
