import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Sparkles, Quote as QuoteIcon } from "lucide-react";
import { api } from "../lib/api";
import type { WeeklyReview as WeeklyReviewType } from "../types";
import { Card, PageHeader, ProgressBar, EmptyState } from "../components/ui";

function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function WeeklyReview() {
  const [weekStart, setWeekStart] = useState(mondayOf(new Date().toISOString().slice(0, 10)));
  const [data, setData] = useState<WeeklyReviewType | null>(null);

  function load() {
    api.analytics.weekly(weekStart).then(setData);
  }
  useEffect(load, [weekStart]);

  const thisWeekStart = mondayOf(new Date().toISOString().slice(0, 10));
  const isThisWeek = weekStart === thisWeekStart;

  const rangeLabel = data
    ? `${new Date(data.weekStart + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(
        data.weekEnd + "T00:00:00"
      ).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "";

  const completionRate = data && data.totals.total ? Math.round((data.totals.completed / data.totals.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        title="Weekly Review"
        subtitle="A two-minute look back — what got done, what you set out to do, and how projects moved."
        action={
          <div className="flex items-center gap-1 rounded-lg border border-dusk-light bg-paper p-1">
            <button onClick={() => setWeekStart(shiftDate(weekStart, -7))} className="rounded p-1.5 hover:bg-fog">
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setWeekStart(thisWeekStart)}
              className={`rounded px-3 py-1 text-xs font-medium ${
                isThisWeek ? "bg-moss-light text-moss" : "text-ink-soft hover:bg-fog"
              }`}
            >
              {isThisWeek ? "This week" : rangeLabel}
            </button>
            <button onClick={() => setWeekStart(shiftDate(weekStart, 7))} className="rounded p-1.5 hover:bg-fog">
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      {!data ? (
        <p className="text-sm text-dusk">Loading…</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs text-dusk">Tasks completed</p>
              <p className="mt-1 font-display text-3xl text-ink">
                {data.totals.completed}
                <span className="text-base text-dusk"> / {data.totals.total}</span>
              </p>
              <ProgressBar value={completionRate} className="mt-2" />
            </Card>
            <Card className="p-5">
              <p className="text-xs text-dusk">Goals set</p>
              <p className="mt-1 font-display text-3xl text-ink">{data.goalsSet}</p>
              <p className="mt-1 text-xs text-dusk">across the week's Daily Planner</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-dusk">Projects touched</p>
              <p className="mt-1 font-display text-3xl text-ink">{data.projectsTouched.length}</p>
              <p className="mt-1 text-xs text-dusk">had progress this week</p>
            </Card>
          </div>

          <Card className="mb-5 p-5">
            <h2 className="mb-4 font-display text-base text-ink">Day by day</h2>
            <div className="grid grid-cols-7 gap-2">
              {data.days.map((d) => {
                const rate = d.total ? Math.round((d.completed / d.total) * 100) : 0;
                const label = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
                return (
                  <div key={d.date} className="text-center">
                    <p className="mb-1 text-[11px] text-dusk">{label}</p>
                    <div className="mx-auto h-16 w-full overflow-hidden rounded-md bg-dusk-light">
                      <div
                        className="w-full bg-moss transition-all"
                        style={{ height: `${rate}%`, marginTop: `${100 - rate}%` }}
                      />
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-dusk">
                      {d.completed}/{d.total}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 font-display text-base text-ink">What got done</h2>
              {data.completedTasks.length === 0 ? (
                <EmptyState title="Nothing completed this week" hint="It'll show up here as tasks get checked off." />
              ) : (
                <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                  {data.completedTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm text-ink-soft">
                      <CheckCircle2 size={14} className="shrink-0 text-moss" />
                      <span className="truncate">{t.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 font-display text-base text-ink">Projects that moved</h2>
              {data.projectsTouched.length === 0 ? (
                <EmptyState title="No project activity this week" />
              ) : (
                <div className="space-y-3">
                  {data.projectsTouched.map((p) => (
                    <div key={p.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-ink-soft">{p.name}</span>
                        <span className="font-mono text-xs text-dusk">
                          {p.progress}% · +{p.completedThisWeek} done
                        </span>
                      </div>
                      <ProgressBar value={p.progress} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {data.reflections.length > 0 && (
            <Card className="mt-5 p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-base text-ink">
                <Sparkles size={15} className="text-signal" /> Reflections from this week
              </h2>
              <div className="space-y-3">
                {data.reflections.map((r) => (
                  <div key={r.date} className="flex gap-2.5 text-sm">
                    <QuoteIcon size={14} className="mt-0.5 shrink-0 text-dusk" />
                    <div>
                      <p className="text-ink-soft">{r.text}</p>
                      <p className="mt-0.5 text-[11px] text-dusk">
                        {new Date(r.date + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
