import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { to: "/", label: "Overview", end: true },
  { to: "/incidents", label: "Incidents", end: false },
  { to: "/system", label: "System", end: false },
] as const;

export function AppShell() {
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
    <div className="flex min-h-full bg-canvas text-ink">
      <aside className="flex w-52 shrink-0 flex-col border-r border-black/40 bg-sidebar text-sidebar-ink">
        <div className="border-b border-white/10 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
            Sentinel Adaptive
          </p>
          <p className="mt-1 text-sm font-medium">Operator console</p>
        </div>
        <nav className="flex flex-col gap-0.5 p-2" aria-label="Primary">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "border-l-2 px-3 py-2 text-sm no-underline",
                  isActive
                    ? "border-brand bg-white/10 font-medium text-white"
                    : "border-transparent text-white/70 hover:bg-white/5 hover:text-white",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-4 py-3 text-[11px] leading-snug text-white/40">
          Local QVAC only. Numbers come from this machine.
        </p>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto px-6 py-5">
        <Outlet context={{ tick }} />
      </main>
    </div>
  );
}

export type ShellContext = { tick: number };
