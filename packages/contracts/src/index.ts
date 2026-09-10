import { z } from "zod";

export const siteIds = [
  "PTY-BANK-01",
  "PTY-HEALTH-01",
  "COL-GOV-01",
] as const;

export const scenarioTags = [
  "normal",
  "dga",
  "tunnel",
  "beacon",
  "typosquat",
  "degrade-qoe",
  "saturation",
  "combined",
] as const;

export const siteIdSchema = z.enum(siteIds);
export const scenarioTagSchema = z.enum(scenarioTags);

export const dnsEventSchema = z
  .object({
    timestamp: z.iso.datetime({ offset: true }),
    siteId: siteIdSchema,
    zone: z.string().min(1),
    clientIp: z.ipv4(),
    qname: z
      .string()
      .min(1)
      .max(253)
      .regex(
        /^(?=.{1,253}\.?$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i,
      ),
    qtype: z.enum(["A", "AAAA", "CNAME", "MX", "TXT"]),
    rcode: z.enum(["NOERROR", "NXDOMAIN", "SERVFAIL", "REFUSED"]),
    latencyMs: z.number().finite().nonnegative(),
    resolverId: z.string().min(1),
    scenarioTag: scenarioTagSchema,
    synthetic: z.literal(true),
    saturation: z.number().min(0).max(1),
    generator: z
      .object({
        seed: z.number().int().nonnegative(),
        sequence: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export type DnsEvent = z.infer<typeof dnsEventSchema>;
export type ScenarioTag = z.infer<typeof scenarioTagSchema>;
export type SiteId = z.infer<typeof siteIdSchema>;
