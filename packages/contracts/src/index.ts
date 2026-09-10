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
  "ambiguous-beacon",
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
    incidentId: z.string().min(1).max(64).nullable(),
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

export const qoeWeights = {
  availability: 0.45,
  latency: 0.35,
  capacity: 0.2,
} as const;

export const siteQoeSchema = z
  .object({
    score: z.number().min(0).max(1),
    availability: z.number().min(0).max(1),
    latencyFactor: z.number().min(0).max(1),
    capacity: z.number().min(0).max(1),
    weights: z
      .object({
        availability: z.literal(0.45),
        latency: z.literal(0.35),
        capacity: z.literal(0.2),
      })
      .strict(),
    explanation: z.string().min(1),
  })
  .strict();

export type SiteQoe = z.infer<typeof siteQoeSchema>;

export const wazuhClassifications = [
  "possible_c2_beaconing",
  "possible_dns_tunneling",
  "possible_dga",
  "possible_typosquatting",
  "baseline_deviation",
] as const;

export const wazuhClassificationSchema = z.enum(wazuhClassifications);

export const signalTypeClassifications = {
  beaconing: "possible_c2_beaconing",
  tunneling: "possible_dns_tunneling",
  dga: "possible_dga",
  typosquatting: "possible_typosquatting",
  baseline_deviation: "baseline_deviation",
} as const satisfies Record<
  (typeof signalTypes)[number],
  (typeof wazuhClassifications)[number]
>;

export const wazuhIncidentEventSchema = z
  .object({
    source: z.literal("sentinel-adaptive"),
    event_type: z.literal("dns_security_incident"),
    incident_id: z.string().min(1).max(64),
    site_id: siteIdSchema,
    classification: wazuhClassificationSchema,
    severity: severityHintSchema,
    confidence: z.number().min(0).max(1),
    signal_count: z.number().int().positive(),
    summary: z.string().min(1).max(500),
    signal_id: z.string().uuid(),
  })
  .strict();

export type WazuhClassification = z.infer<typeof wazuhClassificationSchema>;
export type WazuhIncidentEvent = z.infer<typeof wazuhIncidentEventSchema>;

export const qvacAmbiguousMin = 0.6;
export const qvacAmbiguousMax = 0.75;

export const qvacAssessments = [
  "consistent",
  "uncertain",
  "insufficient_evidence",
] as const;

export const qvacResultStatuses = [
  "skipped",
  "ok",
  "invalid",
  "unavailable",
] as const;

export const qvacConfidenceTokens = ["high", "medium", "low"] as const;

export const qvacAssessmentSchema = z
  .object({
    assessment: z.enum(qvacAssessments),
    rationale: z.string().min(1).max(500),
    usedEvidence: z.array(z.string().min(1)).min(1),
    confidence: z.enum(qvacConfidenceTokens).optional(),
  })
  .strict();

export const qvacResultSchema = z
  .object({
    signalId: z.string().uuid(),
    status: z.enum(qvacResultStatuses),
    assessment: qvacAssessmentSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "ok" && value.assessment === undefined) {
      context.addIssue({
        code: "custom",
        message: "ok QVAC results require a validated assessment",
      });
    }
    if (value.status !== "ok" && value.assessment !== undefined) {
      context.addIssue({
        code: "custom",
        message: "only ok QVAC results may include an assessment",
      });
    }
  });

export type QvacAssessment = z.infer<typeof qvacAssessmentSchema>;
export type QvacResult = z.infer<typeof qvacResultSchema>;
export type QvacResultStatus = z.infer<typeof qvacResultSchema>["status"];

export const incidentSchema = z
  .object({
    incidentId: z
      .string()
      .regex(/^INC-[A-F0-9]{16}$/),
    timestamp: z.iso.datetime({ offset: true }),
    windowStart: z.iso.datetime({ offset: true }),
    siteId: siteIdSchema,
    classification: wazuhClassificationSchema,
    severity: severityHintSchema,
    confidence: z.number().min(0).max(1),
    signalCount: z.number().int().positive(),
    signalIds: z.array(z.string().uuid()).min(1),
    types: z.array(signalTypeSchema).min(1),
    affectedEntities: z.array(z.string().min(1)),
    summary: z.string().min(1).max(500),
    qvac: z.array(qvacResultSchema).optional(),
  })
  .strict();

export type Incident = z.infer<typeof incidentSchema>;

export const serviceHealthStates = ["ok", "down", "unknown"] as const;

export const wazuhIndexStates = ["yes", "no", "unknown"] as const;

export const systemStatusSchema = z
  .object({
    tracks: z.tuple([z.literal("03"), z.literal("04")]),
    qvac: z
      .object({
        sdk: z.literal("0.19.0"),
        inference: z.literal("0.19.0"),
        model: z.literal("LLAMA_3_2_1B_INST_Q4_0"),
        localOnly: z.boolean(),
      })
      .strict(),
    cloudInference: z.literal(false),
    services: z
      .object({
        kafka: z.enum(serviceHealthStates),
        clickhouse: z.enum(serviceHealthStates),
        grafana: z.enum(serviceHealthStates),
        wazuh: z.enum(serviceHealthStates),
      })
      .strict(),
  })
  .strict();

export const siteOverviewRowSchema = z
  .object({
    siteId: siteIdSchema,
    latestQoe: z.number().min(0).max(1).nullable(),
    latestWindowStart: z.iso.datetime({ offset: true }).nullable(),
    incidentCount: z.number().int().nonnegative(),
  })
  .strict();

export const overviewResponseSchema = z
  .object({
    generatedAt: z.iso.datetime({ offset: true }),
    sites: z.array(siteOverviewRowSchema),
    recentIncidents: z.array(incidentSchema),
  })
  .strict();

export const wazuhStatusSchema = z
  .object({
    emitted: z.boolean(),
    indexed: z.enum(wazuhIndexStates),
  })
  .strict();

export const incidentDetailSchema = z
  .object({
    incident: incidentSchema,
    signals: z.array(signalSchema),
    qvac: z.array(qvacResultSchema),
    wazuh: wazuhStatusSchema,
    currentWindow: siteWindowMetricsSchema.optional(),
    priorNxdomainRatioMean: z.number().min(0).max(1).optional(),
    priorLatencyP95Mean: z.number().nonnegative().optional(),
  })
  .strict();

export const siteDetailSchema = z
  .object({
    siteId: siteIdSchema,
    windows: z.array(siteWindowMetricsSchema),
    qoe: siteQoeSchema.optional(),
    priorWindows: z
      .object({
        nxdomainRatioMean: z.number().min(0).max(1),
        latencyP95Mean: z.number().nonnegative(),
        samples: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    incidents: z.array(incidentSchema),
  })
  .strict();

export type SystemStatus = z.infer<typeof systemStatusSchema>;
export type OverviewResponse = z.infer<typeof overviewResponseSchema>;
export type IncidentDetail = z.infer<typeof incidentDetailSchema>;
export type SiteDetail = z.infer<typeof siteDetailSchema>;
export type WazuhStatus = z.infer<typeof wazuhStatusSchema>;
