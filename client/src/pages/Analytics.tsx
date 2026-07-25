import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { api } from "../lib/api";
import type { AnalyticsSummary } from "../types";
import { Card, PageHeader, ProgressBar } from "../components/ui";

export default function Analytics() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    api.analytics.summary().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <p className="text-sm text-dusk">Loading analytics…</p>
      </div>
    );
  }

  const chartData = data.last14Days.map((d) => ({
    label: new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    completed: d.completed,
    total: d.total,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <PageHeader
        title="Analytics"
        subtitle="Only the numbers that help you make better decisions — nothing else."
      />

      <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-dusk">Today</p>
          <p className="mt-1 font-display text-3xl text-ink">
            {data.today.completed}
            <span className="text-base text-dusk"> / {data.today.total}</span>
          </p>
          <p className="mt-1 text-xs text-dusk">tasks completed</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-dusk">All-time completion rate</p>
          <p className="mt-1 font-display text-3xl text-ink">{data.allTime.completionRate}%</p>
          <p className="mt-1 text-xs text-dusk">
            {data.allTime.totalCompleted} of {data.allTime.totalTasks} tasks
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-dusk">Active projects tracked</p>
          <p className="mt-1 font-display text-3xl text-ink">{data.projects.length}</p>
          <p className="mt-1 text-xs text-dusk">across your workspace</p>
        </Card>
      </div>

      <Card className="mb-5 p-5">
        <h2 className="mb-4 font-display text-base text-ink">Last 14 days</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-dusk-light)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-dusk)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-dusk)" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "var(--color-paper)",
                border: "1px solid var(--color-dusk-light)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="total" stroke="var(--color-dusk-light)" strokeWidth={2} dot={false} name="Planned" />
            <Line type="monotone" dataKey="completed" stroke="var(--color-moss)" strokeWidth={2.5} dot={{ r: 2 }} name="Completed" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-display text-base text-ink">Project completion</h2>
        {data.projects.length === 0 ? (
          <p className="text-xs text-dusk">No projects yet — create one to see progress here.</p>
        ) : (
          <div className="space-y-3">
            {data.projects.map((p) => (
              <div key={p.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-ink-soft">{p.name}</span>
                  <span className="font-mono text-xs text-dusk">{p.progress}%</span>
                </div>
                <ProgressBar value={p.progress} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
