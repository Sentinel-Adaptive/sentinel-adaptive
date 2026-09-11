import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  scenarioTags,
  siteIds,
  type BackgroundSimulationRequest,
  type DatasetStats,
  type MixedSimulationRequest,
  type SimulationJob,
  type SimulationMode,
  type SimulationStatus,
  type SyntheticSimulationRequest,
} from "@sentinel-adaptive/contracts";

import { postJson } from "../api.js";
import { formatTime } from "../format.js";
import { useI18n } from "../i18n.js";
import { type MessageKey } from "../locales/en.js";
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageHeader,
  Panel,
  StatCard,
} from "../ui.js";
import { useJson } from "../use-json.js";

const modes: SimulationMode[] = ["background", "synthetic", "mixed"];
const scenarioOptions: string[] = [...scenarioTags];
const siteOptions: string[] = ["", ...siteIds];

export function SimulationPage() {
  const { t } = useI18n();
  const { data: stats, error: statsError, loading: statsLoading } = useJson<
    DatasetStats | null
  >("/api/simulation/dataset");
  const [tick, setTick] = useState(0);
  const { data: jobs, loading: jobsLoading } = useJson<SimulationJob[]>(
    "/api/simulation/jobs",
    tick,
  );

  const [mode, setMode] = useState<SimulationMode>("mixed");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [background, setBackground] = useState<BackgroundSimulationRequest>({
    limit: 10_000,
    intervalMs: 0,
  });

  const [synthetic, setSynthetic] = useState<SyntheticSimulationRequest>({
    scenario: "beacon",
    count: 60,
    intervalMs: 25,
  });

  const [mixed, setMixed] = useState<MixedSimulationRequest>({
    realLimit: 10_000,
    burstScenario: "beacon",
    burstCount: 6,
    burstEvery: 1_000,
    intervalMs: 0,
  });

  useEffect(() => {
    const id = setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const activeJobs = useMemo(
    () =>
      (jobs ?? []).filter(
        (job) => job.status === "queued" || job.status === "running",
      ),
    [jobs],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (mode === "background") {
        await postJson<SimulationJob>("/api/simulation/background", background);
      } else if (mode === "synthetic") {
        await postJson<SimulationJob>("/api/simulation/synthetic", synthetic);
      } else {
        await postJson<SimulationJob>("/api/simulation/mixed", mixed);
      }
      setTick((value) => value + 1);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelJob(jobId: string): Promise<void> {
    try {
      await postJson<SimulationJob>("/api/simulation/jobs/cancel", { id: jobId });
      setTick((value) => value + 1);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div>
      <PageHeader
        title={t("simulation.title")}
        description={t("simulation.description")}
      />

      {submitError ? <ErrorBanner>{submitError}</ErrorBanner> : null}

      <Panel title={t("simulation.dataset.title")} className="mb-6">
        {statsError ? (
          <ErrorBanner>{statsError}</ErrorBanner>
        ) : statsLoading && !stats ? (
          <LoadingState label={t("common.loading")} />
        ) : !stats ? (
          <EmptyState>{t("simulation.dataset.notConfigured")}</EmptyState>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={t("simulation.dataset.files")}
                value={String(stats.files)}
              />
              <StatCard
                label={t("simulation.dataset.lines")}
                value={stats.linesRead.toLocaleString()}
              />
              <StatCard
                label={t("simulation.dataset.parsed")}
                value={stats.parsed.toLocaleString()}
              />
              <StatCard
                label={t("simulation.dataset.skipped")}
                value={stats.skipped.toLocaleString()}
              />
              <StatCard
                label={t("simulation.dataset.clients")}
                value={stats.uniqueClients.toLocaleString()}
              />
              <StatCard
                label={t("simulation.dataset.qnames")}
                value={stats.uniqueQnames.toLocaleString()}
              />
              <StatCard
                label={t("simulation.dataset.earliest")}
                value={
                  stats.earliestTimestamp ? formatTime(stats.earliestTimestamp) : "—"
                }
              />
              <StatCard
                label={t("simulation.dataset.latest")}
                value={
                  stats.latestTimestamp ? formatTime(stats.latestTimestamp) : "—"
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TopList
                title={t("simulation.dataset.topQnames")}
                items={stats.topQnames}
              />
              <TopList
                title={t("simulation.dataset.topClients")}
                items={stats.topClients}
              />
            </div>
          </div>
        )}
      </Panel>

      <Panel title={t("simulation.mode") ?? "Mode"} className="mb-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === m
                    ? "bg-brand text-white"
                    : "border border-line bg-surface text-ink hover:border-brand/30",
                ].join(" ")}
              >
                {t(`simulation.mode.${m}`)}
              </button>
            ))}
          </div>

          <p className="text-sm text-muted">
            {t(`simulation.mode.${mode}Hint`)}
          </p>

          {mode === "background" ? (
            <BackgroundFields values={background} onChange={setBackground} />
          ) : mode === "synthetic" ? (
            <SyntheticFields values={synthetic} onChange={setSynthetic} />
          ) : (
            <MixedFields values={mixed} onChange={setMixed} />
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || activeJobs.length > 0}
              className={[
                "rounded-full px-5 py-2 text-sm font-medium transition-colors",
                submitting || activeJobs.length > 0
                  ? "cursor-not-allowed bg-surface-subtle text-muted"
                  : "bg-brand text-white hover:bg-brand/90",
              ].join(" ")}
            >
              {submitting ? t("simulation.running") : t("simulation.start")}
            </button>
            {activeJobs.length > 0 ? (
              <span className="text-xs text-muted">
                {t("simulation.running")}: {activeJobs[0]?.id.slice(0, 8)}
              </span>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel title={t("simulation.jobs.title")}>
        {jobsLoading && !jobs ? (
          <LoadingState label={t("common.loading")} />
        ) : !jobs || jobs.length === 0 ? (
          <EmptyState>{t("simulation.noJobs")}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-2 pr-4 font-medium">{t("simulation.jobs.id")}</th>
                  <th className="py-2 pr-4 font-medium">{t("simulation.jobs.mode")}</th>
                  <th className="py-2 pr-4 font-medium">{t("simulation.jobs.status")}</th>
                  <th className="py-2 pr-4 font-medium">{t("simulation.jobs.progress")}</th>
                  <th className="py-2 pr-4 font-medium">{t("simulation.jobs.started")}</th>
                  <th className="py-2 pr-4 font-medium">{t("simulation.jobs.finished")}</th>
                  <th className="py-2 pr-4 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    onCancel={() => void cancelJob(job.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function TopList({
  title,
  items,
}: {
  title: string;
  items: readonly { value: string; count: number }[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-subtle/40 p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {title}
      </h3>
      <ul className="space-y-2 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate font-mono text-xs text-ink">
              {item.value}
            </span>
            <span className="shrink-0 tabular-nums text-muted">
              {item.count.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobRow({
  job,
  onCancel,
}: {
  job: SimulationJob;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const canCancel = job.status === "queued" || job.status === "running";
  return (
    <tr>
      <td className="py-3 pr-4 font-mono text-xs text-ink">{job.id.slice(0, 8)}</td>
      <td className="py-3 pr-4 text-ink">{t(`simulation.mode.${job.mode}`)}</td>
      <td className="py-3 pr-4">
        <span
          className={[
            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
            statusTone(job.status),
          ].join(" ")}
        >
          {t(`simulation.${job.status}`)}
        </span>
      </td>
      <td className="py-3 pr-4 text-xs text-muted">
        <ProgressSummary job={job} />
      </td>
      <td className="py-3 pr-4 text-xs text-muted">
        {formatTime(job.startedAt)}
      </td>
      <td className="py-3 pr-4 text-xs text-muted">
        {job.finishedAt ? formatTime(job.finishedAt) : "—"}
      </td>
      <td className="py-3 pr-4 text-right">
        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-3 py-1 text-xs font-medium text-danger hover:bg-danger-soft"
          >
            {t("simulation.stop")}
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function ProgressSummary({ job }: { job: SimulationJob }) {
  const progress = job.progress as Record<string, number | string>;
  if (job.mode === "background") {
    return <span>{String(progress.published ?? 0)} events</span>;
  }
  if (job.mode === "synthetic") {
    return <span>{String(progress.published ?? progress.generated ?? 0)} events</span>;
  }
  return (
    <span>
      real {String(progress.realPublished ?? 0)} / synth{" "}
      {String(progress.syntheticPublished ?? 0)} / bursts{" "}
      {String(progress.burstsInjected ?? 0)}
    </span>
  );
}

function statusTone(status: SimulationStatus): string {
  switch (status) {
    case "completed":
      return "bg-success-soft text-success";
    case "failed":
      return "bg-danger-soft text-danger";
    case "running":
      return "bg-brand/10 text-brand";
    case "queued":
      return "bg-surface-subtle text-muted";
    case "cancelled":
      return "bg-warning-soft text-warning";
  }
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  optionLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  optionLabel: (value: string) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function BackgroundFields({
  values,
  onChange,
}: {
  values: BackgroundSimulationRequest;
  onChange: (values: BackgroundSimulationRequest) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NumberField
        label={t("simulation.limit.label")}
        value={values.limit}
        min={1}
        max={1_000_000}
        onChange={(limit) => onChange({ ...values, limit })}
      />
      <NumberField
        label={t("simulation.intervalMs.label")}
        value={values.intervalMs}
        min={0}
        onChange={(intervalMs) => onChange({ ...values, intervalMs })}
      />
    </div>
  );
}

function SyntheticFields({
  values,
  onChange,
}: {
  values: SyntheticSimulationRequest;
  onChange: (values: SyntheticSimulationRequest) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SelectField
        label={t("simulation.scenario.label")}
        value={values.scenario}
        options={scenarioOptions}
        optionLabel={(scenario) =>
          scenario === ""
            ? "—"
            : t(`simulation.scenario.${scenario}` as MessageKey)
        }
        onChange={(scenario) =>
          onChange({ ...values, scenario: scenario as SyntheticSimulationRequest["scenario"] })
        }
      />
      <SelectField
        label={t("simulation.site.label")}
        value={values.siteId ?? ""}
        options={siteOptions}
        optionLabel={(siteId) =>
          siteId === ""
            ? t("simulation.site.all")
            : siteId
        }
        onChange={(siteId) =>
          onChange({ ...values, siteId: siteId as SyntheticSimulationRequest["siteId"] | undefined })
        }
      />
      <NumberField
        label={t("simulation.count.label")}
        value={values.count}
        min={1}
        max={100_000}
        onChange={(count) => onChange({ ...values, count })}
      />
      <NumberField
        label={t("simulation.intervalMs.label")}
        value={values.intervalMs}
        min={0}
        onChange={(intervalMs) => onChange({ ...values, intervalMs })}
      />
      <NumberField
        label={t("simulation.seed.label")}
        value={values.seed ?? 0}
        min={0}
        onChange={(seed) => onChange({ ...values, seed })}
      />
    </div>
  );
}

function MixedFields({
  values,
  onChange,
}: {
  values: MixedSimulationRequest;
  onChange: (values: MixedSimulationRequest) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NumberField
        label={t("simulation.limit.label")}
        value={values.realLimit}
        min={1}
        max={1_000_000}
        onChange={(realLimit) => onChange({ ...values, realLimit })}
      />
      <SelectField
        label={t("simulation.burstScenario.label")}
        value={values.burstScenario}
        options={scenarioOptions}
        optionLabel={(scenario) =>
          scenario === ""
            ? "—"
            : t(`simulation.scenario.${scenario}` as MessageKey)
        }
        onChange={(burstScenario) =>
          onChange({
            ...values,
            burstScenario: burstScenario as MixedSimulationRequest["burstScenario"],
          })
        }
      />
      <SelectField
        label={t("simulation.site.label")}
        value={values.siteId ?? ""}
        options={siteOptions}
        optionLabel={(siteId) =>
          siteId === "" ? t("simulation.site.all") : siteId
        }
        onChange={(siteId) =>
          onChange({
            ...values,
            siteId: siteId as MixedSimulationRequest["siteId"] | undefined,
          })
        }
      />
      <NumberField
        label={t("simulation.burstCount.label")}
        value={values.burstCount}
        min={1}
        max={10_000}
        onChange={(burstCount) => onChange({ ...values, burstCount })}
      />
      <NumberField
        label={t("simulation.burstEvery.label")}
        value={values.burstEvery}
        min={1}
        max={1_000_000}
        onChange={(burstEvery) => onChange({ ...values, burstEvery })}
      />
      <NumberField
        label={t("simulation.intervalMs.label")}
        value={values.intervalMs}
        min={0}
        onChange={(intervalMs) => onChange({ ...values, intervalMs })}
      />
    </div>
  );
}
