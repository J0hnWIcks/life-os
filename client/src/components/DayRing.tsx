import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../types";

interface Props {
  tasks: Task[]; // tasks for today that have startTime/endTime
  size?: number;
  onDropTask?: (taskId: string, time: string) => void;
}

const HOUR_MARKS = [0, 3, 6, 9, 12, 15, 18, 21];

function timeToHours(t?: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h + (m || 0) / 60;
}

function labelFor(hour: number): string {
  const h = hour % 24;
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h > 12 ? `${h - 12}p` : `${h}a`;
}

/** Convert a pointer position (relative to the ring's center) into a "HH:MM" time, snapped to 15 min. */
function angleToTime(dx: number, dy: number): string {
  const angleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
  const totalMinutes = Math.round((angleDeg / 360) * 24 * 60);
  const snapped = Math.round(totalMinutes / 15) * 15;
  const h = Math.floor(snapped / 60) % 24;
  const m = snapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function DayRing({ tasks, size = 248, onDropTask }: Props) {
  const [now, setNow] = useState(new Date());
  const [dragOver, setDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const r = size / 2 - 18;
  const center = size / 2;
  const circumference = 2 * Math.PI * r;
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowAngle = (nowHour / 24) * 360 - 90;

  const blocks = useMemo(() => {
    return tasks
      .map((t) => {
        const start = timeToHours(t.startTime);
        let end = timeToHours(t.endTime);
        if (start === null) return null;
        if (end === null || end <= start) end = start + 0.75;
        return { task: t, start, end };
      })
      .filter((b): b is { task: Task; start: number; end: number } => b !== null);
  }, [tasks]);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId || !onDropTask || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    onDropTask(taskId, angleToTime(dx, dy));
  }

  return (
    <div
      ref={containerRef}
      className={`relative shrink-0 rounded-full transition ${dragOver ? "ring-2 ring-moss ring-offset-2 ring-offset-paper" : ""}`}
      style={{ width: size, height: size }}
      onDragOver={(e) => {
        if (!onDropTask) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <svg width={size} height={size} className="-rotate-0">
        {/* track */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--color-dusk-light)"
          strokeWidth={10}
        />

        {/* hour ticks */}
        {HOUR_MARKS.map((h) => {
          const angle = ((h / 24) * 360 - 90) * (Math.PI / 180);
          const x1 = center + (r - 15) * Math.cos(angle);
          const y1 = center + (r - 15) * Math.sin(angle);
          const x2 = center + (r + 15) * Math.cos(angle);
          const y2 = center + (r + 15) * Math.sin(angle);
          const lx = center + (r + 24) * Math.cos(angle);
          const ly = center + (r + 24) * Math.sin(angle);
          return (
            <g key={h}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-dusk-light)" strokeWidth={1} />
              <text
                x={lx}
                y={ly}
                fontSize="9"
                fontFamily="var(--font-mono)"
                fill="var(--color-dusk)"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {labelFor(h)}
              </text>
            </g>
          );
        })}

        {/* task arcs */}
        {blocks.map(({ task, start, end }, i) => {
          const duration = Math.min(end - start, 24);
          const arcLen = (duration / 24) * circumference;
          const rotation = (start / 24) * 360 - 90;
          const color = task.done
            ? "var(--color-moss)"
            : task.priority === "high"
              ? "var(--color-ember)"
              : "var(--color-signal)";
          return (
            <circle
              key={task.id + i}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${arcLen} ${circumference - arcLen}`}
              strokeDashoffset={0}
              opacity={task.done ? 0.55 : 0.95}
              transform={`rotate(${rotation} ${center} ${center})`}
            />
          );
        })}

        {/* now hand */}
        <line
          x1={center}
          y1={center}
          x2={center + (r + 10) * Math.cos(nowAngle * (Math.PI / 180))}
          y2={center + (r + 10) * Math.sin(nowAngle * (Math.PI / 180))}
          stroke="var(--color-ink)"
          strokeWidth={1.5}
        />
        <circle cx={center} cy={center} r={3.5} fill="var(--color-ink)" />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[11px] text-dusk">
          {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
        <span className="font-display text-sm text-ink-soft">
          {onDropTask ? "drop to time-block" : "today"}
        </span>
      </div>
    </div>
  );
}
