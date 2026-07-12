import { NavLink } from "react-router-dom";
import ProfileSwitcher from "./ProfileSwitcher";
import {
  LayoutDashboard,
  Inbox as InboxIcon,
  CalendarDays,
  ListChecks,
  FolderKanban,
  FileText,
  BrainCircuit,
  BarChart3,
  CalendarClock,
  Sparkles,
  Tags as TagsIcon,
  Timer,
  Trash2,
  Settings as SettingsIcon,
  Plus,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/inbox", label: "Inbox", icon: InboxIcon },
  { to: "/planner", label: "Daily Planner", icon: ListChecks },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/knowledge", label: "Knowledge Base", icon: BrainCircuit },
  { to: "/tags", label: "Tags", icon: TagsIcon },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/weekly-review", label: "Weekly Review", icon: CalendarClock },
  { to: "/focus", label: "Focus", icon: Timer },
  { to: "/support", label: "Support", icon: Sparkles },
];

interface Props {
  onCapture: () => void;
  inboxCount: number;
}

export default function Sidebar({ onCapture, inboxCount }: Props) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-y-hidden border-r border-dusk-light bg-paper">
      <div className="px-5 pb-4 pt-6">
        <div className="font-display text-[19px] font-medium tracking-tight text-ink">
          Life OS
        </div>
      </div>

      <ProfileSwitcher />

      <button
        onClick={onCapture}
        className="mx-4 mb-4 flex items-center justify-center gap-2 rounded-lg border border-moss/30 bg-moss-light py-2 text-sm font-medium text-moss transition hover:bg-moss/15"
      >
        <Plus size={15} />
        Capture
        <span className="ml-1 rounded border border-moss/25 px-1 font-mono text-[10px] text-moss/80">
          ⌘K
        </span>
      </button>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-moss-light font-medium text-moss"
                  : "text-ink-soft hover:bg-fog"
              }`
            }
          >
            <span className="flex items-center gap-2.5">
              <Icon size={16} strokeWidth={2} />
              {label}
            </span>
            {label === "Inbox" && inboxCount > 0 && (
              <span className="rounded-full bg-ember px-1.5 py-0.5 text-[10px] font-semibold leading-none text-paper">
                {inboxCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-dusk-light px-3 pb-5 pt-2">
        <NavLink
          to="/trash"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
              isActive ? "bg-fog font-medium text-ink" : "text-dusk hover:bg-fog"
            }`
          }
        >
          <Trash2 size={16} />
          Trash
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
              isActive ? "bg-fog font-medium text-ink" : "text-dusk hover:bg-fog"
            }`
          }
        >
          <SettingsIcon size={16} />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}
