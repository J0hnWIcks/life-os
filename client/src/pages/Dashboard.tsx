import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ArrowRight, FolderKanban, Briefcase } from "lucide-react";
import { api, todayISO } from "../lib/api";
import type { Task, Project, CalendarEvent, Settings } from "../types";
import { quoteOfTheDay } from "../lib/quotes";
import { Card, ProgressBar, Pill, PriorityDot, EmptyState } from "../components/ui";
import DayRing from "../components/DayRing";
import Weather from "../components/Weather";

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const today = todayISO();

  function load() {
    api.tasks.list().then(setTasks);
    api.projects.list().then(setProjects);
    api.events.list().then(setEvents);
    api.settings.get().then(setSettings);
  }

  useEffect(load, []);

  const quote = quoteOfTheDay(settings?.customQuotes || []);

  const todayTasks = tasks
    .filter((t) => t.date === today)
    .sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));
  const completedCount = todayTasks.filter((t) => t.done).length;

  const activeProjects = projects.filter((p) => p.status === "active").slice(0, 4);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  async function toggleTask(t: Task) {
    const updated = await api.tasks.update(t.id, { done: !t.done });
    setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
  }

  async function handleDropOnRing(taskId: string, time: string) {
    const updated = await api.tasks.update(taskId, { startTime: time });
    setTasks((prev) => prev.map((x) => (x.id === taskId ? updated : x)));
  }

  const dayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-dusk">{dayLabel}</p>
          <h1 className="font-display text-[28px] font-medium tracking-tight text-ink">
            {settings?.name ? `Good day, ${settings.name}` : "Your command center"}
          </h1>
        </div>
        <div className="max-w-xs sm:text-right">
          {settings?.quoteOfDay !== false && (
            <>
              <p className="font-display text-[15px] italic leading-snug text-ink-soft">
                “{quote.text}”
              </p>
              <p className="mt-1 text-xs text-dusk">— {quote.author}</p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Today: Day Ring + task list */}
        <Card className="md:col-span-2 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Today</h2>
            <span className="font-mono text-xs text-dusk">
              {completedCount}/{todayTasks.length} done
            </span>
          </div>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch">
            <DayRing tasks={todayTasks} onDropTask={handleDropOnRing} />
            <div className="flex-1 space-y-1.5">
              {todayTasks.length === 0 && (
                <EmptyState
                  title="Nothing planned yet"
                  hint="Add tasks from the Daily Planner to see your day take shape."
                  action={
                    <Link to="/planner" className="text-xs font-medium text-moss hover:underline">
                      Open Daily Planner →
                    </Link>
                  }
                />
              )}
              {todayTasks.slice(0, 7).map((t) => (
                <button
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                  onClick={() => toggleTask(t)}
                  className="flex w-full cursor-grab items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-fog active:cursor-grabbing"
                >
                  {t.done ? (
                    <CheckCircle2 size={16} className="shrink-0 text-moss" />
                  ) : (
                    <Circle size={16} className="shrink-0 text-dusk-light" />
                  )}
                  <span className={`flex-1 truncate ${t.done ? "text-dusk line-through" : "text-ink-soft"}`}>
                    {t.title}
                  </span>
                  {t.projectId && projectById.get(t.projectId) && (
                    <span
                      title={`Part of project: ${projectById.get(t.projectId)!.name}`}
                      className="flex shrink-0 items-center gap-1 rounded-full border border-dusk-light px-1.5 py-0.5 text-[10px] text-dusk"
                    >
                      <Briefcase size={10} />
                    </span>
                  )}
                  {t.startTime && (
                    <span className="font-mono text-[11px] text-dusk">{t.startTime}</span>
                  )}
                  <PriorityDot priority={t.priority} />
                </button>
              ))}
              {todayTasks.length > 7 && (
                <Link to="/planner" className="block px-2 pt-1 text-xs text-moss hover:underline">
                  +{todayTasks.length - 7} more in Daily Planner
                </Link>
              )}
            </div>
          </div>
        </Card>

        {/* Weather + quick stat */}
        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg text-ink">Right now</h2>
          <Weather locationName={settings?.weatherLocation} />
          <div className="my-5 h-px bg-dusk-light" />
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-dusk">Tasks completed today</span>
              <span className="font-mono font-medium text-ink">{completedCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-dusk">Active projects</span>
              <span className="font-mono font-medium text-ink">{activeProjects.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-dusk">Upcoming this month</span>
              <span className="font-mono font-medium text-ink">{upcoming.length}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Active projects */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Current projects</h2>
            <Link to="/projects" className="flex items-center gap-1 text-xs text-moss hover:underline">
              All projects <ArrowRight size={12} />
            </Link>
          </div>
          {activeProjects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban size={22} />}
              title="No active projects yet"
              hint="Create one to track goals, tasks, and progress in one place."
              action={
                <Link to="/projects" className="text-xs font-medium text-moss hover:underline">
                  New project →
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {activeProjects.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="block">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink-soft">{p.name}</span>
                    <span className="font-mono text-xs text-dusk">{p.progress ?? 0}%</span>
                  </div>
                  <ProgressBar value={p.progress ?? 0} />
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Calendar preview */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Coming up</h2>
            <Link to="/calendar" className="flex items-center gap-1 text-xs text-moss hover:underline">
              Full calendar <ArrowRight size={12} />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing on the calendar" hint="Deadlines and events will show up here." />
          ) : (
            <div className="space-y-3">
              {upcoming.map((e) => (
                <div key={e.id} className="flex items-center gap-3 text-sm">
                  <div className="w-14 shrink-0 font-mono text-xs text-dusk">
                    {new Date(e.date + "T00:00:00").toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <span className="flex-1 truncate text-ink-soft">{e.title}</span>
                  <Pill tone={e.isHoliday ? "signal" : e.type === "deadline" ? "ember" : e.type === "birthday" ? "moss" : "neutral"}>
                    {e.isHoliday ? "holiday" : e.type}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
