import { Link, useOutletContext, useParams } from "react-router-dom";
import type { IncidentDetail, QvacResult, Signal, SystemStatus } from "@sentinel-adaptive/contracts";

import type { ShellContext } from "../AppShell.js";
import {
  formatEvidenceValue,
  formatLatencyMs,
  formatPercent,
  formatTime,
  qvacConfidenceToken,
  qvacExplanation,
} from "../format.js";
import { translateKnown, useI18n, type Translate } from "../i18n.js";
import {
  translateEvidenceReason,
  translateIncidentSummary,
} from "../operator-copy.js";
import {
  EmptyState,
  ErrorBanner,
  Fact,
  LoadingState,
  PageHeader,
  Panel,
  SeverityBadge,
} from "../ui.js";
import { useJson } from "../use-json.js";

export function IncidentDetailPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const { tick } = useOutletContext<ShellContext>();
  const { data, error, loading } = useJson<IncidentDetail>(
    id ? `/api/incidents/${encodeURIComponent(id)}` : undefined,
    tick,
  );
  const system = useJson<SystemStatus>("/api/system", tick);

  return (
    <div>
      <PageHeader
        title={data?.incident.incidentId ?? t("detail.fallbackTitle")}
        description={t("detail.description")}
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? <LoadingState label={t("common.loading")} /> : null}
      {data ? <IncidentBody detail={data} system={system.data} /> : null}
    </div>
  );
}

