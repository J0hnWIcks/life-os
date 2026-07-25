import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FolderKanban } from "lucide-react";
import { api } from "../lib/api";
import type { Project, ProjectStatus } from "../types";
import { Card, PageHeader, ProgressBar, Pill, EmptyState } from "../components/ui";

const STATUS_TONE: Record<ProjectStatus, "moss" | "signal" | "neutral" | "ember"> = {
  active: "moss",
  paused: "signal",
  done: "neutral",
  archived: "neutral",
};

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  function load() {
    api.projects.list().then((all) =>
      setProjects(all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    );
  }
  useEffect(load, []);

  async function createProject() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await api.projects.create({ name: trimmed, status: "active", milestones: [], links: [], progress: 0 });
    setName("");
    setCreating(false);
    load();
  }

  const grouped = {
    active: projects.filter((p) => p.status === "active"),
    paused: projects.filter((p) => p.status === "paused"),
    done: projects.filter((p) => p.status === "done" || p.status === "archived"),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <PageHeader
        title="Projects"
        subtitle="Every project keeps its own goals, tasks, milestones, and notes together."
        action={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-moss px-3.5 py-2 text-sm font-medium text-paper hover:bg-moss/90"
          >
            <Plus size={15} /> New project
          </button>
        }
      />

      {creating && (
        <Card className="mb-6 flex items-center gap-2 p-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createProject()}
            placeholder="Project name…"
            className="flex-1 rounded-md border border-dusk-light px-3 py-1.5 text-sm outline-none focus:border-moss"
          />
          <button onClick={createProject} className="rounded-md bg-moss px-3 py-1.5 text-sm text-paper hover:bg-moss/90">
            Create
          </button>
          <button
            onClick={() => setCreating(false)}
            className="rounded-md px-3 py-1.5 text-sm text-dusk hover:bg-fog"
          >
            Cancel
          </button>
        </Card>
      )}

      {projects.length === 0 && !creating ? (
        <EmptyState
          icon={<FolderKanban size={22} />}
          title="No projects yet"
          hint="Start one to keep its goals, tasks, and files together in a single place."
          action={
            <button onClick={() => setCreating(true)} className="text-xs font-medium text-moss hover:underline">
              Create your first project →
            </button>
          }
        />
      ) : (
        (["active", "paused", "done"] as const).map(
          (group) =>
            grouped[group].length > 0 && (
              <div key={group} className="mb-7">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-dusk">
                  {group === "done" ? "Done & archived" : group}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {grouped[group].map((p) => (
                    <Link key={p.id} to={`/projects/${p.id}`}>
                      <Card className="h-full p-4 transition hover:border-moss/40">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="font-display text-base text-ink">{p.name}</h3>
                          <Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill>
                        </div>
                        {p.description && (
                          <p className="mb-3 line-clamp-2 text-xs text-dusk">{p.description}</p>
                        )}
                        <ProgressBar value={p.progress ?? 0} className="mb-1.5" />
                        <div className="flex items-center justify-between text-[11px] text-dusk">
                          <span>{p.progress ?? 0}% complete</span>
                          {p.dueDate && <span className="font-mono">due {p.dueDate}</span>}
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )
        )
      )}
    </div>
  );
}
