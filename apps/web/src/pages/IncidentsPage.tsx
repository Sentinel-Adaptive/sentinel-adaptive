import { useOutletContext } from "react-router-dom";
import type { Incident } from "@sentinel-adaptive/contracts";

import type { ShellContext } from "../AppShell.js";
import { compareIncidentSeverity } from "../format.js";
import { useI18n } from "../i18n.js";
import {
  EmptyState,
  ErrorBanner,
  IncidentList,
  LoadingState,
  PageHeader,
  Panel,
} from "../ui.js";
import { useJson } from "../use-json.js";

export function IncidentsPage() {
  const { t } = useI18n();
  const { tick } = useOutletContext<ShellContext>();
  const { data, error, loading } = useJson<Incident[]>("/api/incidents", tick);
  const incidents = [...(data ?? [])].sort(compareIncidentSeverity);

  return (
    <div>
      <PageHeader title={t("incidents.title")} description={t("incidents.description")} />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? <LoadingState label={t("common.loading")} /> : null}
      {data && incidents.length === 0 ? <EmptyState>{t("incidents.empty")}</EmptyState> : null}
      {incidents.length > 0 ? (
        <Panel
          title={
            incidents.length === 1
              ? t("incidents.countOne")
              : t("incidents.countMany", { n: incidents.length })
          }
        >
          <IncidentList incidents={incidents} showSummary />
        </Panel>
      ) : null}
    </div>
  );
}
