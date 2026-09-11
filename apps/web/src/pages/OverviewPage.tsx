import { Link, useOutletContext } from "react-router-dom";
import type { OverviewResponse, SystemStatus } from "@sentinel-adaptive/contracts";

import type { ShellContext } from "../AppShell.js";
import {
  compareIncidentSeverity,
  formatPercent,
  formatTime,
} from "../format.js";
import { translateKnown, useI18n } from "../i18n.js";
import {
  EmptyState,
  ErrorBanner,
  IncidentList,
  LoadingState,
  PageHeader,
  Panel,
  QoeBar,
  StatCard,
} from "../ui.js";
import { useJson } from "../use-json.js";

export function OverviewPage() {
  const { t } = useI18n();
  const { tick } = useOutletContext<ShellContext>();
  const { data, error, loading } = useJson<OverviewResponse>("/api/overview", tick);
  const system = useJson<SystemStatus>("/api/system", tick);

  const incidents = [...(data?.recentIncidents ?? [])].sort(compareIncidentSeverity);
  const highCount = incidents.filter((incident) => incident.severity === "high").length;
  const sitesWithQoe = data?.sites.filter((site) => site.latestQoe !== null).length ?? 0;
  const serviceStates = system.data ? Object.values(system.data.services) : [];
  const servicesOk = serviceStates.filter((state) => state === "ok").length;

  const posture = new Map<string, number>();
  for (const incident of incidents) {
    posture.set(incident.classification, (posture.get(incident.classification) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title={t("overview.title")}
        description={t("overview.description")}
        meta={data ? t("overview.updated", { time: formatTime(data.generatedAt) }) : null}
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? <LoadingState label={t("common.loading")} /> : null}
      {data ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t("overview.activeIncidents")}
              value={String(incidents.length)}
              hint={t("overview.activeHint")}
            />
            <StatCard
              label={t("overview.highSeverity")}
              value={String(highCount)}
              hint={t("overview.highHint")}
              tone={highCount > 0 ? "danger" : "neutral"}
            />
            <StatCard
              label={t("overview.sitesObserved")}
              value={String(sitesWithQoe)}
              hint={t("overview.sitesHint", {
                ready: sitesWithQoe,
                total: data.sites.length,
              })}
            />
            <StatCard
              label={t("overview.health")}
              value={
                system.data
                  ? `${servicesOk}/${serviceStates.length}`
                  : t("common.emDash")
              }
              hint={
                system.data
                  ? t("overview.healthHint", {
                      ok: servicesOk,
                      total: serviceStates.length,
                    })
                  : t("overview.sovereignty")
              }
              tone={
                system.data && servicesOk === serviceStates.length ? "success" : "neutral"
              }
            />
          </div>

          {system.data ? (
            <p className="text-sm text-muted">
              {t("overview.cloudOff", { value: String(system.data.cloudInference) })}
              {" · "}
              {system.data.qvac.model}
            </p>
          ) : null}

          <Panel title={t("overview.qoe")}>
            <div className="grid gap-3 md:grid-cols-3">
              {data.sites.map((site) => (
                <Link
                  key={site.siteId}
                  to={`/sites/${site.siteId}`}
                  aria-label={t("common.openSite", { id: site.siteId })}
                  className="rounded-2xl border border-line bg-surface-subtle/60 px-4 py-4 no-underline transition-colors hover:border-brand/30"
                >
                  <p className="text-sm font-medium text-ink">{site.siteId}</p>
                  {site.latestQoe === null ? (
                    <p className="mt-3 text-sm text-muted">{t("overview.noWindows")}</p>
                  ) : (
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
                      {formatPercent(site.latestQoe)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">{t("overview.latestQoe")}</p>
                  <div className="mt-3">
                    {site.latestQoe === null ? (
                      <div className="h-1.5 rounded-full bg-line" />
                    ) : (
                      <QoeBar value={site.latestQoe} />
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    {site.incidentCount === 1
                      ? t("overview.incidentCountOne")
                      : t("overview.incidentCount", { n: site.incidentCount })}
                    {site.latestWindowStart
                      ? ` · ${formatTime(site.latestWindowStart)}`
                      : ""}
                  </p>
                </Link>
              ))}
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
            <Panel title={t("overview.recent")}>
              {incidents.length === 0 ? (
                <EmptyState>{t("overview.recentEmpty")}</EmptyState>
              ) : (
                <IncidentList incidents={incidents} />
              )}
            </Panel>
            <Panel title={t("overview.posture")}>
              {posture.size === 0 ? (
                <p className="text-sm leading-6 text-muted">{t("overview.postureEmpty")}</p>
              ) : (
                <ul className="space-y-3">
                  {[...posture.entries()].map(([classification, count]) => (
                    <li key={classification} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-ink">
                        {translateKnown(t, "enum", classification)}
                      </span>
                      <span className="tabular-nums text-sm font-medium text-ink">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
