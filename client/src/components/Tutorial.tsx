import { useEffect, useState } from "react";
import {
  Sparkles,
  Inbox as InboxIcon,
  Mail,
  ListChecks,
  FolderKanban,
  SlidersHorizontal,
  ArrowRight,
  ArrowLeft,
  Command,
} from "lucide-react";

export const TUTORIAL_STORAGE_KEY = "life-os-tutorial-completed";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Step {
  icon: typeof Sparkles;
  tone: "moss" | "ember" | "signal";
  eyebrow: string;
  title: string;
  body: string;
  bullets?: string[];
}

const TONE_STYLE: Record<Step["tone"], { badge: string; dot: string; text: string }> = {
  moss: { badge: "bg-moss-light text-moss", dot: "bg-moss", text: "text-moss" },
  ember: { badge: "bg-ember-light text-ember", dot: "bg-ember", text: "text-ember" },
  signal: { badge: "bg-signal-light text-ink-soft", dot: "bg-signal", text: "text-ink-soft" },
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    tone: "moss",
    eyebrow: "Welcome",
    title: "Welcome to Life OS",
    body:
      "A calm home base for everything you're juggling — tasks, email, projects, notes, and your calendar — kept in plain files on your own machine.",
    bullets: [
      "Nothing here is synced anywhere unless you connect it yourself",
      "This quick tour takes about a minute — skip it any time",
    ],
  },
  {
    icon: InboxIcon,
    tone: "signal",
    eyebrow: "Capture",
    title: "Get things out of your head fast",
    body:
      "Press ⌘K (or Ctrl+K) anywhere to open the command bar. Jump to any page, search everything, or capture a stray thought straight into your Inbox to sort out later.",
    bullets: ["⌘K / Ctrl+K opens it from anywhere", "Unsorted thoughts land in Inbox, not lost in a note app"],
  },
  {
    icon: Mail,
    tone: "ember",
    eyebrow: "Email",
    title: "Paste emails in, keep only what matters",
    body:
      "Paste a messy email and Life OS pulls out the priority, deadline, and contact info automatically. Use the priority circle next to Archived to view one priority level at a time, and save Quick Links for one-click access back to a portal or doc.",
  },
  {
    icon: ListChecks,
    tone: "moss",
    eyebrow: "Plan",
    title: "Daily Planner & Calendar",
    body:
      "Lay out today's tasks in the Daily Planner, or see everything — deadlines, events, and time blocks — together on the Calendar.",
  },
  {
    icon: FolderKanban,
    tone: "signal",
    eyebrow: "Organize",
    title: "Projects & Knowledge Base",
    body:
      "Group related tasks into Projects to track progress automatically, and keep longer-lived reference notes in the Knowledge Base — all searchable from the command bar.",
  },
  {
    icon: SlidersHorizontal,
    tone: "ember",
    eyebrow: "Make it yours",
    title: "Everything here is tunable",
    body:
      "Pick a theme, connect Google Calendar, back up your data as a zip, or come back to this tour any time from Settings. You're ready — go ahead and explore.",
  },
];

export default function Tutorial({ open, onClose }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const current = STEPS[step];
  const Icon = current.icon;
  const tone = TONE_STYLE[current.tone];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-dusk-light bg-paper shadow-2xl">
        {/* Progress */}
        <div className="flex items-center gap-1.5 px-6 pt-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? tone.dot : "bg-dusk-light"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col items-start gap-4 px-7 pb-2 pt-6">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone.badge}`}>
            <Icon size={22} />
          </div>
          <div>
            <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${tone.text}`}>
              {current.eyebrow} · Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="font-display text-xl text-ink">{current.title}</h2>
          </div>
          <p className="text-sm leading-relaxed text-ink-soft">{current.body}</p>
          {current.bullets && (
            <ul className="w-full space-y-1.5">
              {current.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-dusk">
                  <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${tone.dot}`} />
                  {b}
                </li>
              ))}
            </ul>
          )}
          {isFirst && (
            <div className="flex items-center gap-1.5 rounded-md border border-dusk-light bg-fog px-2.5 py-1.5 text-[11px] text-dusk">
              <Command size={12} /> Tip: this tour is always available again from Settings.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-dusk-light px-6 py-4">
          <button onClick={onClose} className="text-xs font-medium text-dusk hover:text-ink-soft">
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
                className="flex items-center gap-1 rounded-md border border-dusk-light px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-fog"
              >
                <ArrowLeft size={13} /> Back
              </button>
            )}
            <button
              onClick={() => (isLast ? onClose() : setStep((s) => Math.min(s + 1, STEPS.length - 1)))}
              className="flex items-center gap-1.5 rounded-md bg-moss px-4 py-1.5 text-xs font-medium text-paper hover:bg-moss/90"
            >
              {isLast ? "Let's go" : "Next"}
              {!isLast && <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
