import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Play, Pause, RotateCcw, SkipForward, Timer as TimerIcon } from "lucide-react";
import { api } from "../lib/api";
import type { Task } from "../types";
import { Card, PageHeader, EmptyState } from "../components/ui";

type Phase = "work" | "break";

const PRESETS = [
  { label: "25 / 5", work: 25, breakLen: 5 },
  { label: "50 / 10", work: 50, breakLen: 10 },
  { label: "15 / 3", work: 15, breakLen: 3 },
];

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.9);
  } catch {
    // Web Audio unavailable — silently skip the chime.
  }
}

function notify(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

export default function Focus() {
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskId, setTaskId] = useState<string | null>(searchParams.get("task"));
  const [preset, setPreset] = useState(PRESETS[0]);
  const [showCustom, setShowCustom] = useState(false);
  const [customWork, setCustomWork] = useState(20);
  const [customBreak, setCustomBreak] = useState(5);
  const [phase, setPhase] = useState<Phase>("work");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(PRESETS[0].work * 60);
  const [completedSessions, setCompletedSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.tasks.list().then((all) => setTasks(all.filter((t) => !t.done)));
  }, []);

  useEffect(() => {
    setRemaining(preset.work * 60);
    setPhase("work");
    setRunning(false);
  }, [preset]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          handlePhaseComplete();
          return r;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function handlePhaseComplete() {
    playChime();
    if (phase === "work") {
      setCompletedSessions((c) => c + 1);
      notify("Focus session complete", "Time for a short break.");
      setPhase("break");
      setRemaining(preset.breakLen * 60);
    } else {
      notify("Break's over", "Ready for another focus session?");
      setPhase("work");
      setRemaining(preset.work * 60);
      setRunning(false);
    }
  }

  function reset() {
    setRunning(false);
    setPhase("work");
    setRemaining(preset.work * 60);
  }

  function skip() {
    setRunning(false);
    if (phase === "work") {
      setPhase("break");
      setRemaining(preset.breakLen * 60);
    } else {
      setPhase("work");
      setRemaining(preset.work * 60);
    }
  }

  function applyCustomPreset() {
    const work = Math.min(180, Math.max(1, Math.round(customWork) || 1));
    const breakLen = Math.min(60, Math.max(1, Math.round(customBreak) || 1));
    setCustomWork(work);
    setCustomBreak(breakLen);
    setPreset({ label: `${work} / ${breakLen}`, work, breakLen });
    setShowCustom(false);
  }

  const totalSeconds = (phase === "work" ? preset.work : preset.breakLen) * 60;
  const progress = 1 - remaining / totalSeconds;
  const selectedTask = tasks.find((t) => t.id === taskId) || null;

  const size = 260;
  const r = size / 2 - 16;
  const center = size / 2;
  const circumference = 2 * Math.PI * r;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const requestPermission = () => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <PageHeader title="Focus" subtitle="Pick a task, start a session, and let the ring keep time." />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setPreset(p);
              setShowCustom(false);
            }}
            className={`rounded-full border px-3 py-1 text-xs ${
              preset.label === p.label && !showCustom
                ? "border-moss bg-moss-light text-moss"
                : "border-dusk-light text-dusk"
            }`}
          >
            {p.label} min
          </button>
        ))}
        <button
          onClick={() => setShowCustom((s) => !s)}
          className={`rounded-full border px-3 py-1 text-xs ${
            showCustom || !PRESETS.some((p) => p.label === preset.label)
              ? "border-moss bg-moss-light text-moss"
              : "border-dusk-light text-dusk"
          }`}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-dusk">Focus (minutes)</label>
            <input
              type="number"
              min={1}
              max={180}
              value={customWork}
              onChange={(e) => setCustomWork(Number(e.target.value))}
              className="w-24 rounded-md border border-dusk-light px-2.5 py-1.5 text-sm text-ink-soft"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-dusk">Break (minutes)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={customBreak}
              onChange={(e) => setCustomBreak(Number(e.target.value))}
              className="w-24 rounded-md border border-dusk-light px-2.5 py-1.5 text-sm text-ink-soft"
            />
          </div>
          <button
            onClick={applyCustomPreset}
            className="rounded-md bg-moss px-3.5 py-2 text-sm font-medium text-paper hover:bg-moss/90"
          >
            Use this session
          </button>
        </Card>
      )}

      <Card className="mb-5 p-6">
        <label className="mb-2 block text-xs font-medium text-dusk">Focusing on</label>
        {tasks.length === 0 ? (
          <EmptyState
            icon={<TimerIcon size={18} />}
            title="No open tasks"
            hint="Add tasks in the Daily Planner, then come back here to focus on one."
          />
        ) : (
          <select
            value={taskId || ""}
            onChange={(e) => setTaskId(e.target.value || null)}
            className="w-full rounded-md border border-dusk-light px-3 py-2 text-sm text-ink-soft"
          >
            <option value="">(No specific task — just a general session)</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}
      </Card>

      <Card className="flex flex-col items-center p-8">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size}>
            <circle cx={center} cy={center} r={r} fill="none" stroke="var(--color-dusk-light)" strokeWidth={10} />
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={phase === "work" ? "var(--color-moss)" : "var(--color-signal)"}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              transform={`rotate(-90 ${center} ${center})`}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-4xl tabular-nums text-ink">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
            <span className="mt-1 text-xs uppercase tracking-wide text-dusk">
              {phase === "work" ? "Focus" : "Break"}
            </span>
            {selectedTask && (
              <span className="mt-2 max-w-[180px] truncate text-center text-xs text-ink-soft">
                {selectedTask.title}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={reset}
            title="Reset"
            className="rounded-full border border-dusk-light p-2.5 text-ink-soft hover:bg-fog"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={() => {
              requestPermission();
              setRunning((r) => !r);
            }}
            className="rounded-full bg-moss p-4 text-paper hover:bg-moss/90"
          >
            {running ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={skip}
            title="Skip to next phase"
            className="rounded-full border border-dusk-light p-2.5 text-ink-soft hover:bg-fog"
          >
            <SkipForward size={16} />
          </button>
        </div>

        <p className="mt-5 text-xs text-dusk">
          {completedSessions} focus session{completedSessions === 1 ? "" : "s"} completed this visit
        </p>
      </Card>
    </div>
  );
}
