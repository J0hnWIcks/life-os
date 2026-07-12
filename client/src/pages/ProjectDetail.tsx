import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  X,
  CheckCircle2,
  Circle,
  Trash2,
  ExternalLink,
  FileText,
  CalendarPlus,
  Eye,
  EyeOff,
} from "lucide-react";
import { api, todayISO } from "../lib/api";
import type { Project, Task, DocumentItem, ProjectStatus, Milestone, LinkRef } from "../types";
import { Card, ProgressBar, Pill } from "../components/ui";

function newId() {
  return crypto.randomUUID().slice(0, 8);
}

const STATUS_OPTIONS: ProjectStatus[] = ["active", "paused", "done", "archived"];

export default function ProjectDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [newTask, setNewTask] = useState("");
  const [newMilestone, setNewMilestone] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null);

  function load() {
    api.projects.get(id).then(setProject).catch(() => setProject(null));
    api.tasks.list().then((all) => setTasks(all.filter((t) => t.projectId === id)));
    api.documents.list().then((all) => setDocs(all.filter((d) => d.projectId === id)));
  }
  useEffect(load, [id]);

  if (!project) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        <p className="text-sm text-dusk">Loading…</p>
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.done);
  const derivedProgress = tasks.length
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : project.progress ?? 0;

  async function patch(fields: Partial<Project>) {
    const updated = await api.projects.update(id, fields);
    setProject(updated);
  }

  async function addTask() {
    const title = newTask.trim();
    if (!title) return;
    // Project tasks live on the project by default and are NOT auto-added to
    // the Daily Planner — no `date` is set here. Use "Show in Planner" on a
    // task (below) to opt a specific one into a specific day.
    await api.tasks.create({ title, done: false, projectId: id });
    setNewTask("");
    load();
  }

  async function scheduleTask(t: Task, date: string) {
    const updated = await api.tasks.update(t.id, { date });
    setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
  }

  async function unscheduleTask(t: Task) {
    // Sending `date: null` (not `undefined`) so the field actually clears
    // over the wire — JSON.stringify drops `undefined` keys entirely.
    const updated = await api.tasks.update(t.id, { date: null as unknown as undefined });
    setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
  }

  async function toggleTask(t: Task) {
    const updated = await api.tasks.update(t.id, { done: !t.done });
    setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
  }

  async function removeTask(t: Task) {
    await api.tasks.remove(t.id);
    load();
  }

  async function addMilestone() {
    const title = newMilestone.trim();
    if (!title || !project) return;
    const milestone: Milestone = { id: newId(), title, done: false };
    await patch({ milestones: [...(project.milestones || []), milestone] });
    setNewMilestone("");
  }

  async function toggleMilestone(m: Milestone) {
    if (!project) return;
    const milestones = project.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x));
    await patch({ milestones });
  }

  async function removeMilestone(mid: string) {
    if (!project) return;
    await patch({ milestones: project.milestones.filter((m) => m.id !== mid) });
  }

  async function addLink() {
    if (!newLinkLabel.trim() || !newLinkUrl.trim() || !project) return;
    const link: LinkRef = { id: newId(), label: newLinkLabel.trim(), url: newLinkUrl.trim() };
    await patch({ links: [...(project.links || []), link] });
    setNewLinkLabel("");
    setNewLinkUrl("");
  }

  async function removeLink(lid: string) {
    if (!project) return;
    await patch({ links: project.links.filter((l) => l.id !== lid) });
  }

  async function deleteProject() {
    if (!project || !confirm(`Delete "${project.name}"? It'll move to Trash and can be restored for 30 days.`)) return;
    await api.projects.remove(id);
    navigate("/projects");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <Link to="/projects" className="mb-4 flex items-center gap-1.5 text-sm text-dusk hover:text-ink-soft">
        <ArrowLeft size={14} /> All projects
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div className="flex-1">
          <input
            defaultValue={project.name}
            onBlur={(e) => patch({ name: e.target.value })}
            className="w-full bg-transparent font-display text-2xl font-medium text-ink outline-none"
          />
          <textarea
            defaultValue={project.description}
            onBlur={(e) => patch({ description: e.target.value })}
            placeholder="What's this project about?"
            rows={2}
            className="mt-1.5 w-full resize-none bg-transparent text-sm text-dusk outline-none"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={project.status}
            onChange={(e) => patch({ status: e.target.value as ProjectStatus })}
            className="rounded-md border border-dusk-light px-2 py-1.5 text-xs capitalize text-ink-soft"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button onClick={deleteProject} className="rounded-md p-2 text-dusk hover:bg-ember-light hover:text-ember">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <Card className="mb-5 p-4">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-ink-soft">Progress</span>
          <span className="font-mono text-xs text-dusk">
            {derivedProgress}% · {completedTasks.length}/{tasks.length} tasks
          </span>
        </div>
        <ProgressBar value={derivedProgress} />
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="md:col-span-2 space-y-5">
          {/* Goals */}
          <Card className="p-5">
            <h2 className="mb-2 font-display text-base text-ink">Goals</h2>
            <textarea
              defaultValue={project.goals}
              onBlur={(e) => patch({ goals: e.target.value })}
              placeholder="What does success look like for this project?"
              rows={3}
              className="w-full resize-none rounded-md border border-dusk-light p-2.5 text-sm outline-none focus:border-moss"
            />
          </Card>

          {/* Tasks */}
          <Card className="p-5">
            <h2 className="mb-1 font-display text-base text-ink">Tasks</h2>
            <p className="mb-3 text-xs text-dusk">
              Project tasks live here and stay out of your Daily Planner by default. Use{" "}
              <EyeOff size={11} className="inline align-text-bottom" /> to show a task in today's planner, or{" "}
              <CalendarPlus size={11} className="inline align-text-bottom" /> to pick a specific day.
            </p>
            <div className="mb-3 flex gap-2">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="Add a task…"
                className="flex-1 rounded-md border border-dusk-light px-3 py-1.5 text-sm outline-none focus:border-moss"
              />
              <button onClick={addTask} className="rounded-md bg-moss px-3 text-paper hover:bg-moss/90">
                <Plus size={15} />
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-xs text-dusk">No tasks linked yet.</p>
            ) : (
              <ul className="space-y-1">
                {tasks.map((t) => (
                  <li key={t.id} className="group rounded-md px-2 py-1.5 hover:bg-fog">
                    <div className="flex items-center gap-2.5 text-sm">
                      <button onClick={() => toggleTask(t)} className="shrink-0">
                        {t.done ? <CheckCircle2 size={16} className="text-moss" /> : <Circle size={16} className="text-dusk-light" />}
                      </button>
                      <span className={`flex-1 ${t.done ? "text-dusk line-through" : "text-ink-soft"}`}>{t.title}</span>
                      {t.date && (
                        <span className="shrink-0 text-[11px] text-dusk">{t.date}</span>
                      )}
                      <button
                        onClick={() => (t.date ? unscheduleTask(t) : scheduleTask(t, todayISO()))}
                        title={t.date ? `Visible in Daily Planner on ${t.date}. Click to hide it.` : "Hidden from Daily Planner. Click to show it today."}
                        className={`shrink-0 rounded-full p-1 ${
                          t.date ? "text-moss" : "text-dusk opacity-0 hover:text-moss group-hover:opacity-100"
                        }`}
                      >
                        {t.date ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        onClick={() => setSchedulingTaskId(schedulingTaskId === t.id ? null : t.id)}
                        title="Pick a specific day to show this task in the planner"
                        className="shrink-0 text-dusk opacity-0 hover:text-moss group-hover:opacity-100"
                      >
                        <CalendarPlus size={14} />
                      </button>
                      <button onClick={() => removeTask(t)} className="shrink-0 text-dusk opacity-0 hover:text-ember group-hover:opacity-100">
                        <X size={13} />
                      </button>
                    </div>
                    {schedulingTaskId === t.id && !t.date && (
                      <div className="ml-7 mt-1.5 flex items-center gap-2">
                        <input
                          type="date"
                          autoFocus
                          onChange={(e) => {
                            if (e.target.value) {
                              scheduleTask(t, e.target.value);
                              setSchedulingTaskId(null);
                            }
                          }}
                          className="rounded-md border border-dusk-light px-2 py-1 text-xs text-ink-soft"
                        />
                        <span className="text-[11px] text-dusk">Pick a day to show this task in the planner</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Notes */}
          <Card className="p-5">
            <h2 className="mb-2 font-display text-base text-ink">Notes</h2>
            <textarea
              defaultValue={project.notes}
              onBlur={(e) => patch({ notes: e.target.value })}
              placeholder="Freeform notes about this project…"
              rows={5}
              className="w-full resize-none rounded-md border border-dusk-light p-2.5 text-sm outline-none focus:border-moss"
            />
          </Card>
        </div>

        <div className="space-y-5">
          {/* Due date */}
          <Card className="p-5">
            <h2 className="mb-2 font-display text-base text-ink">Due date</h2>
            <input
              type="date"
              defaultValue={project.dueDate}
              onBlur={(e) => patch({ dueDate: e.target.value })}
              className="w-full rounded-md border border-dusk-light px-2.5 py-1.5 text-sm text-ink-soft"
            />
          </Card>

          {/* Milestones */}
          <Card className="p-5">
            <h2 className="mb-3 font-display text-base text-ink">Milestones</h2>
            <div className="mb-2 flex gap-1.5">
              <input
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMilestone()}
                placeholder="Add milestone…"
                className="flex-1 rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
              />
              <button onClick={addMilestone} className="rounded-md bg-moss px-2 text-paper hover:bg-moss/90">
                <Plus size={13} />
              </button>
            </div>
            <ul className="space-y-1">
              {project.milestones?.map((m) => (
                <li key={m.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-fog">
                  <button onClick={() => toggleMilestone(m)}>
                    {m.done ? <CheckCircle2 size={14} className="text-moss" /> : <Circle size={14} className="text-dusk-light" />}
                  </button>
                  <span className={`flex-1 text-xs ${m.done ? "text-dusk line-through" : "text-ink-soft"}`}>{m.title}</span>
                  <button onClick={() => removeMilestone(m.id)} className="text-dusk opacity-0 hover:text-ember group-hover:opacity-100">
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Links */}
          <Card className="p-5">
            <h2 className="mb-3 font-display text-base text-ink">Important links</h2>
            <div className="mb-2 space-y-1.5">
              <input
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                placeholder="Label"
                className="w-full rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
              />
              <div className="flex gap-1.5">
                <input
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLink()}
                  placeholder="https://…"
                  className="flex-1 rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
                />
                <button onClick={addLink} className="rounded-md bg-moss px-2 text-paper hover:bg-moss/90">
                  <Plus size={13} />
                </button>
              </div>
            </div>
            <ul className="space-y-1">
              {project.links?.map((l) => (
                <li key={l.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-fog">
                  <ExternalLink size={12} className="text-dusk" />
                  <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-moss hover:underline">
                    {l.label}
                  </a>
                  <button onClick={() => removeLink(l.id)} className="text-dusk opacity-0 hover:text-ember group-hover:opacity-100">
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Resources */}
          <Card className="p-5">
            <h2 className="mb-2 font-display text-base text-ink">Resources</h2>
            <textarea
              defaultValue={project.resources}
              onBlur={(e) => patch({ resources: e.target.value })}
              placeholder="Tools, references, budget, people involved…"
              rows={3}
              className="w-full resize-none rounded-md border border-dusk-light p-2.5 text-xs outline-none focus:border-moss"
            />
          </Card>

          {/* Related documents */}
          {docs.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-2 font-display text-base text-ink">Related documents</h2>
              <ul className="space-y-1.5">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-xs text-ink-soft">
                    <FileText size={12} className="text-dusk" />
                    <Link to="/documents" className="hover:text-moss hover:underline">
                      {d.title}
                    </Link>
                    <Pill tone="neutral">{d.category}</Pill>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
