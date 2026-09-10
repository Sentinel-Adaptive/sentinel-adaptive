import { createHash } from "node:crypto";

import {
  dnsEventSchema,
  siteIds,
  type DnsEvent,
  type SiteId,
} from "@sentinel-adaptive/contracts";
import { fictionalSites } from "@sentinel-adaptive/generator";

import type { ParsedBindQuery } from "./parse.js";

export const enrichedFieldNames = [
  "siteId",
  "zone",
  "latencyMs",
  "saturation",
  "rcode",
  "scenarioTag",
] as const;

export function siteIdForClientIp(clientIp: string): SiteId {
  const digest = createHash("sha256")
    .update(`sentinel-site:${clientIp}`)
    .digest();
  const index = digest.readUInt32BE(0) % siteIds.length;
  return siteIds[index] ?? siteIds[0];
}

function syntheticLatencyMs(
  clientIp: string,
  qname: string,
  siteId: SiteId,
): number {
  const profile = fictionalSites[siteId];
  const digest = createHash("sha256")
    .update(`sentinel-latency:${clientIp}:${qname}`)
    .digest();
  const unit = (digest[0] ?? 0) / 255;
  const offset = (unit * 2 - 1) * profile.latencyJitterMs;
  return Math.round(Math.max(1, profile.baseLatencyMs + offset) * 100) / 100;
}

export function toReplayEvent(
  parsed: ParsedBindQuery,
  originalFile: string,
  originalLine: number,
): DnsEvent | undefined {
  const siteId = siteIdForClientIp(parsed.clientIp);
  const profile = fictionalSites[siteId];
  const enrichedFields: string[] = [...enrichedFieldNames];
  const resolverId = parsed.resolverId ?? "unspecified";
  if (!parsed.resolverId) {
    enrichedFields.push("resolverId");
  }

  const parsedEvent = dnsEventSchema.safeParse({
    timestamp: parsed.timestamp,
    siteId,
    zone: profile.zone,
    clientIp: parsed.clientIp,
    qname: parsed.qname,
    qtype: parsed.qtype,
    rcode: "NOERROR",
    latencyMs: syntheticLatencyMs(parsed.clientIp, parsed.qname, siteId),
    resolverId,
    scenarioTag: "background",
    source: "ovnicom-challenge",
    synthetic: false,
    saturation: profile.saturation,
    provenance: {
      originalFile,
      originalLine,
      enrichedFields,
    },
  });

  return parsedEvent.success ? parsedEvent.data : undefined;
}
