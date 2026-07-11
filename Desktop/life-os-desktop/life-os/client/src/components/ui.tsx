import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-dusk-light bg-paper ${className}`}>{children}</div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-display text-[22px] font-medium tracking-tight text-ink sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-dusk">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-dusk-light ${className}`}>
      <div
        className="h-full rounded-full bg-moss transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dusk-light py-16 text-center">
      {icon && <div className="mb-3 text-dusk">{icon}</div>}
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-dusk">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "moss" | "ember" | "signal";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-fog text-ink-soft border-dusk-light",
    moss: "bg-moss-light text-moss border-moss/20",
    ember: "bg-ember-light text-ember border-ember/20",
    signal: "bg-signal-light text-ink-soft border-signal/40",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PriorityDot({ priority }: { priority?: string }) {
  const color =
    priority === "high" ? "bg-ember" : priority === "medium" ? "bg-signal" : "bg-dusk-light";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />;
}
