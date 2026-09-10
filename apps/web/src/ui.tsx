import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-5">
      <h1 className="text-lg font-medium tracking-tight text-ink">{title}</h1>
      {description ? (
        <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>
      ) : null}
    </header>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="border border-line bg-surface px-4 py-6 text-sm text-muted">
      {children}
    </p>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p className="border border-danger/30 bg-surface px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-line bg-surface">
      <h2 className="border-b border-line px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}
