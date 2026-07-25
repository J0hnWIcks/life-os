import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import {
  Mail,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Archive,
  ArchiveRestore,
  CalendarDays,
  ListChecks,
  Phone,
  AtSign,
  Building2,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  Circle,
  Link2,
  ExternalLink,
} from "lucide-react";
import { api, todayISO } from "../lib/api";
import type { EmailItem, EmailChecklistItem, EmailLink, Priority } from "../types";
import { Card, PageHeader, Pill, PriorityDot, EmptyState, ProgressBar } from "../components/ui";
import { extractEmailDetails } from "../lib/emailParse";

function newId() {
  return crypto.randomUUID().slice(0, 8);
}

const PRIORITY_TONE: Record<Priority, "neutral" | "moss" | "ember" | "signal"> = {
  low: "neutral",
  medium: "signal",
  high: "ember",
};

type Filter = "all" | "archived";

// Three dots — low / medium / high — let a user jump straight to one
// priority level of open mail at a time, instead of scrolling a wall of
// email. Picking a dot is its own view (independent of the tab pills above
// it); picking it again turns it back off.
const PRIORITY_ORDER: Priority[] = ["low", "medium", "high"];

const PRIORITY_FILTER_LABEL: Record<Priority, string> = {
  low: "Low priority only",
  medium: "Medium priority only",
  high: "High priority only",
};

const PRIORITY_DOT_COLOR: Record<Priority, string> = {
  low: "bg-dusk",
  medium: "bg-signal",
  high: "bg-ember",
};

const PRIORITY_DOT_RING: Record<Priority, string> = {
  low: "ring-dusk/30",
  medium: "ring-signal/40",
  high: "ring-ember/40",
};

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function daysUntil(date: string): number {
  const today = todayISO();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / msPerDay);
}

function deadlineTone(date: string): "neutral" | "moss" | "ember" | "signal" {
  const d = daysUntil(date);
  if (d < 0) return "ember";
  if (d <= 2) return "ember";
  if (d <= 7) return "signal";
  return "neutral";
}