function IncidentBody({
  detail,
  system,
}: {
  detail: IncidentDetail;
  system: SystemStatus | null;
}) {
  const { t } = useI18n();
  const { incident, signals, qvac, wazuh } = detail;
  return (
    <div className="space-y-5">
      <Panel title={t("detail.summary")}>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={incident.severity} />
          <span className="text-sm font-medium text-ink">
            {translateKnown(t, "enum", incident.classification)}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">
          {translateIncidentSummary(t, incident.summary)}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm lg:grid-cols-3">
          <Fact label={t("common.site")}>
            <Link
              className="text-ink underline-offset-2 hover:underline"
              to={`/sites/${incident.siteId}`}
            >
              {incident.siteId}
            </Link>
          </Fact>
          <Fact label={t("common.confidence")}>{formatPercent(incident.confidence)}</Fact>
          <Fact label={t("common.signals")}>{incident.signalCount}</Fact>
          <Fact label={t("common.window")}>{formatTime(incident.windowStart)}</Fact>
          <Fact label={t("detail.lastSignal")}>{formatTime(incident.timestamp)}</Fact>
          <Fact label={t("detail.types")}>
            {incident.types.map((type) => translateKnown(t, "enum", type)).join(", ")}
          </Fact>
          <Fact label={t("detail.entities")}>
            {incident.affectedEntities.length > 0
              ? incident.affectedEntities.join(", ")
              : t("detail.noEntities")}
          </Fact>
        </dl>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t("detail.wazuh")}>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Fact label={t("detail.wazuhLog")}>
              {wazuh.emitted ? t("detail.written") : t("detail.notWritten")}
            </Fact>
            <Fact label={t("detail.wazuhIndexer")}>{formatWazuhIndexed(t, wazuh.indexed)}</Fact>
          </dl>
          <p className="mt-4 text-sm leading-6 text-muted">{t("detail.wazuhHelp")}</p>
        </Panel>
        <Panel title={t("system.sovereignty")}>
          {system ? (
            <dl className="grid grid-cols-1 gap-4 text-sm">
              <Fact label={t("system.cloudInference")}>{String(system.cloudInference)}</Fact>
              <Fact label={t("system.model")}>
                <span className="font-mono text-xs">{system.qvac.model}</span>
              </Fact>
              <Fact label={t("system.sdk")}>{system.qvac.sdk}</Fact>
            </dl>
          ) : (
            <p className="text-sm text-muted">{t("common.loading")}</p>
          )}
        </Panel>
      </div>

      <Panel title={t("detail.qvac")}>
        {qvac.length === 0 ? (
          <p className="text-sm leading-6 text-muted">{t("detail.qvacEmpty")}</p>
        ) : (
          <div className="space-y-4">
            {system ? (
              <p className="text-sm text-muted">
                {t("detail.qvacRuntime", {
                  sdk: system.qvac.sdk,
                  model: system.qvac.model,
                  cloud: String(system.cloudInference),
                })}
              </p>
            ) : null}
            {qvac.map((result) => (
              <QvacCard
                key={result.signalId}
                result={result}
                signal={signals.find((item) => item.signalId === result.signalId)}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t("detail.evidence")}>
        {signals.length === 0 ? (
          <EmptyState>{t("detail.noEvidence")}</EmptyState>
        ) : (
          <div className="space-y-4">
            {signals.map((signal) => (
              <article
                key={signal.signalId}
                className="rounded-2xl border border-line bg-surface-subtle/50 px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-ink">
                    {translateKnown(t, "enum", signal.type)}
                  </h3>
                  <SeverityBadge severity={signal.severityHint} />
                  <span className="text-xs tabular-nums text-muted">
                    {t("common.score")} {formatPercent(signal.score)}
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {signal.evidence.map((item, index) => (
                    <li
                      key={`${signal.signalId}-${item.metric}-${index}`}
                      className="grid gap-1 border-t border-line/80 pt-2 text-sm sm:grid-cols-[12rem_8rem_minmax(0,1fr)] sm:gap-3"
                    >
                      <span className="font-medium text-ink">
                        {translateKnown(t, "metric", item.metric)}
                      </span>
                      <span className="tabular-nums text-ink">
                        {typeof item.value === "boolean"
                          ? item.value
                            ? t("common.yes")
                            : t("common.no")
                          : formatEvidenceValue(item.metric, item.value)}
                      </span>
                      <span className="text-muted">
                        {translateEvidenceReason(t, item.reason)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t("detail.siteWindow")}>
        {detail.currentWindow ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-medium text-ink">{t("detail.current")}</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <Fact label={t("detail.bucket")}>
                  {formatTime(detail.currentWindow.bucketStart)}
                </Fact>
                <Fact label={t("detail.queries")}>{detail.currentWindow.queryCount}</Fact>
                <Fact label={t("detail.nxdomain")}>
                  {formatPercent(detail.currentWindow.nxdomainRatio)}
                </Fact>
                <Fact label={t("detail.latencyP95")}>
                  {formatLatencyMs(detail.currentWindow.latencyP95)}
                </Fact>
                <Fact label={t("detail.saturation")}>
                  {formatPercent(detail.currentWindow.saturation)}
                </Fact>
              </dl>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium text-ink">{t("detail.baseline")}</h3>
              <dl className="grid grid-cols-1 gap-4 text-sm">
                <Fact label={t("detail.priorNx")}>
                  {detail.priorNxdomainRatioMean === undefined
                    ? t("detail.noPrior")
                    : formatPercent(detail.priorNxdomainRatioMean)}
                </Fact>
                <Fact label={t("detail.priorLat")}>
                  {detail.priorLatencyP95Mean === undefined
                    ? t("detail.noPrior")
                    : formatLatencyMs(detail.priorLatencyP95Mean)}
                </Fact>
              </dl>
            </div>
          </div>
        ) : (
          <EmptyState>{t("detail.noWindow")}</EmptyState>
        )}
      </Panel>
    </div>
  );
}

function QvacCard({
  result,
  signal,
}: {
  result: QvacResult;
  signal: Signal | undefined;
}) {
  const { t } = useI18n();
  const explanation = qvacExplanation(result.assessment?.rationale);
  const modelToken = qvacConfidenceToken(
    result.assessment?.rationale,
    result.assessment?.confidence,
  );
  return (
    <article className="rounded-2xl border border-line bg-canvas px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">
          {translateKnown(t, "enum", result.status)}
        </span>
        <span className="font-mono text-[11px] text-muted">{result.signalId}</span>
      </div>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Fact label={t("detail.classification")}>
          {result.assessment
            ? translateKnown(t, "enum", result.assessment.assessment)
            : qvacSkipReason(t, result.status)}
        </Fact>
        <Fact label={t("common.confidence")}>
          {formatQvacConfidence(t, signal?.score, modelToken, result.status)}
        </Fact>
        <Fact label={t("detail.uncertainty")}>
          {qvacUncertainty(t, result.assessment?.assessment, result.status)}
        </Fact>
      </dl>
      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          {t("detail.explanation")}
        </p>
        <p className="mt-1.5 text-sm leading-6 text-ink">
          {explanation ??
            (result.status === "skipped" ? t("detail.skippedExplanation") : t("detail.noRationale"))}
        </p>
      </div>
      {result.assessment?.usedEvidence.length ? (
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            {t("detail.supportingEvidence")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {result.assessment.usedEvidence.map((metric) => (
              <li
                key={metric}
                className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs text-ink"
              >
                {translateKnown(t, "metric", metric)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function formatWazuhIndexed(t: Translate, state: "yes" | "no" | "unknown"): string {
  if (state === "yes") {
    return t("detail.found");
  }
  if (state === "no") {
    return t("detail.notFound");
  }
  return t("detail.lookupFailed");
}

function formatQvacConfidence(
  t: Translate,
  score: number | undefined,
  modelToken: string | undefined,
  status: string,
): string {
  if (status === "skipped") {
    return score === undefined ? t("common.emDash") : t("detail.deterministic", { pct: formatPercent(score) });
  }
  const parts: string[] = [];
  if (score !== undefined) {
    parts.push(formatPercent(score));
  }
  if (modelToken) {
    parts.push(t("detail.modelToken", { token: translateKnown(t, "enum", modelToken) }));
  }
  return parts.length > 0 ? parts.join(" · ") : t("common.emDash");
}

function qvacSkipReason(t: Translate, status: string): string {
  if (status === "skipped") {
    return t("detail.notInvoked");
  }
  return t("common.emDash");
}

function qvacUncertainty(t: Translate, assessment: string | undefined, status: string): string {
  if (status === "skipped") {
    return t("detail.uncertaintyNone");
  }
  if (assessment === "uncertain" || assessment === "insufficient_evidence") {
    return translateKnown(t, "enum", assessment);
  }
  if (assessment === "consistent") {
    return t("detail.uncertaintyLow");
  }
  if (status === "invalid" || status === "unavailable") {
    return translateKnown(t, "enum", status);
  }
  return t("common.emDash");
}
