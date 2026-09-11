import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Moon,
  Play,
  Server,
  ShieldAlert,
  Sun,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useI18n, type Locale } from "./i18n.js";
import { useTheme } from "./theme.js";

const nav = [
  { to: "/", key: "nav.overview", icon: LayoutDashboard, end: true },
  { to: "/incidents", key: "nav.incidents", icon: ShieldAlert, end: false },
  { to: "/simulation", key: "nav.simulation", icon: Play, end: false },
  { to: "/system", key: "nav.system", icon: Server, end: false },
] as const;

export type ShellContext = { tick: number };

export function AppShell() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const source = new EventSource("/api/events");
    const bump = () => setTick((value) => value + 1);
    source.addEventListener("incident", bump);
    source.addEventListener("qvac", bump);
    return () => {
      source.close();
    };
  }, []);

  return (
    <div className="flex min-h-full bg-sidebar text-ink">
      <aside className="flex w-56 shrink-0 flex-col px-3 py-4 text-sidebar-ink lg:w-60">
        <div className="flex items-center gap-3 px-2 pb-6 pt-1">
          <Logo />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">{t("brand.name")}</p>
            <p className="truncate text-[11px] text-white/45">{t("brand.console")}</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Primary">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm no-underline transition-colors",
                    isActive
                      ? "bg-white/10 font-medium text-white"
                      : "text-white/65 hover:bg-white/5 hover:text-white",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      aria-hidden="true"
                      className={`size-4 ${isActive ? "text-brand" : "text-white/50"}`}
                    />
                    {t(item.key)}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
        <p className="mt-auto px-2 pt-6 text-[11px] leading-5 text-white/35">
          {t("brand.localOnly")}
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col p-2 sm:p-3 sm:pl-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] bg-canvas">
          <div className="flex items-center justify-end gap-2 border-b border-line/80 px-4 py-2.5">
            <Segmented
              ariaLabel={t("lang.switcher")}
              value={locale}
              onChange={(value) => setLocale(value as Locale)}
              options={[
                { value: "en", label: t("lang.en") },
                { value: "es", label: t("lang.es") },
              ]}
            />
            <Segmented
              ariaLabel={t("theme.toggle")}
              value={theme}
              onChange={(value) => setTheme(value as "light" | "dark")}
              options={[
                {
                  value: "light",
                  label: t("theme.light"),
                  icon: <Sun aria-hidden="true" className="size-3.5" />,
                },
                {
                  value: "dark",
                  label: t("theme.dark"),
                  icon: <Moon aria-hidden="true" className="size-3.5" />,
                },
              ]}
            />
          </div>
          <main className="min-w-0 flex-1 overflow-auto px-5 py-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1120px]">
              <Outlet context={{ tick }} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  const { t } = useI18n();
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-9 shrink-0 text-brand"
      role="img"
      aria-label={t("brand.mark")}
    >
      <rect width="32" height="32" rx="10" fill="currentColor" />
      <path
        d="M16 7.5c4.2 2.2 7 4.1 7 8.4 0 4.6-3.1 7.6-7 9.6-3.9-2-7-5-7-9.6 0-4.3 2.8-6.2 7-8.4Z"
        fill="#111110"
        opacity="0.18"
      />
      <path
        d="M16 9.2c3.3 1.7 5.4 3.2 5.4 6.6 0 3.6-2.4 6-5.4 7.6-3-1.6-5.4-4-5.4-7.6 0-3.4 2.1-4.9 5.4-6.6Z"
        fill="#fff"
      />
      <circle cx="16" cy="16" r="2.1" fill="#111110" />
    </svg>
  );
}

function Segmented({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: ReactNode }[];
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex rounded-full border border-line bg-surface p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
              active ? "bg-brand text-white" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
