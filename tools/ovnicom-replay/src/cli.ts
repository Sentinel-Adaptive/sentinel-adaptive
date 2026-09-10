import { defaultReplayLimit, replayOvnicomLogs } from "./replay.js";

const usage = `Usage: npm run ovnicom:replay -- [options]

Replay BIND query logs from the Ovnicom challenge dataset onto dns.telemetry.
The dataset path is never hardcoded; set OVNICOM_DATASET_PATH or pass --path.

Options:
  --path <dir-or-file>     Challenge dataset root or a single queries.<n> file
  --limit <number>         Maximum successfully parsed records (default: ${defaultReplayLimit})
  --interval-ms <number>   Delay between Kafka publishes (default: 0)
  --broker <host:port>     Kafka broker (default: localhost:9092)
  --topic <name>           Kafka topic (default: dns.telemetry)
  --dry-run                Parse and count without publishing`;

function parseInteger(value: string | undefined, option: string): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(`${option} requires a non-negative integer.`);
  }
  return Number(value);
}

function parseArguments(arguments_: readonly string[]): {
  path: string;
  limit: number;
  intervalMs: number;
  broker?: string;
  topic?: string;
  dryRun: boolean;
} {
  const options = {
    path: process.env.OVNICOM_DATASET_PATH ?? "",
    limit: defaultReplayLimit,
    intervalMs: 0,
    broker: undefined as string | undefined,
    topic: undefined as string | undefined,
    dryRun: false,
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    switch (argument) {
      case "--path":
        options.path = arguments_[index + 1] ?? "";
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
      case "--dry-run":
        options.dryRun = true;
        break;
      default:
        throw new Error(`Unknown option '${argument ?? ""}'.\n${usage}`);
    }
  }

  if (options.path.trim().length === 0) {
    throw new Error(`Dataset path is required via --path or OVNICOM_DATASET_PATH.\n${usage}`);
  }

  return options;
}

try {
  const arguments_ = process.argv.slice(2);
  if (arguments_.includes("--help")) {
    console.log(usage);
  } else {
    const options = parseArguments(arguments_);
    const stats = await replayOvnicomLogs(options);
    console.log(
      `${options.dryRun ? "Parsed" : "Published"} ${stats.published} ovnicom-challenge events ` +
        `(skipped ${stats.skipped}, files ${stats.files}, lines ${stats.linesRead}) ` +
        `to ${stats.topic}.`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
