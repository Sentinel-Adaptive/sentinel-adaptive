import { useOutletContext, useParams } from "react-router-dom";
import type { SiteDetail } from "@sentinel-adaptive/contracts";

import type { ShellContext } from "../AppShell.js";
import {
  compareIncidentSeverity,
  formatLatencyMs,
  formatPercent,
  formatTime,
} from "../format.js";
import { useI18n } from "../i18n.js";
import {
  EmptyState,
  ErrorBanner,
  Fact,
  IncidentList,
  LoadingState,
  PageHeader,
  Panel,
  QoeBar,
} from "../ui.js";
import { useJson } from "../use-json.js";

export function SiteDetailPage() {
  const { t } = useI18n();
  const { siteId } = useParams();
  const { tick } = useOutletContext<ShellContext>();
  const { data, error, loading } = useJson<SiteDetail>(
    siteId ? `/api/sites/${encodeURIComponent(siteId)}` : undefined,
    tick,
  );
  const incidents = [...(data?.incidents ?? [])].sort(compareIncidentSeverity);

  return (
    <div>
      <PageHeader
        title={data?.siteId ?? siteId ?? t("common.site")}
        description={t("site.description")}
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? <LoadingState label={t("common.loading")} /> : null}
      {data ? (
        <div className="space-y-5">
          <Panel title={t("site.qoe")}>
            {data.qoe ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                      {t("common.score")}
                    </p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                      {formatPercent(data.qoe.score)}
                    </p>
                  </div>
                  <div className="min-w-[12rem] flex-1">
                    <QoeBar value={data.qoe.score} />
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm lg:grid-cols-3">
                  <Fact label={t("site.availability")}>
                    {formatPercent(data.qoe.availability)}
                  </Fact>
                  <Fact label={t("site.latencyFactor")}>
                    {data.qoe.latencyFactor.toFixed(2)}
                  </Fact>
                  <Fact label={t("site.capacity")}>{formatPercent(data.qoe.capacity)}</Fact>
                  <Fact label={t("site.weights")}>
                    {data.qoe.weights.availability} / {data.qoe.weights.latency} /{" "}
                    {data.qoe.weights.capacity}
                  </Fact>
                  {data.priorWindows ? (
                    <Fact label={t("site.priorSamples")}>{data.priorWindows.samples}</Fact>
                  ) : (
                    <Fact label={t("site.indicators")}>{t("site.noBaseline")}</Fact>
                  )}
                </dl>
                <p className="mt-4 text-sm leading-6 text-muted">{data.qoe.explanation}</p>
              </>
            ) : (
              <EmptyState>{t("site.noQoe")}</EmptyState>
            )}
          </Panel>

          <Panel title={t("site.windows")}>
            {data.windows.length === 0 ? (
              <EmptyState>{t("site.noWindows")}</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="pb-2 font-medium">{t("detail.bucket")}</th>
                      <th className="pb-2 font-medium">{t("detail.queries")}</th>
                      <th className="pb-2 font-medium">{t("detail.nxdomain")}</th>
                      <th className="pb-2 font-medium">{t("detail.latencyP95")}</th>
                      <th className="pb-2 font-medium">{t("detail.saturation")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.windows].reverse().map((window) => (
                      <tr key={window.bucketStart} className="border-t border-line">
                        <td className="py-2.5 text-muted">{formatTime(window.bucketStart)}</td>
                        <td className="py-2.5 tabular-nums">{window.queryCount}</td>
                        <td className="py-2.5 tabular-nums">
                          {formatPercent(window.nxdomainRatio)}
                        </td>
                        <td className="py-2.5 tabular-nums">
                          {formatLatencyMs(window.latencyP95)}
                        </td>
                        <td className="py-2.5 tabular-nums">
                          {formatPercent(window.saturation)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title={t("common.incidents")}>
            {incidents.length === 0 ? (
              <EmptyState>{t("site.noIncidents")}</EmptyState>
            ) : (
              <IncidentList incidents={incidents} showSite={false} />
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
