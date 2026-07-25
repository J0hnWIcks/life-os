import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, Plus, Pencil, Trash2, Check, X, UserCircle2 } from "lucide-react";
import { api } from "../lib/api";
import type { Profile } from "../types";

export default function ProfileSwitcher() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function load() {
    api.profiles.list().then((data) => {
      setProfiles(data.profiles);
      setActiveId(data.activeId);
    });
  }
  useEffect(load, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setRenamingId(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const active = profiles.find((p) => p.id === activeId);

  async function switchTo(id: string) {
    if (id === activeId || busy) return;
    setBusy(true);
    await api.profiles.activate(id);
    // A full reload is the simplest way to guarantee every page refetches
    // against the newly-active profile's data instead of showing stale state.
    window.location.reload();
  }

  async function createProfile() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    await api.profiles.create(name);
    window.location.reload();
  }

  async function saveRename(id: string) {
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    await api.profiles.rename(id, name);
    setRenamingId(null);
    load();
  }

  async function removeProfile(id: string, name: string) {
    if (profiles.length <= 1) {
      window.alert("You need at least one profile — create another before deleting this one.");
      return;
    }
    const confirmed = window.confirm(`Delete the profile "${name}"? All of its tasks, projects, notes, and events will be permanently deleted. This can't be undone.`);
    if (!confirmed) return;
    setBusy(true);
    await api.profiles.remove(id);
    window.location.reload();
  }

  return (
    <div ref={containerRef} className="relative px-4 pb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-dusk-light bg-paper px-2.5 py-2 text-left text-sm hover:bg-fog"
      >
        <UserCircle2 size={16} className="shrink-0 text-dusk" />
        <span className="flex-1 truncate font-medium text-ink-soft">{active?.name || "Profile"}</span>
        <ChevronsUpDown size={13} className="shrink-0 text-dusk" />
      </button>

      {open && (
        <div className="absolute left-4 right-4 top-full z-20 mt-1 rounded-lg border border-dusk-light bg-paper p-1.5 shadow-lg">
          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {profiles.map((p) => (
              <li key={p.id} className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-fog">
                {renamingId === p.id ? (
                  <>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveRename(p.id)}
                      className="flex-1 rounded border border-moss px-1.5 py-0.5 text-xs outline-none"
                    />
                    <button onClick={() => saveRename(p.id)} className="shrink-0 text-moss">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setRenamingId(null)} className="shrink-0 text-dusk">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => switchTo(p.id)} className="flex flex-1 items-center gap-2 text-left text-sm">
                      {p.id === activeId ? (
                        <Check size={13} className="shrink-0 text-moss" />
                      ) : (
                        <span className="w-[13px] shrink-0" />
                      )}
                      <span className={p.id === activeId ? "font-medium text-ink" : "text-ink-soft"}>{p.name}</span>
                    </button>
                    <button
                      onClick={() => {
                        setRenamingId(p.id);
                        setRenameValue(p.name);
                      }}
                      className="shrink-0 text-dusk opacity-0 hover:text-moss group-hover:opacity-100"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => removeProfile(p.id, p.name)}
                      className="shrink-0 text-dusk opacity-0 hover:text-ember group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-1 border-t border-dusk-light pt-1.5">
            {creating ? (
              <div className="flex items-center gap-1.5 px-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createProfile()}
                  placeholder="Profile name…"
                  className="flex-1 rounded border border-dusk-light px-1.5 py-1 text-xs outline-none focus:border-moss"
                />
                <button onClick={createProfile} className="shrink-0 rounded bg-moss px-1.5 py-1 text-paper">
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-moss hover:bg-moss-light"
              >
                <Plus size={14} /> New profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