function deadlineLabel(date: string): string {
  const d = daysUntil(date);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d}d`;
}

const emptyForm = () => ({
  subject: "",
  rawContent: "",
  summary: "",
  priority: "medium" as Priority,
  deadline: "",
  deadlineTime: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  contactOrg: "",
  tags: "",
  checklist: [] as EmailChecklistItem[],
  links: [] as EmailLink[],
});

export default function EmailPage() {
  const { refreshEmailCount } = useOutletContext<{ refreshEmailCount?: () => void }>();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("email");

  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(highlightId);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [newChecklistText, setNewChecklistText] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newDetailLinkLabel, setNewDetailLinkLabel] = useState("");
  const [newDetailLinkUrl, setNewDetailLinkUrl] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [extracted, setExtracted] = useState(false);

  function selectPriorityFilter(p: Priority) {
    setPriorityFilter((current) => (current === p ? null : p));
  }

  function selectTab(f: Filter) {
    setPriorityFilter(null);
    setFilter(f);
  }

  function load() {
    api.emails.list().then((all) => setEmails(all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))));
    refreshEmailCount?.();
  }
  useEffect(load, []);

  useEffect(() => {
    if (highlightId) {
      setSelectedId(highlightId);
      setFilter("all");
    }
  }, [highlightId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return emails.filter((e) => {
      if (priorityFilter) {
        // Priority mode is a standalone view: any open (non-archived) mail
        // at that priority level, regardless of which tab was active before.
        if (e.archived) return false;
        if (e.priority !== priorityFilter) return false;
      } else {
        if (filter === "all" && e.archived) return false;
        if (filter === "archived" && !e.archived) return false;
      }
      if (!q) return true;
      return (
        (e.subject || "").toLowerCase().includes(q) ||
        (e.contact?.name || "").toLowerCase().includes(q) ||
        (e.contact?.email || "").toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)) ||
        (e.rawContent || "").toLowerCase().includes(q)
      );
    });
  }, [emails, filter, priorityFilter, query]);

  const selected = emails.find((e) => e.id === selectedId) || null;

  function openCreate() {
    setCreating(true);
    setSelectedId(null);
    setForm(emptyForm());
    setExtracted(false);
  }

  function runExtract() {
    if (!form.rawContent.trim()) return;
    const result = extractEmailDetails(form.rawContent);
    setForm((f) => ({
      ...f,
      priority: result.priority,
      deadline: result.deadline || f.deadline,
      summary: result.summary || f.summary,
      contactName: result.contact.name || f.contactName,
      contactEmail: result.contact.email || f.contactEmail,
      contactPhone: result.contact.phone || f.contactPhone,
      checklist:
        f.checklist.length === 0
          ? result.checklistSuggestions.map((title) => ({ id: newId(), title, done: false }))
          : f.checklist,
    }));
    setExtracted(true);
  }

  function addFormLink() {
    const url = newLinkUrl.trim();
    if (!url) return;
    const label = newLinkLabel.trim() || url.replace(/^https?:\/\//, "");
    setForm((f) => ({ ...f, links: [...f.links, { id: newId(), label, url: normalizeUrl(url) }] }));
    setNewLinkLabel("");
    setNewLinkUrl("");
  }

  function removeFormLink(id: string) {
    setForm((f) => ({ ...f, links: f.links.filter((l) => l.id !== id) }));
  }

  async function saveCreate() {
    const subject = form.subject.trim() || "(no subject)";
    const created = await api.emails.create({
      subject,
      rawContent: form.rawContent,
      summary: form.summary.trim(),
      priority: form.priority,
      deadline: form.deadline || undefined,
      deadlineTime: form.deadlineTime || undefined,
      contact: {
        name: form.contactName.trim() || undefined,
        email: form.contactEmail.trim() || undefined,
        phone: form.contactPhone.trim() || undefined,
        organization: form.contactOrg.trim() || undefined,
      },
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      checklist: form.checklist,
      links: form.links,
    });
    setCreating(false);
    setForm(emptyForm());
    load();
    setSelectedId(created.id);
  }

  async function patchSelected(patch: Partial<EmailItem>) {
    if (!selected) return;
    const updated = await api.emails.update(selected.id, patch);
    setEmails((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    refreshEmailCount?.();
  }

  async function removeEmail(id: string) {
    if (!window.confirm("Move this email to Trash?")) return;
    await api.emails.remove(id);
    if (selectedId === id) setSelectedId(null);
    load();
  }

  async function addChecklistItem() {
    if (!selected) return;
    const title = newChecklistText.trim();
    if (!title) return;
    const next = [...selected.checklist, { id: newId(), title, done: false }];
    setNewChecklistText("");
    await patchSelected({ checklist: next });
  }

  async function toggleChecklistItem(item: EmailChecklistItem) {
    if (!selected) return;
    const next = selected.checklist.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c));
    await patchSelected({ checklist: next });
  }

  async function removeChecklistItem(item: EmailChecklistItem) {
    if (!selected) return;
    const next = selected.checklist.filter((c) => c.id !== item.id);
    await patchSelected({ checklist: next });
  }

  async function addDetailLink() {
    if (!selected) return;
    const url = newDetailLinkUrl.trim();
    if (!url) return;
    const label = newDetailLinkLabel.trim() || url.replace(/^https?:\/\//, "");
    const next = [...(selected.links || []), { id: newId(), label, url: normalizeUrl(url) }];
    setNewDetailLinkLabel("");
    setNewDetailLinkUrl("");
    await patchSelected({ links: next });
  }

  async function removeDetailLink(link: EmailLink) {
    if (!selected) return;
    const next = (selected.links || []).filter((l) => l.id !== link.id);
    await patchSelected({ links: next });
  }

  async function sendToPlanner() {
    if (!selected) return;
    const task = await api.tasks.create({
      title: selected.subject,
      date: selected.deadline || todayISO(),
      priority: selected.priority,
      notes: `From Email: ${selected.summary || selected.subject}`,
    });
    await patchSelected({ taskId: task.id });
  }

  const checklistDone = selected?.checklist.filter((c) => c.done).length || 0;
  const checklistTotal = selected?.checklist.length || 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <PageHeader
        title="Email"
        subtitle="Paste in the emails piling up, and keep just the parts that matter — priority, deadlines, contacts, and what's left to do."
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-moss px-3.5 py-2 text-sm font-medium text-paper hover:bg-moss/90"
          >
            <Plus size={15} /> Paste an email
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Master list */}
        <div className="md:col-span-1">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dusk" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subject, contact, tag…"
              className="w-full rounded-lg border border-dusk-light bg-paper py-2 pl-9 pr-3 text-sm outline-none focus:border-moss"
            />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full border border-dusk-light px-2 py-1">
              {PRIORITY_ORDER.map((p) => {
                const active = priorityFilter === p;
                return (
                  <button
                    key={p}
                    onClick={() => selectPriorityFilter(p)}
                    title={active ? `${PRIORITY_FILTER_LABEL[p]} — click to turn off` : PRIORITY_FILTER_LABEL[p]}
                    aria-label={PRIORITY_FILTER_LABEL[p]}
                    aria-pressed={active}
                    className={`flex h-5 w-5 items-center justify-center rounded-full transition ${
                      active ? `ring-2 ${PRIORITY_DOT_RING[p]}` : "opacity-50 hover:opacity-100"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${PRIORITY_DOT_COLOR[p]}`} />
                  </button>
                );
              })}
            </div>

            <span className="mx-0.5 h-4 w-px shrink-0 bg-dusk-light" aria-hidden="true" />

            <button
              onClick={() => selectTab("all")}
              className={`rounded-full border px-3 py-1 text-xs ${
                filter === "all" && !priorityFilter ? "border-moss bg-moss-light text-moss" : "border-dusk-light text-dusk"
              }`}
            >
              All open
            </button>
            <button
              onClick={() => selectTab("archived")}
              className={`rounded-full border px-3 py-1 text-xs ${
                filter === "archived" && !priorityFilter
                  ? "border-moss bg-moss-light text-moss"
                  : "border-dusk-light text-dusk"
              }`}
            >
              Archived
            </button>
          </div>

          {priorityFilter && (
            <p className="-mt-1.5 mb-3 text-[11px] text-dusk">
              Only {priorityFilter} priority emails are showing. Click the dot again to turn this off.
            </p>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Mail size={20} />}
              title={priorityFilter ? `No ${priorityFilter} priority emails` : "No emails found"}
              hint={
                priorityFilter
                  ? "Click the dot again to turn this filter off and see everything."
                  : "Paste one in to get started."
              }
            />
          ) : (
            <div className="space-y-1.5">
              {filtered.map((e) => {
                const done = e.checklist.filter((c) => c.done).length;
                return (
                  <button
                    key={e.id}
                    onClick={() => {
                      setSelectedId(e.id);
                      setCreating(false);
                      setShowOriginal(false);
                    }}
                    className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
                      selectedId === e.id ? "border-moss bg-moss-light" : "border-dusk-light bg-paper hover:bg-fog"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <PriorityDot priority={e.priority} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-soft">{e.subject}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {e.deadline && (
                        <Pill tone={deadlineTone(e.deadline)}>{deadlineLabel(e.deadline)}</Pill>
                      )}
                      {e.contact?.name && <Pill tone="neutral">{e.contact.name}</Pill>}
                      {e.checklist.length > 0 && (
                        <span className="text-[11px] text-dusk">
                          {done}/{e.checklist.length} done
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail / compose panel */}
        <div className="md:col-span-2">
          {creating ? (
            <Card className="space-y-3 p-5">
              <h2 className="font-display text-lg text-ink">Paste an email</h2>
              <input
                autoFocus
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Subject…"
                className="w-full rounded-md border border-dusk-light px-3 py-2 text-sm outline-none focus:border-moss"
              />
              <textarea
                value={form.rawContent}
                onChange={(e) => {
                  setForm((f) => ({ ...f, rawContent: e.target.value }));
                  setExtracted(false);
                }}
                placeholder="Paste the full email content here…"
                rows={7}
                className="w-full rounded-md border border-dusk-light px-3 py-2 text-sm outline-none focus:border-moss"
              />
              <button
                onClick={runExtract}
                disabled={!form.rawContent.trim()}
                className="flex items-center gap-1.5 rounded-md border border-moss/30 bg-moss-light px-3 py-1.5 text-xs font-medium text-moss hover:bg-moss/15 disabled:opacity-40"
              >
                <Sparkles size={13} /> Extract details
              </button>

              {extracted && (
                <p className="text-[11px] text-dusk">
                  Pulled a best guess for priority, deadline, contact, and checklist below — check them over and adjust anything before saving.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="text-xs text-dusk">
                  Priority
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}
                    className="mt-1 w-full rounded-md border border-dusk-light px-2 py-1.5 text-sm text-ink-soft"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-dusk">
                    Deadline
                    <input
                      type="date"
                      value={form.deadline}
                      onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-dusk-light px-2 py-1.5 text-sm text-ink-soft"
                    />
                  </label>
                  <label className="text-xs text-dusk">
                    Time
                    <input
                      type="time"
                      value={form.deadlineTime}
                      onChange={(e) => setForm((f) => ({ ...f, deadlineTime: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-dusk-light px-2 py-1.5 text-sm text-ink-soft"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  placeholder="Contact name"
                  className="rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
                />
                <input
                  value={form.contactOrg}
                  onChange={(e) => setForm((f) => ({ ...f, contactOrg: e.target.value }))}
                  placeholder="Organization / dept — optional"
                  className="rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
                />
                <input
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  placeholder="Contact email"
                  className="rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
                />
                <input
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  placeholder="Contact phone"
                  className="rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
                />
              </div>

              <textarea
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="Short summary — what is this actually about?"
                rows={2}
                className="w-full rounded-md border border-dusk-light px-3 py-2 text-sm outline-none focus:border-moss"
              />

              <input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="tags, comma, separated"
                className="w-full rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
              />

              <div className="space-y-1.5 rounded-md border border-dusk-light p-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-dusk">
                  <Link2 size={12} /> Quick links
                </p>
                {form.links.length > 0 && (
                  <div className="space-y-1">
                    {form.links.map((l) => (
                      <div key={l.id} className="flex items-center gap-2 text-sm text-ink-soft">
                        <ExternalLink size={12} className="shrink-0 text-dusk" />
                        <span className="flex-1 truncate">{l.label}</span>
                        <button
                          onClick={() => removeFormLink(l.id)}
                          className="text-dusk hover:text-ember"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                    placeholder="Label (optional)"
                    className="w-28 rounded-md border border-dusk-light px-2 py-1.5 text-xs outline-none focus:border-moss"
                  />
                  <input
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFormLink())}
                    placeholder="Paste a URL — portal, tracker, doc…"
                    className="flex-1 rounded-md border border-dusk-light px-2 py-1.5 text-xs outline-none focus:border-moss"
                  />
                  <button
                    onClick={addFormLink}
                    className="shrink-0 rounded-md bg-moss px-2.5 py-1.5 text-xs font-medium text-paper hover:bg-moss/90"
                  >
                    Add
                  </button>
                </div>
                <p className="text-[11px] text-dusk">Save quick jump-back links for this email — a portal, tracking page, or shared doc.</p>
              </div>

              {form.checklist.length > 0 && (
                <div className="space-y-1 rounded-md border border-dusk-light p-2.5">
                  <p className="mb-1 text-[11px] font-medium text-dusk">To-do items</p>
                  {form.checklist.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm text-ink-soft">
                      <Circle size={13} className="shrink-0 text-dusk-light" />
                      <span className="flex-1">{c.title}</span>
                      <button
                        onClick={() => setForm((f) => ({ ...f, checklist: f.checklist.filter((x) => x.id !== c.id) }))}
                        className="text-dusk hover:text-ember"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setCreating(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-dusk hover:bg-fog"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCreate}
                  disabled={!form.rawContent.trim() && !form.subject.trim()}
                  className="rounded-md bg-moss px-3 py-1.5 text-sm text-paper hover:bg-moss/90 disabled:opacity-40"
                >
                  Save email
                </button>
              </div>
            </Card>
          ) : !selected ? (
            <EmptyState
              icon={<Mail size={22} />}
              title="Select an email, or paste a new one"
              hint="Emails you paste in get organized by priority, deadline, and what still needs doing — nothing here is sent or received."
              action={
                <button onClick={openCreate} className="text-xs font-medium text-moss hover:underline">
                  Paste an email →
                </button>
              }
            />
          ) : (
            <Card className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <input
                    value={selected.subject}
                    onChange={(e) => patchSelected({ subject: e.target.value })}
                    className="w-full truncate bg-transparent font-display text-lg text-ink outline-none focus:border-b focus:border-moss"
                  />
                  {selected.summary && <p className="mt-1 text-sm text-dusk">{selected.summary}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => patchSelected({ archived: !selected.archived })}
                    title={selected.archived ? "Unarchive" : "Archive (mark handled)"}
                    className="rounded-md border border-dusk-light p-1.5 text-dusk hover:border-moss/40 hover:text-moss"
                  >
                    {selected.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  </button>
                  <button
                    onClick={() => removeEmail(selected.id)}
                    title="Delete"
                    className="rounded-md border border-dusk-light p-1.5 text-dusk hover:border-ember/40 hover:text-ember"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-dusk">
                  Priority
                  <select
                    value={selected.priority}
                    onChange={(e) => patchSelected({ priority: e.target.value as Priority })}
                    className="rounded-md border border-dusk-light px-2 py-1 text-xs text-ink-soft"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <Pill tone={PRIORITY_TONE[selected.priority]}>{selected.priority} priority</Pill>
                {selected.archived && <Pill tone="neutral">Archived</Pill>}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 rounded-md border border-dusk-light p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-dusk">
                    <CalendarDays size={12} /> Deadline
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={selected.deadline || ""}
                      onChange={(e) => patchSelected({ deadline: e.target.value || undefined })}
                      className="flex-1 rounded-md border border-dusk-light px-2 py-1 text-xs text-ink-soft"
                    />
                    <input
                      type="time"
                      value={selected.deadlineTime || ""}
                      onChange={(e) => patchSelected({ deadlineTime: e.target.value || undefined })}
                      className="w-24 rounded-md border border-dusk-light px-2 py-1 text-xs text-ink-soft"
                    />
                  </div>
                  {selected.deadline && (
                    <div className="flex items-center justify-between pt-0.5">
                      <Pill tone={deadlineTone(selected.deadline)}>{deadlineLabel(selected.deadline)}</Pill>
                      <Link to="/calendar" className="text-[11px] text-moss hover:underline">
                        View on Calendar →
                      </Link>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 rounded-md border border-dusk-light p-3">
                  <p className="text-[11px] font-medium text-dusk">Contact</p>
                  <input
                    value={selected.contact?.name || ""}
                    onChange={(e) => patchSelected({ contact: { ...selected.contact, name: e.target.value } })}
                    placeholder="Name"
                    className="w-full rounded-md border border-dusk-light px-2 py-1 text-xs text-ink-soft"
                  />
                  <div className="flex items-center gap-1.5">
                    <AtSign size={11} className="shrink-0 text-dusk" />
                    <input
                      value={selected.contact?.email || ""}
                      onChange={(e) => patchSelected({ contact: { ...selected.contact, email: e.target.value } })}
                      placeholder="Email"
                      className="w-full rounded-md border border-dusk-light px-2 py-1 text-xs text-ink-soft"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone size={11} className="shrink-0 text-dusk" />
                    <input
                      value={selected.contact?.phone || ""}
                      onChange={(e) => patchSelected({ contact: { ...selected.contact, phone: e.target.value } })}
                      placeholder="Phone"
                      className="w-full rounded-md border border-dusk-light px-2 py-1 text-xs text-ink-soft"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 size={11} className="shrink-0 text-dusk" />
                    <input
                      value={selected.contact?.organization || ""}
                      onChange={(e) => patchSelected({ contact: { ...selected.contact, organization: e.target.value } })}
                      placeholder="Organization"
                      className="w-full rounded-md border border-dusk-light px-2 py-1 text-xs text-ink-soft"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-dusk-light p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-dusk">
                    <ListChecks size={12} /> Checklist
                  </p>
                  {checklistTotal > 0 && (
                    <span className="text-[11px] text-dusk">
                      {checklistDone}/{checklistTotal}
                    </span>
                  )}
                </div>
                {checklistTotal > 0 && <ProgressBar value={(checklistDone / checklistTotal) * 100} className="mb-2" />}
                <div className="space-y-1">
                  {selected.checklist.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <button onClick={() => toggleChecklistItem(c)} className="shrink-0">
                        {c.done ? (
                          <CheckCircle2 size={15} className="text-moss" />
                        ) : (
                          <Circle size={15} className="text-dusk-light" />
                        )}
                      </button>
                      <span className={`flex-1 text-sm ${c.done ? "text-dusk line-through" : "text-ink-soft"}`}>
                        {c.title}
                      </span>
                      <button onClick={() => removeChecklistItem(c)} className="text-dusk hover:text-ember">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                    placeholder="Add a to-do…"
                    className="flex-1 rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
                  />
                  <button
                    onClick={addChecklistItem}
                    className="rounded-md bg-moss px-2.5 py-1.5 text-xs font-medium text-paper hover:bg-moss/90"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="rounded-md border border-dusk-light p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-dusk">
                  <Link2 size={12} /> Quick links
                </p>
                {(selected.links || []).length > 0 ? (
                  <div className="mb-2 space-y-1">
                    {(selected.links || []).map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center gap-2 rounded-md border border-dusk-light bg-fog/60 px-2 py-1.5"
                      >
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={l.url}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-moss hover:underline"
                        >
                          <ExternalLink size={12} className="shrink-0" />
                          <span className="truncate">{l.label}</span>
                        </a>
                        <button onClick={() => removeDetailLink(l)} className="shrink-0 text-dusk hover:text-ember">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mb-2 text-[11px] text-dusk">
                    No quick links yet — save a portal, tracking page, or shared doc for one-click access.
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    value={newDetailLinkLabel}
                    onChange={(e) => setNewDetailLinkLabel(e.target.value)}
                    placeholder="Label (optional)"
                    className="w-28 rounded-md border border-dusk-light px-2 py-1.5 text-xs outline-none focus:border-moss"
                  />
                  <input
                    value={newDetailLinkUrl}
                    onChange={(e) => setNewDetailLinkUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDetailLink())}
                    placeholder="Paste a URL…"
                    className="flex-1 rounded-md border border-dusk-light px-2 py-1.5 text-xs outline-none focus:border-moss"
                  />
                  <button
                    onClick={addDetailLink}
                    className="shrink-0 rounded-md bg-moss px-2.5 py-1.5 text-xs font-medium text-paper hover:bg-moss/90"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-medium text-dusk">Tags</p>
                <input
                  defaultValue={selected.tags.join(", ")}
                  onBlur={(e) =>
                    patchSelected({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })
                  }
                  placeholder="tags, comma, separated"
                  className="w-full rounded-md border border-dusk-light px-2.5 py-1.5 text-xs outline-none focus:border-moss"
                />
                {selected.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
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
              </div>

              <div className="flex items-center justify-between border-t border-dusk-light pt-3">
                <button
                  onClick={() => setShowOriginal((s) => !s)}
                  className="flex items-center gap-1 text-xs text-dusk hover:text-ink-soft"
                >
                  {showOriginal ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {showOriginal ? "Hide original email" : "Show original email"}
                </button>
                {selected.taskId ? (
                  <Link to="/planner" className="text-xs font-medium text-moss hover:underline">
                    View in Planner →
                  </Link>
                ) : (
                  <button onClick={sendToPlanner} className="text-xs font-medium text-moss hover:underline">
                    Add to Planner
                  </button>
                )}
              </div>

              {showOriginal && (
                <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md bg-fog p-3 text-xs text-ink-soft">
                  {selected.rawContent || "(no content saved)"}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
