import { useEffect, useState } from "react";
import {
  Trash2,
  RotateCcw,
  X,
  ListChecks,
  FolderKanban,
  FileText,
  BrainCircuit,
  CalendarDays,
  Inbox as InboxIcon,
} from "lucide-react";
import { api } from "../lib/api";
import type { TrashItem, TrashCollection } from "../types";
import { Card, PageHeader, EmptyState, Pill } from "../components/ui";

const COLLECTION_ICON: Record<TrashCollection, typeof ListChecks> = {
  tasks: ListChecks,
  projects: FolderKanban,
  documents: FileText,
  notes: BrainCircuit,
  events: CalendarDays,
  inbox: InboxIcon,
};

const COLLECTION_LABEL: Record<TrashCollection, string> = {
  tasks: "Task",
  projects: "Project",
  documents: "Document",
  notes: "Note",
  events: "Event",
  inbox: "Inbox item",
};

function daysLeft(deletedAt: string): number {
  const deleted = new Date(deletedAt).getTime();
  const expires = deleted + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expires - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default function Trash() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    api.trash.list().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }
  useEffect(load, []);

  async function restore(item: TrashItem) {
    await api.trash.restore(item.collection, item.id);
    load();
  }

  async function purge(item: TrashItem) {
    await api.trash.purge(item.collection, item.id);
    load();
  }

  async function emptyTrash() {
    if (!confirm(`Permanently delete all ${items.length} item(s) in Trash? This can't be undone.`)) return;
    await api.trash.empty();
    load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <PageHeader
        title="Trash"
        subtitle="Deleted items stay here for 30 days before being permanently removed."
        action={
          items.length > 0 && (
            <button
              onClick={emptyTrash}
              className="flex items-center gap-1.5 rounded-lg border border-ember/30 px-3.5 py-2 text-sm font-medium text-ember hover:bg-ember-light"
            >
              <Trash2 size={14} /> Empty trash
            </button>
          )
        }
      />

      {loading ? (
        <p className="text-sm text-dusk">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState icon={<Trash2 size={22} />} title="Trash is empty" hint="Anything you delete will show up here first." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = COLLECTION_ICON[item.collection];
            const left = daysLeft(item.deletedAt);
            return (
              <Card key={`${item.collection}-${item.id}`} className="flex items-center gap-3 p-3.5">
                <Icon size={16} className="shrink-0 text-dusk" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-soft">{item.label}</span>
                    <Pill tone="neutral">{COLLECTION_LABEL[item.collection]}</Pill>
                  </div>
                  <p className="mt-0.5 text-[11px] text-dusk">
                    {left === 0 ? "Expires today" : `${left} day${left === 1 ? "" : "s"} left`}
                  </p>
                </div>
                <button
                  onClick={() => restore(item)}
                  title="Restore"
                  className="flex items-center gap-1 rounded-md border border-dusk-light px-2.5 py-1 text-xs text-ink-soft hover:border-moss/40 hover:bg-moss-light hover:text-moss"
                >
                  <RotateCcw size={12} /> Restore
                </button>
                <button
                  onClick={() => purge(item)}
                  title="Delete permanently"
                  className="text-dusk hover:text-ember"
                >
                  <X size={15} />
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
