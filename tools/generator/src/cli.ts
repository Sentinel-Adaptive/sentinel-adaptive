import {
  scenarioTagSchema,
  siteIdSchema,
  type ScenarioTag,
  type SiteId,
} from "@sentinel-adaptive/contracts";

import { runScenario, type RunScenarioOptions } from "./controller.js";
import {
  defaultGeneratorSeed,
  defaultStartTime,
} from "./scenarios.js";

const usage = `Usage: npm run demo:<scenario> -- [options]

Options:
  --broker <host:port>       Kafka broker (default: localhost:9092)
  --count <number>           Events to publish (default: 30)
  --dry-run                  Print deterministic NDJSON without Kafka
  --interval-ms <number>     Delay between Kafka events (default: 25)
  --seed <number>            Deterministic seed (default: ${defaultGeneratorSeed})
  --site <site-id>           Limit generation to one fictional site
  --start-time <ISO-8601>    Event-time origin (default: ${defaultStartTime})
  --topic <name>             Kafka topic (default: dns.telemetry)`;

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

function parseInteger(value: string | undefined, option: string): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(`${option} requires a non-negative integer.`);
  }
  return Number(value);
}

function parseArguments(arguments_: readonly string[]): RunScenarioOptions {
  const parsedScenario = scenarioTagSchema.safeParse(arguments_[0]);
  if (!parsedScenario.success) {
    throw new Error(`Unknown scenario '${arguments_[0] ?? ""}'.\n${usage}`);
  }

  const options: Mutable<RunScenarioOptions> = {
    scenario: parsedScenario.data as ScenarioTag,
    count: 30,
    seed: defaultGeneratorSeed,
    intervalMs: 25,
    startTime: defaultStartTime,
  };

  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    switch (argument) {
      case "--broker":
        options.broker = arguments_[index + 1];
        index += 1;
        break;
      case "--count":
        options.count = parseInteger(arguments_[index + 1], argument);
        index += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--interval-ms":
        options.intervalMs = parseInteger(arguments_[index + 1], argument);
        index += 1;
        break;
      case "--seed":
        options.seed = parseInteger(arguments_[index + 1], argument);
        index += 1;
        break;
      case "--site": {
        const parsedSite = siteIdSchema.safeParse(arguments_[index + 1]);
        if (!parsedSite.success) {
          throw new Error(`Unknown fictional site '${arguments_[index + 1] ?? ""}'.`);
        }
        options.siteId = parsedSite.data as SiteId;
        index += 1;
        break;
      }
      case "--start-time":
        options.startTime = arguments_[index + 1];
        index += 1;
        break;
      case "--topic":
        options.topic = arguments_[index + 1];
        index += 1;
        break;
      default:
        throw new Error(`Unknown option '${argument ?? ""}'.\n${usage}`);
    }
  }

  return options;
}

try {
  const arguments_ = process.argv.slice(2);
  if (arguments_.includes("--help")) {
    console.log(usage);
  } else {
    const options = parseArguments(arguments_);
    const events = await runScenario(options);

    if (options.dryRun) {
      for (const event of events) {
        console.log(JSON.stringify(event));
      }
    } else {
      console.log(
        `Published ${events.length} deterministic synthetic '${options.scenario}' events to ${options.topic ?? "dns.telemetry"}.`,
      );
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
