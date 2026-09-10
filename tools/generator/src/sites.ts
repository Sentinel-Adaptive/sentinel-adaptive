import {
  siteIds,
  type SiteId,
} from "@sentinel-adaptive/contracts";

export interface SiteProfile {
  readonly id: SiteId;
  readonly zone: string;
  readonly resolverId: string;
  readonly clientPrefix: readonly [number, number, number];
  readonly normalDomains: readonly string[];
  readonly baseLatencyMs: number;
  readonly latencyJitterMs: number;
  readonly nxdomainRate: number;
  readonly saturation: number;
}

export const fictionalSites: Record<SiteId, SiteProfile> = {
  "PTY-BANK-01": {
    id: "PTY-BANK-01",
    zone: "banking-east",
    resolverId: "pty-bank-dns-01",
    clientPrefix: [10, 10, 4],
    normalDomains: [
      "ledger.secure-bank.test",
      "portal.secure-bank.test",
      "updates.branch-services.test",
    ],
    baseLatencyMs: 18,
    latencyJitterMs: 4,
    nxdomainRate: 0.01,
    saturation: 0.18,
  },
  "PTY-HEALTH-01": {
    id: "PTY-HEALTH-01",
    zone: "clinical-west",
    resolverId: "pty-health-dns-01",
    clientPrefix: [10, 20, 8],
    normalDomains: [
      "records.health-network.test",
      "imaging.health-network.test",
      "pharmacy.health-network.test",
    ],
    baseLatencyMs: 34,
    latencyJitterMs: 7,
    nxdomainRate: 0.04,
    saturation: 0.34,
  },
  "COL-GOV-01": {
    id: "COL-GOV-01",
    zone: "government-central",
    resolverId: "col-gov-dns-01",
    clientPrefix: [10, 30, 12],
    normalDomains: [
      "registry.citizen-services.test",
      "mail.citizen-services.test",
      "archive.citizen-services.test",
    ],
    baseLatencyMs: 57,
    latencyJitterMs: 11,
    nxdomainRate: 0.08,
    saturation: 0.52,
  },
};

export const allFictionalSites = siteIds.map((siteId) => fictionalSites[siteId]);
