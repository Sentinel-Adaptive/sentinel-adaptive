import { Database, LineChart, Radio, Server, Shield } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import type { SystemStatus } from "@sentinel-adaptive/contracts";

import type { ShellContext } from "../AppShell.js";
import { translateKnown, useI18n } from "../i18n.js";
import { ErrorBanner, Fact, HealthBadge, LoadingState, PageHeader, Panel } from "../ui.js";
import { useJson } from "../use-json.js";

const serviceIcons = {
  kafka: Radio,
  clickhouse: Database,
  grafana: LineChart,
  wazuh: Shield,
} as const;

export function SystemPage() {
  const { t } = useI18n();
  const { tick } = useOutletContext<ShellContext>();
  const { data, error, loading } = useJson<SystemStatus>("/api/system", tick);

  return (
    <div>
      <PageHeader title={t("system.title")} description={t("system.description")} />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? <LoadingState label={t("common.loading")} /> : null}
      {data ? (
        <div className="space-y-5">
          <section className="rounded-3xl border border-line bg-surface px-5 py-6 shadow-card">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              {t("system.sovereignty")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {t("system.localInference")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("system.noCloud")}</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm lg:grid-cols-3">
              <Fact label={t("system.tracks")}>{data.tracks.join(" + ")}</Fact>
              <Fact label={t("system.cloudInference")}>
                <span className="font-mono">{String(data.cloudInference)}</span>
              </Fact>
              <Fact label={t("system.localOnlyFlag")}>
                <span className="font-mono">{String(data.qvac.localOnly)}</span>
              </Fact>
            </dl>
          </section>

          <Panel title={t("system.runtime")}>
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <Fact label={t("system.sdk")}>{data.qvac.sdk}</Fact>
              <Fact label={t("system.inference")}>{data.qvac.inference}</Fact>
              <Fact label={t("system.model")}>
                <span className="font-mono text-xs">{data.qvac.model}</span>
              </Fact>
            </dl>
          </Panel>

          <Panel title={t("system.services")}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {Object.entries(data.services).map(([name, state]) => {
                const Icon = serviceIcons[name as keyof typeof serviceIcons] ?? Server;
                return (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-canvas px-4 py-3"
                  >
                    <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
                      <Icon aria-hidden="true" className="size-4 text-muted" />
                      {translateKnown(t, "service", name)}
                    </span>
                    <HealthBadge state={state} />
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title={t("system.provenance")}>
            <p className="text-sm leading-6 text-muted">{t("system.provenanceBody")}</p>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

