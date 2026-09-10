import {
  incidentDetailSchema,
  overviewResponseSchema,
  siteDetailSchema,
  siteIdSchema,
  systemStatusSchema,
  type Incident,
  type IncidentDetail,
  type OverviewResponse,
  type SiteDetail,
  type SiteId,
  type SystemStatus,
} from "@sentinel-adaptive/contracts";
import { calculateQoe, computeBaseline } from "@sentinel-adaptive/detection";

import {
  clickHouseQuery,
  fromClickHouseDateTime,
  type ClickHouseSettings,
} from "./clickhouse.js";
import {
  OperatorStore,
  allSiteIds,
  parseIncidentRow,
  parseQvacRow,
  parseSignalRow,
  parseWindowRow,
} from "./store.js";
import { qvacLocalOnly } from "./qvac.js";
import { wazuhEmittedState, wazuhIndexState } from "./wazuh.js";

export function parseJsonLines(text: string): Record<string, unknown>[] {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function queryRows(
  sql: string,
  overrides: ClickHouseSettings = {},
): Promise<Record<string, unknown>[]> {
  try {
    return parseJsonLines(await clickHouseQuery(sql, undefined, overrides));
  } catch {
    return [];
  }
}

export async function readIncidents(
  overrides: ClickHouseSettings = {},
): Promise<Incident[]> {
  const rows = await queryRows(
    "SELECT * FROM incidents FINAL ORDER BY timestamp DESC LIMIT 100 FORMAT JSONEachRow",
    overrides,
  );
  return rows.flatMap((row) => {
    try {
      return [parseIncidentRow(row)];
    } catch {
      return [];
    }
  });
}

export async function buildOverview(
  store: OperatorStore,
  overrides: ClickHouseSettings = {},
): Promise<OverviewResponse> {
  const stored = store.listIncidents();
  const incidents = stored.length > 0 ? stored : await readIncidents(overrides);
  const windows = await queryRows(
    `SELECT
         site_id,
         max(bucket_start) AS latest_bucket,
         argMax(qoe_score, bucket_start) AS qoe_score
       FROM site_metrics
       GROUP BY site_id
       FORMAT JSONEachRow`,
    overrides,
  );
  const qoeBySite = new Map(
    windows.map((row) => [
      String(row.site_id),
      {
        latestQoe: Number(row.qoe_score),
        latestWindowStart: fromClickHouseDateTime(String(row.latest_bucket)),
      },
    ]),
  );
  const counts = new Map<string, number>();
  for (const incident of incidents) {
    counts.set(incident.siteId, (counts.get(incident.siteId) ?? 0) + 1);
  }

  return overviewResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    sites: allSiteIds().map((siteId) => ({
      siteId,
      latestQoe: qoeBySite.get(siteId)?.latestQoe ?? null,
      latestWindowStart: qoeBySite.get(siteId)?.latestWindowStart ?? null,
      incidentCount: counts.get(siteId) ?? 0,
    })),
    recentIncidents: incidents.slice(0, 20),
  });
}

export async function buildIncidentDetail(
  store: OperatorStore,
  incidentId: string,
  overrides: ClickHouseSettings = {},
): Promise<IncidentDetail | undefined> {
  const incident =
    store.getIncident(incidentId) ??
    (await readIncidents(overrides)).find((item) => item.incidentId === incidentId);
  if (!incident) {
    return undefined;
  }

  let signals = store.signalsFor(incidentId);
  if (signals.length === 0) {
    const rows = await queryRows(
      `SELECT * FROM signals FINAL WHERE incident_id = '${escapeLiteral(incidentId)}' FORMAT JSONEachRow`,
      overrides,
    );
    signals = rows.flatMap((row) => {
      try {
        return [parseSignalRow(row)];
      } catch {
        return [];
      }
    });
  }

  let qvac = store.qvacFor(incident.signalIds);
  if (qvac.length === 0 && incident.signalIds.length > 0) {
    const ids = incident.signalIds.map((id) => `'${escapeLiteral(id)}'`).join(",");
    const rows = await queryRows(
      `SELECT * FROM qvac_results FINAL WHERE signal_id IN (${ids}) FORMAT JSONEachRow`,
      overrides,
    );
    qvac = rows.flatMap((row) => {
      try {
        return [parseQvacRow(row)];
      } catch {
        return [];
      }
    });
  }

  const windowRows = await queryRows(
    `SELECT * FROM site_metrics WHERE site_id = '${escapeLiteral(incident.siteId)}' ORDER BY bucket_start DESC LIMIT 46 FORMAT JSONEachRow`,
    overrides,
  );
  const windows = windowRows.flatMap((row) => {
    try {
      return [parseWindowRow(row)];
    } catch {
      return [];
    }
  });
  const currentWindow = windows[0];
  const prior = windows.slice(1);
  const baseline = prior.length > 0 ? computeBaseline(prior) : undefined;

  const indexed = wazuhIndexState(incidentId);

  return incidentDetailSchema.parse({
    incident,
    signals,
    qvac,
    wazuh: {
      emitted: wazuhEmittedState(incidentId, store.wazuhEmittedFor(incidentId)),
      indexed,
    },
    ...(currentWindow ? { currentWindow } : {}),
    ...(baseline
      ? {
          priorNxdomainRatioMean: baseline.nxdomainRatio.mean,
          priorLatencyP95Mean: baseline.latencyP95.mean,
        }
      : {}),
  });
}

export async function buildSiteDetail(
  store: OperatorStore,
  siteId: SiteId,
  overrides: ClickHouseSettings = {},
): Promise<SiteDetail> {
  const rows = await queryRows(
    `SELECT
         bucket_start, site_id, query_count, nxdomain_count, nxdomain_ratio,
         latency_median, latency_p95, unique_domains, mean_entropy,
         periodicity_score, saturation
       FROM site_metrics
       WHERE site_id = '${escapeLiteral(siteId)}'
       ORDER BY bucket_start DESC
       LIMIT 45
       FORMAT JSONEachRow`,
    overrides,
  );
  const windows = rows
    .flatMap((row) => {
      try {
        return [parseWindowRow(row)];
      } catch {
        return [];
      }
    })
    .reverse();
  const current = windows.at(-1);
  const prior = windows.slice(0, -1);
  const baseline = prior.length > 0 ? computeBaseline(prior) : undefined;
  const qoe = current ? calculateQoe(current, baseline) : undefined;
  const stored = store.incidentsForSite(siteId);
  const incidents =
    stored.length > 0
      ? stored
      : (await readIncidents(overrides)).filter((item) => item.siteId === siteId);

  return siteDetailSchema.parse({
    siteId,
    windows,
    ...(qoe ? { qoe } : {}),
    ...(baseline
      ? {
          priorWindows: {
            nxdomainRatioMean: baseline.nxdomainRatio.mean,
            latencyP95Mean: baseline.latencyP95.mean,
            samples: baseline.nxdomainRatio.samples,
          },
        }
      : {}),
    incidents,
  });
}

export function parseSiteId(value: string): SiteId | undefined {
  const parsed = siteIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function buildSystemStatus(services: SystemStatus["services"]): SystemStatus {
  return systemStatusSchema.parse({
    tracks: ["03", "04"],
    qvac: {
      sdk: "0.19.0",
      inference: "0.19.0",
      model: "LLAMA_3_2_1B_INST_Q4_0",
      localOnly: qvacLocalOnly(),
    },
    cloudInference: false,
    services,
  });
}

function escapeLiteral(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}
