export type ID = string;

export interface BaseRecord {
  id: ID;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type InboxItemType = "task" | "note" | "project" | "document" | "link" | "unsorted";

export interface InboxItem extends BaseRecord {
  content: string;
  type: InboxItemType;
  processed?: boolean;
}

export type Priority = "low" | "medium" | "high";

export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
}

export interface Task extends BaseRecord {
  title: string;
  done: boolean;
  date?: string; // YYYY-MM-DD, for daily planner / calendar
  completedAt?: string | null; // ISO timestamp set when `done` flips true; cleared when flips false
  priority?: Priority;
  projectId?: ID;
  notes?: string;
  startTime?: string; // "HH:MM" for time blocking
  endTime?: string;
  order?: number;
  recurrence?: Recurrence;
  recurrenceEndDate?: string;
  seriesId?: ID;
  subtasks?: Subtask[];
}

export type ProjectStatus = "active" | "paused" | "done" | "archived";

export interface Milestone {
  id: ID;
  title: string;
  done: boolean;
  dueDate?: string;
}

export interface LinkRef {
  id: ID;
  label: string;
  url: string;
}

export interface Project extends BaseRecord {
  name: string;
  description?: string;
  goals?: string;
  status: ProjectStatus;
  progress?: number; // manual override; else derived from tasks
  dueDate?: string;
  milestones: Milestone[];
  resources?: string;
  links: LinkRef[];
  notes?: string;
  color?: string;
}

export type DocumentCategory = string;

export interface DocumentItem extends BaseRecord {
  title: string;
  category: DocumentCategory;
  tags: string[];
  content?: string;
  url?: string;
  projectId?: ID;
  fileName?: string;
  originalName?: string;
  mimeType?: string;
  fileSize?: number;
}

export interface KnowledgeNote extends BaseRecord {
  title: string;
  tags: string[];
  content: string;
  viewMode?: "edit" | "preview"; // persisted per-note so it doesn't reset on navigation
}

export type EventType = "event" | "deadline" | "recurring" | "birthday" | "holiday";
export type EventSource = "local" | "google";
export type CalendarColor = "moss" | "ember" | "signal" | "rose" | "amber" | "teal" | "indigo" | "plum" | "sky";

export interface CalendarEvent extends BaseRecord {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  type: EventType;
  projectId?: ID;
  recurrence?: Recurrence;
  recurrenceEndDate?: string;
  seriesId?: ID;
  source?: EventSource;
  url?: string;
  isHoliday?: boolean; // seeded default holiday — stands out, not user-color-customizable
}

export interface DailyLog {
  date: string;
  goals: string[];
  reflection?: string;
  notes?: string;
}

export interface Profile {
  id: string;
  name: string;
  createdAt: string;
}

export type ThemeName = "meadow" | "midnight" | "slate" | "sand";

export interface Quote {
  text: string;
  author: string;
}

export interface Settings {
  name: string;
  quoteOfDay: boolean;
  weatherLocation: string;
  pinnedSections: string[];
  theme: ThemeName;
  customQuotes: Quote[];
  documentCategories: string[];
  calendarColors: { event: CalendarColor; deadline: CalendarColor; recurring: CalendarColor; birthday: CalendarColor };
  geminiApiKey: string;
  notifyTimeBlocks: boolean;
  googleClientId: string;
  googleClientSecret?: string; // write-only: never returned by the API, only sent when saving
  googleClientSecretSet: boolean;
  googleConnected: boolean;
}

export interface AnalyticsSummary {
  today: { date: string; total: number; completed: number };
  last14Days: { date: string; total: number; completed: number }[];
  projects: { id: ID; name: string; progress: number; status: ProjectStatus }[];
  allTime: { totalTasks: number; totalCompleted: number; completionRate: number };
}

export interface WeeklyReviewDayTask {
  id: ID;
  title: string;
  projectId?: ID;
  projectName?: string;
}

export interface WeeklyReviewDay {
  date: string;
  total: number;
  completed: number;
  completedTasks: WeeklyReviewDayTask[];
  goals: string[];
  reflection: string;
  notes: string;
}

export interface WeeklyReview {
  weekStart: string;
  weekEnd: string;
  days: WeeklyReviewDay[];
  totals: { total: number; completed: number };
  goalsSet: number;
  reflections: { date: string; text: string }[];
  completedTasks: { id: ID; title: string; date?: string; projectId?: ID; projectName?: string }[];
  projectsTouched: {
    id: ID;
    name: string;
    progress: number;
    completedThisWeek: number;
    completedTaskTitles: string[];
  }[];
}

export type TrashCollection = "inbox" | "tasks" | "projects" | "documents" | "notes" | "events";

export interface TrashItem {
  collection: TrashCollection;
  id: ID;
  label: string;
  deletedAt: string;
}

export type SearchResultType = "task" | "project" | "document" | "note";

export interface SearchResult {
  type: SearchResultType;
  id: ID;
  title: string;
  subtitle?: string;
  projectId?: ID;
}
