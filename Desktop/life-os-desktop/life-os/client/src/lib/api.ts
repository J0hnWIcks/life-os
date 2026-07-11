import type {
  InboxItem,
  Task,
  Project,
  DocumentItem,
  KnowledgeNote,
  CalendarEvent,
  DailyLog,
  Settings,
  AnalyticsSummary,
  WeeklyReview,
  TrashItem,
  TrashCollection,
  SearchResult,
  ID,
} from "../types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: options?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status} on ${path}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

function makeCollection<T extends { id: ID }>(name: string) {
  return {
    list: () => request<T[]>(`/${name}`),
    get: (id: ID) => request<T>(`/${name}/${id}`),
    create: (payload: Partial<T>) =>
      request<T>(`/${name}`, { method: "POST", body: JSON.stringify(payload) }),
    update: (id: ID, patch: Partial<T>) =>
      request<T>(`/${name}/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
    remove: (id: ID) => request<void>(`/${name}/${id}`, { method: "DELETE" }),
    removeSeries: (id: ID) =>
      request<{ removed: number }>(`/${name}/${id}/series`, { method: "DELETE" }),
  };
}

export const api = {
  inbox: makeCollection<InboxItem>("inbox"),
  tasks: makeCollection<Task>("tasks"),
  projects: makeCollection<Project>("projects"),
  documents: {
    ...makeCollection<DocumentItem>("documents"),
    upload: async (id: ID, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return request<DocumentItem>(`/documents/${id}/upload`, { method: "POST", body: formData });
    },
    fileUrl: (id: ID) => `${BASE}/documents/${id}/file`,
  },
  notes: makeCollection<KnowledgeNote>("notes"),
  events: makeCollection<CalendarEvent>("events"),

  dailyLog: {
    get: (date: string) => request<DailyLog>(`/dailyLogs/${date}`),
    update: (date: string, patch: Partial<DailyLog>) =>
      request<DailyLog>(`/dailyLogs/${date}`, { method: "PUT", body: JSON.stringify(patch) }),
  },

  settings: {
    get: () => request<Settings>("/settings"),
    update: (patch: Partial<Settings>) =>
      request<Settings>("/settings", { method: "PUT", body: JSON.stringify(patch) }),
  },

  analytics: {
    summary: () => request<AnalyticsSummary>("/analytics/summary"),
    weekly: (weekStart?: string) =>
      request<WeeklyReview>(`/analytics/weekly${weekStart ? `?start=${weekStart}` : ""}`),
  },

  trash: {
    list: () => request<TrashItem[]>("/trash"),
    restore: (collection: TrashCollection, id: ID) =>
      request(`/trash/${collection}/${id}/restore`, { method: "POST" }),
    purge: (collection: TrashCollection, id: ID) =>
      request<void>(`/trash/${collection}/${id}`, { method: "DELETE" }),
    empty: () => request<{ removed: number }>("/trash", { method: "DELETE" }),
  },

  search: (q: string) => request<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),

  google: {
    authUrl: () => request<{ url: string }>("/google/auth-url"),
    disconnect: () => request<{ disconnected: boolean }>("/google/disconnect", { method: "POST" }),
    events: () => request<CalendarEvent[]>("/google/calendar/events"),
  },

  backupUrl: () => `${BASE}/backup`,
  backupImport: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ imported: boolean }>("/backup/import", { method: "POST", body: formData });
  },
};

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
