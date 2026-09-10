import type { DnsEvent } from "@sentinel-adaptive/contracts";

export interface DnsOutcomeStats {
  queryCount: number;
  nxdomainCount: number;
  nxdomainRatio: number;
  servfailCount: number;
  txtCount: number;
  uniqueDomains: number;
  meanSaturation: number;
}

export function summarizeDnsOutcomes(
  events: readonly DnsEvent[],
): DnsOutcomeStats {
  const nxdomainCount = events.filter((event) => event.rcode === "NXDOMAIN").length;
  const servfailCount = events.filter((event) => event.rcode === "SERVFAIL").length;
  const txtCount = events.filter((event) => event.qtype === "TXT").length;
  const uniqueDomains = new Set(events.map((event) => event.qname)).size;
  const meanSaturation =
    events.length === 0
      ? 0
      : events.reduce((total, event) => total + event.saturation, 0) /
        events.length;

  return {
    queryCount: events.length,
    nxdomainCount,
    nxdomainRatio: events.length === 0 ? 0 : nxdomainCount / events.length,
    servfailCount,
    txtCount,
    uniqueDomains,
    meanSaturation,
  };
}
