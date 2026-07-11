import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CheckCircle2,
  Circle,
  Sparkles,
  Repeat,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Timer,
  Briefcase,
} from "lucide-react";
import { api, todayISO } from "../lib/api";
import type { Task, DailyLog, Priority, Recurrence, Subtask, Project } from "../types";
import { Card, PageHeader, ProgressBar, EmptyState, PriorityDot } from "../components/ui";
import DayRing from "../components/DayRing";

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function Planner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") || todayISO());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [log, setLog] = useState<DailyLog>({ date, goals: [], reflection: "", notes: "" });

  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [newRecurrence, setNewRecurrence] = useState<Recurrence>("none");
  const [newRecurrenceEnd, setNewRecurrenceEnd] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newSubtask, setNewSubtask] = useState("");

  useEffect(() => {
    if (searchParams.get("date")) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    // Tasks shown here are only ones explicitly scheduled for this exact
    // day — a task only gets a `date` by being added directly in the
    // planner, or by being deliberately "shown in planner" from a project
    // (see ProjectDetail). Project tasks are hidden from the planner by
    // default; this filter is what keeps that true.
    api.tasks.list().then((all) => setTasks(all.filter((t) => t.date === date)));
    api.dailyLog.get(date).then(setLog);
  }

  useEffect(load, [date]);
  useEffect(() => {
    api.projects.list().then(setProjects);
  }, []);

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const isToday = date === todayISO();
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999)),
    [tasks]
  );
  const completed = tasks.filter((t) => t.done);

  async function addTask() {
    const title = newTask.trim();
    if (!title) return;
    await api.tasks.create({
      title,
      done: false,
      date,
      priority: newPriority,
      startTime: newStart || undefined,
      endTime: newEnd || undefined,
      order: tasks.length,
      recurrence: newRecurrence,
      recurrenceEndDate: newRecurrence !== "none" ? newRecurrenceEnd || undefined : undefined,
    });
    setNewTask("");
    setNewStart("");
    setNewEnd("");
    setNewRecurrence("none");
    setNewRecurrenceEnd("");
    load();
  }

  async function toggleTask(t: Task) {
    const updated = await api.tasks.update(t.id, { done: !t.done });
    setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
  }

  async function removeTask(t: Task) {
    await api.tasks.remove(t.id);
    load();
  }

  async function stopRepeating(t: Task) {
    await api.tasks.removeSeries(t.id);
    load();
  }

  async function addSubtask(t: Task) {
    const title = newSubtask.trim();
    if (!title) return;
    const subtask: Subtask = { id: crypto.randomUUID().slice(0, 8), title, done: false };
    const updated = await api.tasks.update(t.id, { subtasks: [...(t.subtasks || []), subtask] });
    setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    setNewSubtask("");
  }

  async function toggleSubtask(t: Task, subtaskId: string) {
    const subtasks = (t.subtasks || []).map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s));
    const updated = await api.tasks.update(t.id, { subtasks });
    setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
  }

  async function removeSubtask(t: Task, subtaskId: string) {
    const subtasks = (t.subtasks || []).filter((s) => s.id !== subtaskId);
    const updated = await api.tasks.update(t.id, { subtasks });
    setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
  }

  async function reorder(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const list = [...sortedTasks];
    const fromIdx = list.findIndex((t) => t.id === draggedId);
    const toIdx = list.findIndex((t) => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    const reordered = list.map((t, i) => ({ ...t, order: i }));
    setTasks((prev) => prev.map((t) => reordered.find((r) => r.id === t.id) || t));
    await Promise.all(reordered.map((t) => api.tasks.update(t.id, { order: t.order })));
  }

  async function scheduleFromRing(taskId: string, time: string) {
    const updated = await api.tasks.update(taskId, { startTime: time });
    setTasks((prev) => prev.map((x) => (x.id === taskId ? updated : x)));
  }

  async function addGoal() {
    const goal = newGoal.trim();
    if (!goal) return;
    const updated = await api.dailyLog.update(date, { goals: [...(log.goals || []), goal] });
    setLog(updated);
    setNewGoal("");
  }

  async function removeGoal(i: number) {
    const goals = (log.goals || []).filter((_, idx) => idx !== i);
    const updated = await api.dailyLog.update(date, { goals });
    setLog(updated);
  }

  async function saveField(field: "reflection" | "notes", value: string) {
    setLog((l) => ({ ...l, [field]: value }));
    await api.dailyLog.update(date, { [field]: value });
  }

  const timeBlocks = tasks
    .filter((t) => t.startTime)
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  const dayLabel = new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <PageHeader
        title="Daily Planner"
        subtitle="Each day is a clean slate — everything you complete is kept for your records."
        action={
          <div className="flex items-center gap-1 rounded-lg border border-dusk-light bg-paper p-1">
            <button onClick={() => setDate(shiftDate(date, -1))} className="rounded p-1.5 hover:bg-fog">
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setDate(todayISO())}
              className={`rounded px-3 py-1 text-xs font-medium ${
                isToday ? "bg-moss-light text-moss" : "text-ink-soft hover:bg-fog"
              }`}
            >
              {isToday ? "Today" : dayLabel}
            </button>
            <button onClick={() => setDate(shiftDate(date, 1))} className="rounded p-1.5 hover:bg-fog">
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="md:col-span-2 space-y-5">
          {/* Goals */}
          <Card className="p-5">
            <h2 className="mb-3 font-display text-base text-ink">Today's goals</h2>
            <div className="mb-3 flex gap-2">
              <input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGoal()}
                placeholder="What matters most today?"
                className="flex-1 rounded-md border border-dusk-light px-3 py-1.5 text-sm outline-none focus:border-moss"
              />
              <button onClick={addGoal} className="rounded-md bg-moss px-3 text-paper hover:bg-moss/90">
                <Plus size={15} />
              </button>
            </div>
            <ul className="space-y-1.5">
              {(log.goals || []).map((g, i) => (
                <li key={i} className="flex items-center justify-between rounded-md px-2 py-1 text-sm text-ink-soft hover:bg-fog">
                  <span className="flex items-center gap-2">
                    <Sparkles size={13} className="text-signal" />
                    {g}
                  </span>
                  <button onClick={() => removeGoal(i)} className="text-dusk hover:text-ember">
                    <X size={13} />
                  </button>
                </li>
              ))}
              {(log.goals || []).length === 0 && (
                <p className="px-2 py-1 text-xs text-dusk">No goals set for this day yet.</p>
              )}
            </ul>
          </Card>

          {/* Priority tasks / checklist */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base text-ink">Tasks</h2>
              <span className="font-mono text-xs text-dusk">
                {completed.length}/{tasks.length}
              </span>
            </div>
            <ProgressBar value={tasks.length ? (completed.length / tasks.length) * 100 : 0} className="mb-4" />

            <div className="mb-2 flex flex-wrap gap-2">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="Add a task…"
                className="min-w-[160px] flex-1 rounded-md border border-dusk-light px-3 py-1.5 text-sm outline-none focus:border-moss"
              />
              <input
                type="time"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="rounded-md border border-dusk-light px-2 py-1.5 text-xs text-ink-soft"
              />
              <input
                type="time"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="rounded-md border border-dusk-light px-2 py-1.5 text-xs text-ink-soft"
              />
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as Priority)}
                className="rounded-md border border-dusk-light px-2 py-1.5 text-xs text-ink-soft"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button onClick={addTask} className="rounded-md bg-moss px-3 text-paper hover:bg-moss/90">
                <Plus size={15} />
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-dusk">
              <Repeat size={13} />
              <span>Repeats</span>
              <select
                value={newRecurrence}
                onChange={(e) => setNewRecurrence(e.target.value as Recurrence)}
                className="rounded-md border border-dusk-light px-2 py-1 text-xs text-ink-soft"
              >
                <option value="none">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              {newRecurrence !== "none" && (
                <>
                  <span>until</span>
                  <input
                    type="date"
                    value={newRecurrenceEnd}
                    onChange={(e) => setNewRecurrenceEnd(e.target.value)}
                    className="rounded-md border border-dusk-light px-2 py-1 text-xs text-ink-soft"
                  />
                  <span className="text-dusk/70">(optional — leave blank for an open-ended repeat)</span>
                </>
              )}
            </div>

            {tasks.length === 0 ? (
              <EmptyState title="No tasks yet" hint="Add your priorities for the day above." />
            ) : (
              <ul className="space-y-1">
                {sortedTasks.map((t) => {
                  const subtasks = t.subtasks || [];
                  const subtaskDone = subtasks.filter((s) => s.done).length;
                  const isExpanded = expandedTaskId === t.id;
                  return (
                    <li key={t.id} className="rounded-md">
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", t.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const draggedId = e.dataTransfer.getData("text/plain");
                          if (draggedId) reorder(draggedId, t.id);
                        }}
                        className="group flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-fog active:cursor-grabbing"
                      >
                        <GripVertical size={13} className="shrink-0 text-dusk-light" />
                        <button onClick={() => toggleTask(t)} className="shrink-0">
                          {t.done ? (
                            <CheckCircle2 size={16} className="text-moss" />
                          ) : (
                            <Circle size={16} className="text-dusk-light" />
                          )}
                        </button>
                        <span className={`flex-1 ${t.done ? "text-dusk line-through" : "text-ink-soft"}`}>
                          {t.title}
                        </span>
                        {t.projectId && projectById.get(t.projectId) && (
                          <Link
                            to={`/projects/${t.projectId}`}
                            title={`Part of project: ${projectById.get(t.projectId)!.name}`}
                            className="flex shrink-0 items-center gap-1 rounded-full border border-dusk-light px-2 py-0.5 text-[10px] text-dusk hover:border-moss hover:text-moss"
                          >
                            <Briefcase size={10} />
                            {projectById.get(t.projectId)!.name}
                          </Link>
                        )}
                        {t.recurrence && t.recurrence !== "none" && (
                          <span title={`Repeats ${t.recurrence}`}>
                            <Repeat size={12} className="text-dusk" />
                          </span>
                        )}
                        {t.startTime && <span className="font-mono text-[11px] text-dusk">{t.startTime}</span>}
                        <PriorityDot priority={t.priority} />
                        <button
                          onClick={() => setExpandedTaskId(isExpanded ? null : t.id)}
                          className="flex items-center gap-1 rounded px-1 text-[11px] text-dusk hover:text-ink-soft"
                          title="Subtasks"
                        >
                          {subtasks.length > 0 && (
                            <span className="font-mono">
                              {subtaskDone}/{subtasks.length}
                            </span>
                          )}
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        {t.seriesId && (
                          <button
                            onClick={() => stopRepeating(t)}
                            title="Stop repeating (removes this and future occurrences)"
                            className="text-[10px] text-dusk opacity-0 hover:text-ember group-hover:opacity-100"
                          >
                            stop repeating
                          </button>
                        )}
                        {!t.done && (
                          <Link
                            to={`/focus?task=${t.id}`}
                            title="Start a focus session on this task"
                            className="text-dusk opacity-0 hover:text-moss group-hover:opacity-100"
                          >
                            <Timer size={13} />
                          </Link>
                        )}
                        <button
                          onClick={() => removeTask(t)}
                          className="text-dusk opacity-0 hover:text-ember group-hover:opacity-100"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="ml-9 mr-2 mb-2 rounded-md border border-dusk-light bg-fog/50 p-2.5">
                          {subtasks.length > 0 && (
                            <ul className="mb-2 space-y-1">
                              {subtasks.map((s) => (
                                <li key={s.id} className="group/sub flex items-center gap-2 text-xs">
                                  <button onClick={() => toggleSubtask(t, s.id)} className="shrink-0">
                                    {s.done ? (
                                      <CheckCircle2 size={13} className="text-moss" />
                                    ) : (
                                      <Circle size={13} className="text-dusk-light" />
                                    )}
                                  </button>
                                  <span className={`flex-1 ${s.done ? "text-dusk line-through" : "text-ink-soft"}`}>
                                    {s.title}
                                  </span>
                                  <button
                                    onClick={() => removeSubtask(t, s.id)}
                                    className="text-dusk opacity-0 hover:text-ember group-hover/sub:opacity-100"
                                  >
                                    <X size={11} />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex gap-1.5">
                            <input
                              value={newSubtask}
                              onChange={(e) => setNewSubtask(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && addSubtask(t)}
                              placeholder="Add a subtask…"
                              className="flex-1 rounded-md border border-dusk-light px-2 py-1 text-xs outline-none focus:border-moss"
                            />
                            <button
                              onClick={() => addSubtask(t)}
                              className="rounded-md bg-moss px-2 text-paper hover:bg-moss/90"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Accomplished today */}
          <Card className="p-5">
            <h2 className="mb-3 font-display text-base text-ink">Accomplished today</h2>
            {completed.length === 0 ? (
              <p className="text-xs text-dusk">Nothing marked done yet — it'll show up here as you go.</p>
            ) : (
              <ul className="space-y-1.5">
                {completed.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm text-ink-soft">
                    <CheckCircle2 size={14} className="text-moss" />
                    {t.title}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {/* Day Ring — drag a task here to time-block it */}
          <Card className="flex flex-col items-center p-5">
            <h2 className="mb-3 self-start font-display text-base text-ink">Time-block this day</h2>
            <DayRing tasks={tasks} size={200} onDropTask={scheduleFromRing} />
            <p className="mt-3 text-center text-[11px] text-dusk">
              Drag any task from the list onto the ring to give it a time slot.
            </p>
          </Card>

          {/* Time blocks list */}
          <Card className="p-5">
            <h2 className="mb-3 font-display text-base text-ink">Time blocks</h2>
            {timeBlocks.length === 0 ? (
              <p className="text-xs text-dusk">Give a task a start time to see it here.</p>
            ) : (
              <ul className="space-y-2.5 border-l-2 border-dusk-light pl-3">
                {timeBlocks.map((t) => (
                  <li key={t.id} className="relative text-sm">
                    <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-moss" />
                    <span className="font-mono text-xs text-dusk">
                      {t.startTime}
                      {t.endTime ? `–${t.endTime}` : ""}
                    </span>
                    <p className={t.done ? "text-dusk line-through" : "text-ink-soft"}>{t.title}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Notes */}
          <Card className="p-5">
            <h2 className="mb-2 font-display text-base text-ink">Notes</h2>
            <textarea
              defaultValue={log.notes}
              onBlur={(e) => saveField("notes", e.target.value)}
              placeholder="Anything worth remembering about today…"
              rows={4}
              className="w-full resize-none rounded-md border border-dusk-light p-2.5 text-sm outline-none focus:border-moss"
            />
          </Card>

          {/* Reflection */}
          <Card className="p-5">
            <h2 className="mb-2 font-display text-base text-ink">Reflection <span className="font-sans text-xs font-normal text-dusk">(optional)</span></h2>
            <textarea
              defaultValue={log.reflection}
              onBlur={(e) => saveField("reflection", e.target.value)}
              placeholder="How did today go?"
              rows={4}
              className="w-full resize-none rounded-md border border-dusk-light p-2.5 text-sm outline-none focus:border-moss"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
