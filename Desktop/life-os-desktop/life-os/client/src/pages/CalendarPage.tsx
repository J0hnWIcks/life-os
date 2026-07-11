import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Repeat, CalendarCheck } from "lucide-react";
import { api, todayISO } from "../lib/api";
import type { CalendarEvent, Task, EventType, Recurrence } from "../types";
import { Card, PageHeader, Pill, EmptyState } from "../components/ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState(todayISO());
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<EventType>("event");
  const [newRecurrence, setNewRecurrence] = useState<Recurrence>("none");
  const [newRecurrenceEnd, setNewRecurrenceEnd] = useState("");

  function load() {
    api.events.list().then(setEvents);
    api.tasks.list().then(setTasks);
    api.google.events().then(setGoogleEvents).catch(() => setGoogleEvents([]));
  }
  useEffect(load, []);

  const allEvents = useMemo(() => [...events, ...googleEvents], [events, googleEvents]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, { events: CalendarEvent[]; tasks: Task[] }> = {};
    allEvents.forEach((e) => {
      map[e.date] = map[e.date] || { events: [], tasks: [] };
      map[e.date].events.push(e);
    });
    tasks
      .filter((t) => t.date)
      .forEach((t) => {
        const d = t.date as string;
        map[d] = map[d] || { events: [], tasks: [] };
        map[d].tasks.push(t);
      });
    return map;
  }, [allEvents, tasks]);

  const selectedItems = itemsByDate[selected] || { events: [], tasks: [] };
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  async function addEvent() {
    const title = newTitle.trim();
    if (!title) return;
    await api.events.create({
      title,
      date: selected,
      type: newType,
      recurrence: newRecurrence,
      recurrenceEndDate: newRecurrence !== "none" ? newRecurrenceEnd || undefined : undefined,
    });
    setNewTitle("");
    setNewRecurrence("none");
    setNewRecurrenceEnd("");
    load();
  }

  async function removeEvent(id: string) {
    await api.events.remove(id);
    load();
  }

  async function stopRepeatingEvent(id: string) {
    await api.events.removeSeries(id);
    load();
  }

  const upcomingDeadlines = events
    .filter((e) => e.type === "deadline" && e.date >= todayISO())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <PageHeader title="Calendar" subtitle="Events, deadlines, and recurring commitments, all in one view." />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card className="p-4 sm:p-6 md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">{monthLabel}</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCursor(new Date(year, month - 1, 1))}
                className="rounded p-1.5 hover:bg-fog"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCursor(new Date())}
                className="rounded px-2 py-1 text-xs font-medium text-ink-soft hover:bg-fog"
              >
                Today
              </button>
              <button
                onClick={() => setCursor(new Date(year, month + 1, 1))}
                className="rounded p-1.5 hover:bg-fog"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-dusk">
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-1.5 font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((day, i) => {
              if (day === null) return <div key={i} />;
              const iso = toISO(year, month, day);
              const dayItems = itemsByDate[iso];
              const isToday = iso === todayISO();
              const isSelected = iso === selected;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(iso)}
                  className={`flex h-14 flex-col items-start rounded-md border p-1 text-left transition sm:h-20 sm:p-1.5 ${
                    isSelected
                      ? "border-moss bg-moss-light"
                      : isToday
                        ? "border-signal bg-signal-light"
                        : "border-transparent hover:bg-fog"
                  }`}
                >
                  <span className={`font-mono text-xs ${isToday ? "font-semibold text-ink" : "text-ink-soft"}`}>
                    {day}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {dayItems?.events.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          e.source === "google" ? "bg-signal" : e.type === "deadline" ? "bg-ember" : "bg-moss"
                        }`}
                      />
                    ))}
                    {dayItems?.tasks.length ? (
                      <span className="hidden text-[9px] text-dusk sm:inline">{dayItems.tasks.length}t</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="mb-3 font-display text-base text-ink">
              {new Date(selected + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </h2>
            <div className="mb-3 flex gap-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEvent()}
                placeholder="Add event or deadline…"
                className="flex-1 rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
              />
            </div>
            <div className="mb-3 flex gap-1.5">
              {(["event", "deadline", "recurring"] as EventType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${
                    newType === t ? "border-moss bg-moss-light text-moss" : "border-dusk-light text-dusk"
                  }`}
                >
                  {t}
                </button>
              ))}
              <button onClick={addEvent} className="ml-auto rounded-md bg-moss px-2 text-paper hover:bg-moss/90">
                <Plus size={14} />
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] text-dusk">
              <Repeat size={12} />
              <select
                value={newRecurrence}
                onChange={(e) => setNewRecurrence(e.target.value as Recurrence)}
                className="rounded-md border border-dusk-light px-1.5 py-1 text-[11px] text-ink-soft"
              >
                <option value="none">Doesn't repeat</option>
                <option value="daily">Repeats daily</option>
                <option value="weekly">Repeats weekly</option>
                <option value="monthly">Repeats monthly</option>
                <option value="yearly">Repeats yearly</option>
              </select>
              {newRecurrence !== "none" && (
                <input
                  type="date"
                  value={newRecurrenceEnd}
                  onChange={(e) => setNewRecurrenceEnd(e.target.value)}
                  title="Repeat until (optional)"
                  className="rounded-md border border-dusk-light px-1.5 py-1 text-[11px] text-ink-soft"
                />
              )}
            </div>

            {selectedItems.events.length === 0 && selectedItems.tasks.length === 0 ? (
              <EmptyState title="Nothing scheduled" />
            ) : (
              <div className="space-y-2">
                {selectedItems.events.map((e) => (
                  <div key={e.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-fog">
                    {e.source === "google" ? (
                      <Pill tone="signal">
                        <span className="flex items-center gap-1">
                          <CalendarCheck size={10} /> Google
                        </span>
                      </Pill>
                    ) : (
                      <Pill tone={e.type === "deadline" ? "ember" : "moss"}>{e.type}</Pill>
                    )}
                    <span className="flex-1 truncate text-ink-soft">{e.title}</span>
                    {e.recurrence && e.recurrence !== "none" && (
                      <span title={`Repeats ${e.recurrence}`}>
                        <Repeat size={12} className="text-dusk" />
                      </span>
                    )}
                    {e.source !== "google" && e.seriesId && (
                      <button
                        onClick={() => stopRepeatingEvent(e.id)}
                        title="Stop repeating"
                        className="text-[10px] text-dusk opacity-0 hover:text-ember group-hover:opacity-100"
                      >
                        stop
                      </button>
                    )}
                    {e.source !== "google" && (
                      <button onClick={() => removeEvent(e.id)} className="text-dusk hover:text-ember">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
                {selectedItems.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-fog">
                    <Pill tone="neutral">task</Pill>
                    <span className={`flex-1 truncate ${t.done ? "text-dusk line-through" : "text-ink-soft"}`}>
                      {t.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-display text-base text-ink">Upcoming deadlines</h2>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-xs text-dusk">No deadlines on the horizon.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingDeadlines.map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-soft">{e.title}</span>
                    <span className="font-mono text-xs text-ember">
                      {new Date(e.date + "T00:00:00").toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
