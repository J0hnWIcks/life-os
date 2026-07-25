import type { CalendarColor } from "../types";

export const CALENDAR_COLOR_OPTIONS: { key: CalendarColor; label: string }[] = [
  { key: "moss", label: "Moss" },
  { key: "ember", label: "Ember" },
  { key: "signal", label: "Gold" },
  { key: "rose", label: "Rose" },
  { key: "amber", label: "Amber" },
  { key: "teal", label: "Teal" },
  { key: "indigo", label: "Indigo" },
  { key: "plum", label: "Plum" },
  { key: "sky", label: "Sky" },
];

// Explicit literal class names (not template-interpolated) so Tailwind's
// static scanner reliably generates these utilities for every theme.
export const CAL_BG: Record<CalendarColor, string> = {
  moss: "bg-moss",
  ember: "bg-ember",
  signal: "bg-signal",
  rose: "bg-cal-rose",
  amber: "bg-cal-amber",
  teal: "bg-cal-teal",
  indigo: "bg-cal-indigo",
  plum: "bg-cal-plum",
  sky: "bg-cal-sky",
};

export const CAL_TEXT: Record<CalendarColor, string> = {
  moss: "text-moss",
  ember: "text-ember",
  signal: "text-signal",
  rose: "text-cal-rose",
  amber: "text-cal-amber",
  teal: "text-cal-teal",
  indigo: "text-cal-indigo",
  plum: "text-cal-plum",
  sky: "text-cal-sky",
};

export const CAL_BORDER: Record<CalendarColor, string> = {
  moss: "border-moss",
  ember: "border-ember",
  signal: "border-signal",
  rose: "border-cal-rose",
  amber: "border-cal-amber",
  teal: "border-cal-teal",
  indigo: "border-cal-indigo",
  plum: "border-cal-plum",
  sky: "border-cal-sky",
};

export const CAL_BG_LIGHT: Record<CalendarColor, string> = {
  moss: "bg-moss-light",
  ember: "bg-ember-light",
  signal: "bg-signal-light",
  rose: "bg-cal-rose-light",
  amber: "bg-cal-amber-light",
  teal: "bg-cal-teal-light",
  indigo: "bg-cal-indigo-light",
  plum: "bg-cal-plum-light",
  sky: "bg-cal-sky-light",
};

export const DEFAULT_CALENDAR_COLORS = {
  event: "moss" as CalendarColor,
  deadline: "ember" as CalendarColor,
  recurring: "sky" as CalendarColor,
  birthday: "plum" as CalendarColor,
};
