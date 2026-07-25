import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import CommandPalette from "./CommandPalette";
import TaskNotifier from "./TaskNotifier";
import Tutorial, { TUTORIAL_STORAGE_KEY } from "./Tutorial";
import { api, todayISO } from "../lib/api";

export default function Layout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [emailCount, setEmailCount] = useState(0);
  const [notifyTimeBlocks, setNotifyTimeBlocks] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const location = useLocation();

  const openTutorial = useCallback(() => setTutorialOpen(true), []);
  const closeTutorial = useCallback(() => {
    setTutorialOpen(false);
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
    } catch {
      // localStorage unavailable (e.g. private browsing) — tutorial will just show again next time
    }
  }, []);

  useEffect(() => {
    try {
      if (!localStorage.getItem(TUTORIAL_STORAGE_KEY)) {
        const timer = setTimeout(() => setTutorialOpen(true), 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore — if storage isn't readable, just skip the auto-launch
    }
  }, []);

  const refreshInboxCount = useCallback(() => {
    api.inbox
      .list()
      .then((items) => setInboxCount(items.filter((i) => !i.processed).length))
      .catch(() => {});
  }, []);

  const refreshEmailCount = useCallback(() => {
    api.emails
      .list()
      .then((items) => {
        const today = todayISO();
        const needsAttention = items.filter((e) => {
          if (e.archived) return false;
          if (e.priority === "high") return true;
          if (e.deadline) {
            const days = Math.round(
              (new Date(e.deadline + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
                (24 * 60 * 60 * 1000)
            );
            if (days <= 3) return true;
          }
          return false;
        });
        setEmailCount(needsAttention.length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshInboxCount();
    refreshEmailCount();
    const interval = setInterval(() => {
      refreshInboxCount();
      refreshEmailCount();
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshInboxCount, refreshEmailCount]);

  useEffect(() => {
    api.settings.get().then((s) => {
      document.documentElement.dataset.theme = s.theme || "meadow";
      setNotifyTimeBlocks(!!s.notifyTimeBlocks);
    });
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-fog text-ink">
      {/* Mobile top bar */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="fixed left-3 top-3 z-30 rounded-md border border-dusk-light bg-paper p-2 shadow-sm md:hidden"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 md:static md:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          onCapture={() => setPaletteOpen(true)}
          onOpenTutorial={openTutorial}
          inboxCount={inboxCount}
          emailCount={emailCount}
        />
      </div>

      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <Outlet context={{ refreshInboxCount, refreshEmailCount, openTutorial }} />
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onCaptured={refreshInboxCount}
      />
      <TaskNotifier enabled={notifyTimeBlocks} />
      <Tutorial open={tutorialOpen} onClose={closeTutorial} />
    </div>
  );
}
