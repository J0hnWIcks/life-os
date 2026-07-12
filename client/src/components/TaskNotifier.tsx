import { useEffect, useRef } from "react";
import { api, todayISO } from "../lib/api";

const POLL_MS = 20_000;

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TaskNotifier({ enabled }: { enabled: boolean }) {
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    async function check() {
      try {
        const tasks = await api.tasks.list();
        const current = nowHHMM();
        const today = todayISO();
        tasks
          .filter((t) => t.date === today && t.startTime && !t.done)
          .forEach((t) => {
            if (t.startTime === current && !notifiedRef.current.has(t.id)) {
              notifiedRef.current.add(t.id);
              new Notification(`Time to: ${t.title}`, {
                body: t.endTime ? `${t.startTime}–${t.endTime}` : t.startTime,
                tag: t.id,
                silent: false,
              });
            }
          });
      } catch {
        // silently skip a poll if the API is briefly unreachable
      }
    }

    check();
    const interval = setInterval(check, POLL_MS);
    return () => clearInterval(interval);
  }, [enabled]);

  return null;
}
