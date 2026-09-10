import {
  dnsEventSchema,
  type DnsEvent,
  type ScenarioTag,
  type SiteId,
} from "@sentinel-adaptive/contracts";

import { createDeterministicRandom, type DeterministicRandom } from "./random.js";
import { allFictionalSites, fictionalSites, type SiteProfile } from "./sites.js";

export const defaultGeneratorSeed = 424_242;
export const defaultStartTime = "2026-09-10T12:00:00.000Z";

export interface GenerateScenarioOptions {
  readonly scenario: ScenarioTag;
  readonly count?: number;
  readonly seed?: number;
  readonly siteId?: SiteId;
  readonly startTime?: string;
}

const typoDomains = [
  "secure-bnak.test",
  "health-protal.test",
  "citzien-services.test",
] as const;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function randomLabel(
  random: DeterministicRandom,
  length: number,
  alphabet = "abcdefghijklmnopqrstuvwxyz0123456789",
): string {
  let label = "";
  for (let index = 0; index < length; index += 1) {
    label += alphabet[random.integer(0, alphabet.length - 1)];
  }
  return label;
}

function selectSite(
  scenario: ScenarioTag,
  sequence: number,
  siteId?: SiteId,
): SiteProfile {
  if (siteId) {
    return fictionalSites[siteId];
  }
  if (scenario === "normal" || scenario === "combined") {
    return allFictionalSites[sequence % allFictionalSites.length] as SiteProfile;
  }
  return fictionalSites["PTY-BANK-01"];
}

function createNormalEvent(
  profile: SiteProfile,
  sequence: number,
  seed: number,
  timestampMs: number,
  random: DeterministicRandom,
): DnsEvent {
  const isNxdomain = random.chance(profile.nxdomainRate);
  const latencyOffset =
    (random.next() * 2 - 1) * profile.latencyJitterMs;

  return {
    timestamp: new Date(timestampMs).toISOString(),
    siteId: profile.id,
    zone: profile.zone,
    clientIp: `${profile.clientPrefix.join(".")}.${20 + (sequence % 180)}`,
    qname: isNxdomain
      ? `missing-${sequence}.${profile.zone}.test`
      : random.pick(profile.normalDomains),
    qtype: random.chance(0.18) ? "AAAA" : "A",
    rcode: isNxdomain ? "NXDOMAIN" : "NOERROR",
    latencyMs: round(Math.max(1, profile.baseLatencyMs + latencyOffset)),
    resolverId: profile.resolverId,
    scenarioTag: "normal",
    source: "sentinel-synthetic",
    synthetic: true,
    saturation: profile.saturation,
    generator: {
      seed,
      sequence,
    },
    provenance: {
      scenario: "normal",
    },
  };
}

const ambiguousBeaconOffsets = [0, 12_000, 24_000, 39_400] as const;

function applyBehavior(
  event: DnsEvent,
  behavior: Exclude<ScenarioTag, "normal" | "background" | "combined">,
  sequence: number,
  startTimeMs: number,
  random: DeterministicRandom,
): DnsEvent {
  switch (behavior) {
    case "dga":
      return {
        ...event,
        qname: `${randomLabel(random, 22)}.edge-cache.test`,
        rcode: sequence % 5 === 0 ? "NOERROR" : "NXDOMAIN",
        latencyMs: round(event.latencyMs * 1.4),
        saturation: 0.58,
      };
    case "tunnel":
      return {
        ...event,
        qname: `${randomLabel(random, 52, "abcdef0123456789")}.telemetry-gateway.test`,
        qtype: "TXT",
        rcode: "NOERROR",
        latencyMs: round(event.latencyMs * 1.8),
        saturation: 0.7,
      };
    case "beacon":
      return {
        ...event,
        timestamp: new Date(startTimeMs + sequence * 15_000).toISOString(),
        clientIp: `${fictionalSites[event.siteId].clientPrefix.join(".")}.23`,
        qname: "heartbeat.edge-service.test",
        qtype: "A",
        rcode: "NOERROR",
        saturation: 0.42,
      };
    case "ambiguous-beacon": {
      const cycle = sequence % 4;
      const cycleStart = Math.floor(sequence / 4) * 60_000;
      return {
        ...event,
        timestamp: new Date(
          startTimeMs + cycleStart + ambiguousBeaconOffsets[cycle],
        ).toISOString(),
        clientIp: `${fictionalSites[event.siteId].clientPrefix.join(".")}.23`,
        qname:
          cycle === 3
            ? "status.edge-service.test"
            : "heartbeat-probe.edge-service.test",
        qtype: "A",
        rcode: "NOERROR",
        saturation: 0.4,
      };
    }
    case "typosquat":
      return {
        ...event,
        qname: typoDomains[sequence % typoDomains.length] as string,
        qtype: "A",
        rcode: "NOERROR",
        saturation: 0.3,
      };
    case "degrade-qoe":
      return {
        ...event,
        qname: "resolver-probe.site-health.test",
        rcode: sequence % 4 === 0 ? "NXDOMAIN" : "NOERROR",
        latencyMs: round(
          fictionalSites[event.siteId].baseLatencyMs * 5.5 + (sequence % 7),
        ),
        saturation: 0.82,
      };
    case "saturation":
      return {
        ...event,
        timestamp: new Date(startTimeMs + sequence * 50).toISOString(),
        qname: `load-${sequence % 20}.service-mesh.test`,
        rcode: sequence % 12 === 0 ? "SERVFAIL" : "NOERROR",
        latencyMs: round(event.latencyMs * 2.2),
        saturation: 0.98,
      };
  }
}

export function generateScenario(
  options: GenerateScenarioOptions,
): DnsEvent[] {
  const count = options.count ?? 30;
  const seed = options.seed ?? defaultGeneratorSeed;
  const startTime = options.startTime ?? defaultStartTime;
  const startTimeMs = Date.parse(startTime);

  if (!Number.isInteger(count) || count < 1 || count > 100_000) {
    throw new Error("Event count must be an integer between 1 and 100000.");
  }
  if (!Number.isInteger(seed) || seed < 0) {
    throw new Error("Seed must be a non-negative integer.");
  }
  if (!Number.isFinite(startTimeMs)) {
    throw new Error(`Invalid start time: ${startTime}`);
  }

  const random = createDeterministicRandom(seed);
  const events: DnsEvent[] = [];

  for (let sequence = 0; sequence < count; sequence += 1) {
    const profile = selectSite(options.scenario, sequence, options.siteId);
    const timestampMs = startTimeMs + sequence * 1_000;
    let event = createNormalEvent(
      profile,
      sequence,
      seed,
      timestampMs,
      random,
    );

    if (options.scenario !== "normal" && options.scenario !== "background") {
      const behavior =
        options.scenario === "combined"
          ? ([
              "dga",
              "tunnel",
              "beacon",
              "typosquat",
              "degrade-qoe",
              "saturation",
            ][sequence % 6] as Exclude<
              ScenarioTag,
              "normal" | "background" | "combined"
            >)
          : options.scenario;
      event = applyBehavior(event, behavior, sequence, startTimeMs, random);
    }

    events.push(
      dnsEventSchema.parse({
        ...event,
        scenarioTag: options.scenario,
        source: "sentinel-synthetic",
        synthetic: true,
        provenance: {
          scenario: options.scenario,
        },
      }),
    );
  }

  return events;
}
