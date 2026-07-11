import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import CommandPalette from "./CommandPalette";
import TaskNotifier from "./TaskNotifier";
import { api } from "../lib/api";

export default function Layout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [notifyTimeBlocks, setNotifyTimeBlocks] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  const refreshInboxCount = useCallback(() => {
    api.inbox
      .list()
      .then((items) => setInboxCount(items.filter((i) => !i.processed).length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshInboxCount();
    const interval = setInterval(refreshInboxCount, 15000);
    return () => clearInterval(interval);
  }, [refreshInboxCount]);

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
        <Sidebar onCapture={() => setPaletteOpen(true)} inboxCount={inboxCount} />
      </div>

      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <Outlet context={{ refreshInboxCount }} />
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onCaptured={refreshInboxCount}
      />
      <TaskNotifier enabled={notifyTimeBlocks} />
    </div>
  );
}
