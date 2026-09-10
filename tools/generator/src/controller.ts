import type { DnsEvent } from "@sentinel-adaptive/contracts";

import { publishDnsEvents, type PublishOptions } from "./producer.js";
import {
  generateScenario,
  type GenerateScenarioOptions,
} from "./scenarios.js";

export interface RunScenarioOptions
  extends GenerateScenarioOptions,
    PublishOptions {
  readonly dryRun?: boolean;
}

export async function runScenario(
  options: RunScenarioOptions,
): Promise<readonly DnsEvent[]> {
  const events = generateScenario(options);

  if (!options.dryRun) {
    await publishDnsEvents(events, options);
  }

  return events;
}
