import { z } from "zod";

export const siteIds = [
  "PTY-BANK-01",
  "PTY-HEALTH-01",
  "COL-GOV-01",
] as const;

export const scenarioTags = [
  "normal",
  "background",
  "dga",
  "tunnel",
  "beacon",
  "typosquat",
  "degrade-qoe",
  "saturation",
  "combined",
] as const;

export const telemetrySources = [
  "ovnicom-challenge",
  "sentinel-synthetic",
] as const;

export const siteIdSchema = z.enum(siteIds);
export const scenarioTagSchema = z.enum(scenarioTags);
export const telemetrySourceSchema = z.enum(telemetrySources);

export const eventProvenanceSchema = z
  .object({
    originalFile: z.string().min(1).max(255).optional(),
    originalLine: z.number().int().positive().optional(),
    enrichedFields: z.array(z.string().min(1)).optional(),
    scenario: z.string().min(1).optional(),
  })
  .strict();

export const dnsEventSchema = z
  .object({
    timestamp: z.iso.datetime({ offset: true }),
    siteId: siteIdSchema,
    zone: z.string().min(1),
    clientIp: z.union([z.ipv4(), z.ipv6()]),
    qname: z
      .string()
      .min(1)
      .max(253)
      .regex(
        /^(?=.{1,253}$)(?:\*|_?[A-Za-z0-9](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9])?)(?:\.(?:\*|_?[A-Za-z0-9](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9])?))*\.?$/,
      ),
    qtype: z
      .string()
      .min(1)
      .max(32)
      .regex(/^[A-Z][A-Z0-9]*$/),
    rcode: z.enum(["NOERROR", "NXDOMAIN", "SERVFAIL", "REFUSED"]),
    latencyMs: z.number().finite().nonnegative(),
    resolverId: z.string().min(1),
    scenarioTag: scenarioTagSchema,
    source: telemetrySourceSchema,
    synthetic: z.boolean(),
    saturation: z.number().min(0).max(1),
    generator: z
      .object({
        seed: z.number().int().nonnegative(),
        sequence: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    provenance: eventProvenanceSchema.optional(),
  })
  .strict();

export type DnsEvent = z.infer<typeof dnsEventSchema>;
export type ScenarioTag = z.infer<typeof scenarioTagSchema>;
export type SiteId = z.infer<typeof siteIdSchema>;
export type TelemetrySource = z.infer<typeof telemetrySourceSchema>;
export type EventProvenance = z.infer<typeof eventProvenanceSchema>;

export const signalTypes = [
  "beaconing",
  "tunneling",
  "dga",
  "typosquatting",
  "baseline_deviation",
] as const;

export const severityHints = ["low", "medium", "high"] as const;

export const signalTypeSchema = z.enum(signalTypes);
export const severityHintSchema = z.enum(severityHints);

export const evidenceItemSchema = z
  .object({
    metric: z.string().min(1),
    value: z.union([z.number(), z.string(), z.boolean()]),
    reason: z.string().min(1),
  })
  .strict();

export const signalSchema = z
  .object({
    signalId: z.string().uuid(),
    timestamp: z.iso.datetime({ offset: true }),
    siteId: siteIdSchema,
    type: signalTypeSchema,
    score: z.number().min(0).max(1),
    severityHint: severityHintSchema,
    evidence: z.array(evidenceItemSchema).min(1),
    source: z.literal("deterministic"),
    incidentId: z.null(),
  })
  .strict();

export const siteWindowMetricsSchema = z
  .object({
    bucketStart: z.iso.datetime({ offset: true }),
    siteId: siteIdSchema,
    queryCount: z.number().int().nonnegative(),
    nxdomainCount: z.number().int().nonnegative(),
    nxdomainRatio: z.number().min(0).max(1),
    latencyMedian: z.number().nonnegative(),
    latencyP95: z.number().nonnegative(),
    uniqueDomains: z.number().int().nonnegative(),
    meanEntropy: z.number().nonnegative(),
    periodicityScore: z.number().min(0).max(1),
    saturation: z.number().min(0).max(1),
  })
  .strict();

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type SignalType = z.infer<typeof signalTypeSchema>;
export type SeverityHint = z.infer<typeof severityHintSchema>;
export type SiteWindowMetrics = z.infer<typeof siteWindowMetricsSchema>;
