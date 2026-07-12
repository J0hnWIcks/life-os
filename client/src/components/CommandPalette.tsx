import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Inbox as InboxIcon,
  LayoutDashboard,
  ListChecks,
  CalendarDays,
  FolderKanban,
  FileText,
  BrainCircuit,
  BarChart3,
  CalendarClock,
  Sparkles,
  Settings as SettingsIcon,
  Trash2,
  Tags as TagsIcon,
  Timer,
  CornerDownLeft,
} from "lucide-react";
import { api } from "../lib/api";
import { fuzzyMatch } from "../lib/fuzzy";
import type { SearchResult, SearchResultType } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCaptured?: () => void;
}

interface NavCommand {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  keywords?: string;
}

const NAV_COMMANDS: NavCommand[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, keywords: "home command center" },
  { label: "Inbox", to: "/inbox", icon: InboxIcon, keywords: "capture" },
  { label: "Daily Planner", to: "/planner", icon: ListChecks, keywords: "tasks today goals" },
  { label: "Calendar", to: "/calendar", icon: CalendarDays, keywords: "events deadlines" },
  { label: "Projects", to: "/projects", icon: FolderKanban },
  { label: "Documents", to: "/documents", icon: FileText, keywords: "files" },
  { label: "Knowledge Base", to: "/knowledge", icon: BrainCircuit, keywords: "notes second brain" },
  { label: "Tags", to: "/tags", icon: TagsIcon, keywords: "browse" },
  { label: "Analytics", to: "/analytics", icon: BarChart3, keywords: "stats" },
  { label: "Weekly Review", to: "/weekly-review", icon: CalendarClock, keywords: "week summary" },
  { label: "Focus mode", to: "/focus", icon: Timer, keywords: "pomodoro timer" },
  { label: "Support", to: "/support", icon: Sparkles, keywords: "ai assistant gemini" },
  { label: "Trash", to: "/trash", icon: Trash2, keywords: "deleted restore" },
  { label: "Settings", to: "/settings", icon: SettingsIcon },
];

const RESULT_ICON: Record<SearchResultType, typeof ListChecks> = {
  task: ListChecks,
  project: FolderKanban,
  document: FileText,
  note: BrainCircuit,
};

type PaletteItem =
  | { kind: "nav"; label: string; to: string; icon: typeof LayoutDashboard }
  | { kind: "result"; result: SearchResult }
  | { kind: "capture"; query: string };

function resultRoute(r: SearchResult): string {
  switch (r.type) {
    case "task":
      return r.projectId ? `/projects/${r.projectId}` : `/planner`;
    case "project":
      return `/projects/${r.id}`;
    case "document":
      return `/documents?doc=${r.id}`;
    case "note":
      return `/knowledge?note=${r.id}`;
  }
}

export default function CommandPalette({ open, onClose, onCaptured }: Props) {
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setValue("");
      setResults([]);
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || value.trim().length < 2) {
      setResults([]);
      return;
    }
    const q = value.trim();
    const timeout = setTimeout(() => {
      api.search(q).then(setResults).catch(() => setResults([]));
    }, 150);
    return () => clearTimeout(timeout);
  }, [value, open]);

  const navMatches = useMemo(
    () => fuzzyMatch(value, NAV_COMMANDS, (c) => `${c.label} ${c.keywords || ""}`),
    [value]
  );

  const items: PaletteItem[] = useMemo(() => {
    const navItems: PaletteItem[] = navMatches
      .slice(0, value.trim() ? 5 : 8)
      .map((c) => ({ kind: "nav", label: c.label, to: c.to, icon: c.icon }));
    const resultItems: PaletteItem[] = results.map((r) => ({ kind: "result", result: r }));
    const captureItem: PaletteItem[] = value.trim() ? [{ kind: "capture", query: value.trim() }] : [];
    return [...navItems, ...resultItems, ...captureItem];
  }, [navMatches, results, value]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length, value]);

  async function activate(item: PaletteItem) {
    if (item.kind === "nav") {
      navigate(item.to);
      onClose();
    } else if (item.kind === "result") {
      navigate(resultRoute(item.result));
      onClose();
    } else {
      setSaving(true);
      try {
        await api.inbox.create({ content: item.query, type: "unsorted", processed: false });
        onCaptured?.();
        onClose();
      } finally {
        setSaving(false);
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      const item = items[selectedIndex];
      if (item) activate(item);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-dusk-light bg-paper shadow-2xl">
        <div className="flex items-center gap-3 border-b border-dusk-light px-4 py-3">
          <InboxIcon size={18} className="shrink-0 text-moss" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Go anywhere, search everything, or capture a thought…"
            className="w-full bg-transparent text-[15px] text-ink placeholder:text-dusk outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto py-1.5">
          {items.length === 0 && (
            <p className="px-4 py-3 text-xs text-dusk">Nothing matches yet — keep typing.</p>
          )}
          {items.map((item, i) => {
            const active = i === selectedIndex;
            if (item.kind === "nav") {
              const Icon = item.icon;
              return (
                <button
                  key={`nav-${item.to}`}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => activate(item)}
                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm ${
                    active ? "bg-moss-light text-moss" : "text-ink-soft"
                  }`}
                >
                  <Icon size={15} />
                  <span className="flex-1">{item.label}</span>
                  {active && <CornerDownLeft size={12} className="text-dusk" />}
                </button>
              );
            }
            if (item.kind === "result") {
              const Icon = RESULT_ICON[item.result.type];
              return (
                <button
                  key={`result-${item.result.type}-${item.result.id}`}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => activate(item)}
                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm ${
                    active ? "bg-moss-light text-moss" : "text-ink-soft"
                  }`}
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="flex-1 truncate">{item.result.title}</span>
                  <span className="shrink-0 text-[11px] capitalize text-dusk">
                    {item.result.subtitle || item.result.type}
                  </span>
                </button>
              );
            }
            return (
              <button
                key="capture"
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => activate(item)}
                disabled={saving}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm ${
                  active ? "bg-moss-light text-moss" : "text-ink-soft"
                }`}
              >
                <InboxIcon size={15} className="shrink-0" />
                <span className="flex-1 truncate">
                  Add "<span className="font-medium">{item.query}</span>" to Inbox
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-dusk-light px-4 py-2 text-[11px] text-dusk">
          <span>↑↓ to navigate · Enter to select</span>
          <span className="rounded border border-dusk-light px-1.5 py-0.5 font-mono">esc</span>
        </div>
      </div>
    </div>
  );
}
