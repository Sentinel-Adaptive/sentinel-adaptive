import type { ReactNode } from "react";
import type { Incident } from "@sentinel-adaptive/contracts";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { formatPercent, formatTime } from "./format.js";
import { translateKnown, useI18n } from "./i18n.js";
import { translateIncidentSummary } from "./operator-copy.js";

export function PageHeader({
  title,
  description,
  meta,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.65rem] font-bold tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {meta ? <div className="text-xs text-muted">{meta}</div> : null}
    </header>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-surface px-5 py-8 text-sm leading-6 text-muted">
      {children}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p className="mb-5 rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-3xl border border-line bg-surface-subtle"
          />
        ))}
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-line bg-surface p-5 shadow-card ${className}`}
    >
      {title ? (
        <div className="mb-4">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "danger" | "success" | "brand";
}) {
  const valueClass =
    tone === "danger"
      ? "text-danger"
      : tone === "success"
        ? "text-success"
        : tone === "brand"
          ? "text-brand"
          : "text-ink";
  return (
    <article className="rounded-3xl border border-line bg-surface px-5 py-4 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${valueClass}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted">{hint}</p> : null}
    </article>
  );
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const { t } = useI18n();
  const tone =
    severity === "high"
      ? "bg-danger-soft text-danger"
      : severity === "medium"
        ? "bg-warning-soft text-warning"
        : "bg-surface-subtle text-ink";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
    >
      {translateKnown(t, "enum", severity)}
    </span>
  );
}

export function HealthBadge({ state }: { state: string }) {
  const { t } = useI18n();
  const tone =
    state === "ok"
      ? "bg-success-soft text-success"
      : state === "down"
        ? "bg-danger-soft text-danger"
        : "bg-surface-subtle text-muted";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {translateKnown(t, "health", state)}
    </span>
  );
}

export function QoeBar({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  const fill =
    value >= 0.85 ? "bg-success" : value >= 0.7 ? "bg-warning" : "bg-danger";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function IncidentList({
  incidents,
  showSite = true,
  showTime = true,
  showSummary = false,
}: {
  incidents: Incident[];
  showSite?: boolean;
  showTime?: boolean;
  showSummary?: boolean;
}) {
  const { t } = useI18n();
  return (
    <ul className="divide-y divide-line">
      {incidents.map((incident) => (
        <li key={incident.incidentId}>
          <Link
            to={`/incidents/${incident.incidentId}`}
            aria-label={t("common.openIncident", { id: incident.incidentId })}
            className="group flex items-start gap-4 rounded-2xl px-2 py-3 no-underline transition-colors hover:bg-surface-subtle"
          >
            <SeverityBadge severity={incident.severity} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {translateKnown(t, "enum", incident.classification)}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                {incident.incidentId}
                {showSite ? (
                  <>
                    {" · "}
                    <span className="font-sans">{incident.siteId}</span>
                  </>
                ) : null}
                {" · "}
                {t("common.confidence")} {formatPercent(incident.confidence)}
                {" · "}
                {incident.signalCount} {t("common.signals").toLowerCase()}
              </p>
              {showSummary ? (
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">
                  {translateIncidentSummary(t, incident.summary)}
                </p>
              ) : null}
            </div>
            {showTime ? (
              <time className="shrink-0 text-xs tabular-nums text-muted">
                {formatTime(incident.timestamp)}
              </time>
            ) : null}
            <ChevronRight
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-70"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
