import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  ListChecks,
  BrainCircuit,
  FolderKanban,
  FileText,
  CalendarDays,
  Trash2,
  Inbox as InboxIcon,
} from "lucide-react";
import { api, todayISO } from "../lib/api";
import type { InboxItem } from "../types";
import { PageHeader, EmptyState, Card } from "../components/ui";

type OutletCtx = { refreshInboxCount: () => void };

export default function Inbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [text, setText] = useState("");
  const { refreshInboxCount } = useOutletContext<OutletCtx>();

  function load() {
    api.inbox.list().then((all) =>
      setItems(all.filter((i) => !i.processed).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    );
  }

  useEffect(load, []);

  async function addQuick() {
    const content = text.trim();
    if (!content) return;
    await api.inbox.create({ content, type: "unsorted", processed: false });
    setText("");
    load();
    refreshInboxCount();
  }

  async function discard(item: InboxItem) {
    await api.inbox.remove(item.id);
    load();
    refreshInboxCount();
  }

  async function convert(item: InboxItem, kind: "task" | "note" | "project" | "document" | "event") {
    if (kind === "task") {
      await api.tasks.create({ title: item.content, done: false, date: todayISO() });
    } else if (kind === "note") {
      await api.notes.create({ title: item.content, content: "", tags: [] });
    } else if (kind === "project") {
      await api.projects.create({
        name: item.content,
        status: "active",
        milestones: [],
        links: [],
        progress: 0,
      });
    } else if (kind === "document") {
      await api.documents.create({ title: item.content, category: "Personal", tags: [] });
    } else if (kind === "event") {
      await api.events.create({ title: item.content, date: todayISO(), type: "event" });
    }
    await api.inbox.remove(item.id);
    load();
    refreshInboxCount();
  }

  const ACTIONS: {
    kind: "task" | "note" | "project" | "document" | "event";
    label: string;
    icon: typeof ListChecks;
  }[] = [
    { kind: "task", label: "Task", icon: ListChecks },
    { kind: "project", label: "Project", icon: FolderKanban },
    { kind: "note", label: "Note", icon: BrainCircuit },
    { kind: "document", label: "Document", icon: FileText },
    { kind: "event", label: "Event", icon: CalendarDays },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <PageHeader
        title="Inbox"
        subtitle="One place to drop anything. Sort it into its home whenever you're ready — never mid-thought."
      />

      <div className="mb-6 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addQuick()}
          placeholder="Capture a task, idea, link, anything…"
          className="flex-1 rounded-lg border border-dusk-light bg-paper px-4 py-2.5 text-sm text-ink outline-none focus:border-moss"
        />
        <button
          onClick={addQuick}
          className="rounded-lg bg-moss px-4 py-2.5 text-sm font-medium text-paper hover:bg-moss/90"
        >
          Add
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<InboxIcon size={22} />}
          title="Inbox zero"
          hint="Anything you capture — here or with ⌘K anywhere in the app — will land here first."
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="p-3.5">
              <p className="mb-2.5 text-sm text-ink-soft">{item.content}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {ACTIONS.map(({ kind, label, icon: Icon }) => (
                  <button
                    key={kind}
                    onClick={() => convert(item, kind)}
                    className="flex items-center gap-1.5 rounded-md border border-dusk-light px-2.5 py-1 text-xs text-ink-soft transition hover:border-moss/40 hover:bg-moss-light hover:text-moss"
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => discard(item)}
                  className="ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-dusk transition hover:bg-ember-light hover:text-ember"
                >
                  <Trash2 size={12} />
                  Discard
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
