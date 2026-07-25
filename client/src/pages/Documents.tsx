import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  FileText,
  Trash2,
  ExternalLink,
  Paperclip,
  Download,
  Pencil,
  Settings2,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import type { DocumentItem, DocumentCategory } from "../types";
import { Card, PageHeader, Pill, EmptyState } from "../components/ui";

const DEFAULT_CATEGORIES: DocumentCategory[] = [
  "School",
  "Personal",
  "Business",
  "Financial",
  "Medical",
  "Legal",
  "Other",
];

export default function Documents() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("doc");
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | "All">("All");
  const [savedCategories, setSavedCategories] = useState<DocumentCategory[]>(DEFAULT_CATEGORIES);

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>(DEFAULT_CATEGORIES[1]);
  const [tags, setTags] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [managingCategories, setManagingCategories] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<DocumentCategory>(DEFAULT_CATEGORIES[1]);
  const [editTags, setEditTags] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    api.documents.list().then((all) => setDocs(all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))));
  }
  useEffect(load, []);

  useEffect(() => {
    api.settings.get().then((s) => {
      if (s.documentCategories && s.documentCategories.length > 0) {
        setSavedCategories(s.documentCategories);
        setCategory(s.documentCategories[0]);
      }
    });
  }, []);

  // Categories actually shown: the managed list, plus any category still
  // present on an existing document even if it was since removed from the
  // managed list — so deleting a category never hides a document.
  const categories = useMemo(() => {
    const inUse = docs.map((d) => d.category).filter(Boolean);
    return Array.from(new Set([...savedCategories, ...inUse]));
  }, [savedCategories, docs]);

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      const matchesCategory = activeCategory === "All" || d.category === activeCategory;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [docs, query, activeCategory]);

  function openCreate() {
    // Default the new document's category to whatever category is currently
    // being viewed, instead of always falling back to the first category.
    setCategory(activeCategory === "All" ? categories[0] || DEFAULT_CATEGORIES[1] : activeCategory);
    setCreating(true);
  }

  async function createDoc() {
    const t = title.trim();
    if (!t) return;
    const created = await api.documents.create({
      title: t,
      category,
      tags: tags.split(",").map((x) => x.trim()).filter(Boolean),
      url: url.trim() || undefined,
    });
    if (file) {
      await api.documents.upload(created.id, file);
    }
    setTitle("");
    setTags("");
    setUrl("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCreating(false);
    load();
  }

  async function removeDoc(id: string) {
    await api.documents.remove(id);
    if (editingId === id) setEditingId(null);
    load();
  }

  function startEdit(d: DocumentItem) {
    setCreating(false);
    setEditingId(d.id);
    setEditTitle(d.title);
    setEditCategory(d.category);
    setEditTags(d.tags.join(", "));
    setEditUrl(d.url || "");
    setEditFile(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    const t = editTitle.trim();
    if (!t) return;
    await api.documents.update(editingId, {
      title: t,
      category: editCategory,
      tags: editTags.split(",").map((x) => x.trim()).filter(Boolean),
      url: editUrl.trim() || undefined,
    });
    if (editFile) {
      await api.documents.upload(editingId, editFile);
    }
    setEditingId(null);
    load();
  }

  async function addCategory() {
    const c = newCategory.trim();
    if (!c || categories.includes(c)) {
      setNewCategory("");
      return;
    }
    const next = [...savedCategories, c];
    setSavedCategories(next);
    setNewCategory("");
    await api.settings.update({ documentCategories: next });
  }

  async function deleteCategory(c: DocumentCategory) {
    const inUseCount = docs.filter((d) => d.category === c).length;
    const msg =
      inUseCount > 0
        ? `"${c}" is used by ${inUseCount} document${inUseCount === 1 ? "" : "s"}. It'll be removed from the quick filters, but those documents keep their category. Continue?`
        : `Remove the "${c}" category?`;
    if (!window.confirm(msg)) return;
    const next = savedCategories.filter((x) => x !== c);
    setSavedCategories(next);
    if (activeCategory === c) setActiveCategory("All");
    await api.settings.update({ documentCategories: next });
  }

  const counts = categories.reduce<Record<string, number>>((acc, c) => {
    acc[c] = docs.filter((d) => d.category === c).length;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        title="Documents"
        subtitle="An organized shelf for school, personal, business, financial, medical, and legal files."
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-moss px-3.5 py-2 text-sm font-medium text-paper hover:bg-moss/90"
          >
            <Plus size={15} /> Add document
          </button>
        }
      />

      <div className="mb-5 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dusk" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or tag…"
            className="w-full rounded-lg border border-dusk-light bg-paper py-2 pl-9 pr-3 text-sm outline-none focus:border-moss"
          />
        </div>
        <button
          onClick={() => setManagingCategories((m) => !m)}
          title="Manage categories"
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs ${
            managingCategories ? "border-moss bg-moss-light text-moss" : "border-dusk-light text-dusk hover:bg-fog"
          }`}
        >
          <Settings2 size={14} /> Categories
        </button>
      </div>

      {managingCategories && (
        <Card className="mb-5 space-y-2.5 p-4">
          <h3 className="text-xs font-medium text-dusk">Manage categories</h3>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full border border-dusk-light px-2.5 py-1 text-xs text-ink-soft"
              >
                {c}
                <button
                  onClick={() => deleteCategory(c)}
                  title={`Delete ${c}`}
                  className="text-dusk hover:text-ember"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              placeholder="New category name…"
              className="flex-1 rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
            />
            <button
              onClick={addCategory}
              className="rounded-md bg-moss px-3 py-1.5 text-xs font-medium text-paper hover:bg-moss/90"
            >
              Add
            </button>
          </div>
        </Card>
      )}

      <div className="mb-5 flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveCategory("All")}
          className={`rounded-full border px-3 py-1 text-xs ${
            activeCategory === "All" ? "border-moss bg-moss-light text-moss" : "border-dusk-light text-dusk"
          }`}
        >
          All ({docs.length})
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`rounded-full border px-3 py-1 text-xs ${
              activeCategory === c ? "border-moss bg-moss-light text-moss" : "border-dusk-light text-dusk"
            }`}
          >
            {c} ({counts[c] || 0})
          </button>
        ))}
      </div>

      {creating && (
        <Card className="mb-5 space-y-2 p-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title…"
            className="w-full rounded-md border border-dusk-light px-3 py-1.5 text-sm outline-none focus:border-moss"
          />
          <div className="flex gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-dusk-light px-2 py-1.5 text-xs text-ink-soft"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tags, comma, separated"
              className="flex-1 rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
            />
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link to file (Google Drive, GitHub, etc.) — optional"
            className="w-full rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
          />
          <div className="flex items-center gap-2">
            <Paperclip size={13} className="shrink-0 text-dusk" />
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-dusk file:mr-2 file:rounded-md file:border file:border-dusk-light file:bg-fog file:px-2 file:py-1 file:text-xs file:text-ink-soft"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setCreating(false)} className="rounded-md px-3 py-1.5 text-sm text-dusk hover:bg-fog">
              Cancel
            </button>
            <button onClick={createDoc} className="rounded-md bg-moss px-3 py-1.5 text-sm text-paper hover:bg-moss/90">
              Add
            </button>
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={<FileText size={22} />} title="No documents found" hint="Add one, or adjust your filters." />
      ) : (
        <div className="space-y-2">
          {filtered.map((d) =>
            editingId === d.id ? (
              <Card key={d.id} className="space-y-2 border-moss p-4">
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Document title…"
                  className="w-full rounded-md border border-dusk-light px-3 py-1.5 text-sm outline-none focus:border-moss"
                />
                <div className="flex gap-2">
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="rounded-md border border-dusk-light px-2 py-1.5 text-xs text-ink-soft"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="tags, comma, separated"
                    className="flex-1 rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
                  />
                </div>
                <input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="Link to file — optional"
                  className="w-full rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
                />
                <div className="flex items-center gap-2">
                  <Paperclip size={13} className="shrink-0 text-dusk" />
                  <input
                    ref={editFileInputRef}
                    type="file"
                    onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-dusk file:mr-2 file:rounded-md file:border file:border-dusk-light file:bg-fog file:px-2 file:py-1 file:text-xs file:text-ink-soft"
                  />
                  {d.originalName && !editFile && (
                    <span className="shrink-0 text-[11px] text-dusk">replaces "{d.originalName}"</span>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={cancelEdit} className="rounded-md px-3 py-1.5 text-sm text-dusk hover:bg-fog">
                    Cancel
                  </button>
                  <button onClick={saveEdit} className="rounded-md bg-moss px-3 py-1.5 text-sm text-paper hover:bg-moss/90">
                    Save
                  </button>
                </div>
              </Card>
            ) : (
              <Card
                key={d.id}
                className={`flex items-center gap-3 p-3.5 ${
                  d.id === highlightId ? "border-moss ring-1 ring-moss" : ""
                }`}
              >
                <FileText size={16} className="shrink-0 text-dusk" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-soft">{d.title}</span>
                    <Pill tone="neutral">{d.category}</Pill>
                  </div>
                  {d.tags.length > 0 && (
                    <div className="mt-1 flex gap-1.5">
                      {d.tags.map((t) => (
                        <Link key={t} to={`/tags?tag=${encodeURIComponent(t)}`} className="text-[11px] text-dusk hover:text-moss hover:underline">
                          #{t}
                        </Link>
                      ))}
                    </div>
                  )}
                  {d.originalName && (
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-dusk">
                      <Paperclip size={10} />
                      {d.originalName}
                    </div>
                  )}
                </div>
                {d.fileName && (
                  <a
                    href={api.documents.fileUrl(d.id)}
                    target="_blank"
                    rel="noreferrer"
                    title={d.originalName || "Download attachment"}
                    className="text-dusk hover:text-moss"
                  >
                    <Download size={14} />
                  </a>
                )}
                {d.url && (
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-dusk hover:text-moss">
                    <ExternalLink size={14} />
                  </a>
                )}
                <button onClick={() => startEdit(d)} title="Edit" className="text-dusk hover:text-moss">
                  <Pencil size={14} />
                </button>
                <button onClick={() => removeDoc(d.id)} title="Delete" className="text-dusk hover:text-ember">
                  <Trash2 size={14} />
                </button>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
