import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, BrainCircuit, Trash2, Eye, Pencil } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { api } from "../lib/api";
import type { KnowledgeNote } from "../types";
import { Card, PageHeader, EmptyState } from "../components/ui";

export default function Knowledge() {
  const [searchParams] = useSearchParams();
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("note"));
  const [previewMode, setPreviewMode] = useState(false);

  function load() {
    api.notes.list().then((all) => {
      const sorted = all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setNotes(sorted);
    });
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, query]);

  const selected = notes.find((n) => n.id === selectedId) || filtered[0] || null;

  async function createNote() {
    const created = await api.notes.create({ title: "Untitled note", content: "", tags: [] });
    load();
    setSelectedId(created.id);
    setPreviewMode(false);
  }

  async function patchSelected(patch: Partial<KnowledgeNote>) {
    if (!selected) return;
    const updated = await api.notes.update(selected.id, patch);
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }

  async function removeNote(id: string) {
    await api.notes.remove(id);
    if (selectedId === id) setSelectedId(null);
    load();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <PageHeader
        title="Knowledge Base"
        subtitle="Your searchable second brain — ideas, research, references, learning notes."
        action={
          <button
            onClick={createNote}
            className="flex items-center gap-1.5 rounded-lg bg-moss px-3.5 py-2 text-sm font-medium text-paper hover:bg-moss/90"
          >
            <Plus size={15} /> New note
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dusk" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              className="w-full rounded-lg border border-dusk-light bg-paper py-2 pl-9 pr-3 text-sm outline-none focus:border-moss"
            />
          </div>
          {filtered.length === 0 ? (
            <EmptyState icon={<BrainCircuit size={20} />} title="No notes found" />
          ) : (
            <div className="space-y-1.5">
              {filtered.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setSelectedId(n.id);
                    setPreviewMode(false);
                  }}
                  className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
                    selected?.id === n.id
                      ? "border-moss bg-moss-light"
                      : "border-transparent bg-paper hover:border-dusk-light"
                  }`}
                >
                  <p className="truncate text-sm font-medium text-ink-soft">{n.title || "Untitled note"}</p>
                  <p className="mt-0.5 truncate text-xs text-dusk">{n.content || "Empty note"}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          {selected ? (
            <Card className="p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <input
                  defaultValue={selected.title}
                  onBlur={(e) => patchSelected({ title: e.target.value })}
                  key={selected.id + "-title"}
                  className="flex-1 bg-transparent font-display text-xl text-ink outline-none"
                />
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setPreviewMode((p) => !p)}
                    title={previewMode ? "Edit" : "Preview rendered markdown"}
                    className={`rounded-md p-1.5 ${previewMode ? "bg-moss-light text-moss" : "text-dusk hover:bg-fog"}`}
                  >
                    {previewMode ? <Pencil size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    onClick={() => removeNote(selected.id)}
                    className="rounded-md p-1.5 text-dusk hover:bg-ember-light hover:text-ember"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <input
                defaultValue={selected.tags.join(", ")}
                onBlur={(e) =>
                  patchSelected({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })
                }
                key={selected.id + "-tags"}
                placeholder="tags, comma, separated"
                className="w-full rounded-md border border-dusk-light px-2.5 py-1.5 text-xs text-dusk outline-none focus:border-moss"
              />
              {selected.tags.length > 0 && (
                <div className="mb-3 mt-1.5 flex flex-wrap gap-1.5">
                  {selected.tags.map((t) => (
                    <Link
                      key={t}
                      to={`/tags?tag=${encodeURIComponent(t)}`}
                      className="text-[11px] text-dusk hover:text-moss hover:underline"
                    >
                      #{t}
                    </Link>
                  ))}
                </div>
              )}
              {previewMode ? (
                <div
                  className="prose prose-sm max-w-none rounded-md border border-dusk-light p-3 text-sm leading-relaxed text-ink-soft [&_a]:text-moss [&_code]:rounded [&_code]:bg-fog [&_code]:px-1 [&_h1]:font-display [&_h1]:text-lg [&_h2]:font-display [&_h2]:text-base [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2"
                  style={{ minHeight: 420 }}
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(marked.parse(selected.content || "*Nothing written yet.*", { async: false }) as string),
                  }}
                />
              ) : (
                <textarea
                  defaultValue={selected.content}
                  onBlur={(e) => patchSelected({ content: e.target.value })}
                  key={selected.id + "-content"}
                  placeholder="Write, paste, or think out loud… Markdown supported — try **bold**, `code`, or # headings."
                  rows={18}
                  className="w-full resize-none rounded-md border border-dusk-light p-3 text-sm leading-relaxed text-ink-soft outline-none focus:border-moss"
                />
              )}
            </Card>
          ) : (
            <EmptyState
              icon={<BrainCircuit size={22} />}
              title="Nothing here yet"
              hint="Create a note to start building your second brain."
              action={
                <button onClick={createNote} className="text-xs font-medium text-moss hover:underline">
                  New note →
                </button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
