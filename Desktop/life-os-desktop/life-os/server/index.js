const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const archiver = require("archiver");
const AdmZip = require("adm-zip");
const store = require("./store");
const { generateOccurrenceDates, addDays, addMonths, addYears, horizonDaysFor } = require("./recurrence");

const app = express();
const PORT = process.env.PORT || 4310;

app.use(cors());
app.use(express.json());

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const RECURRENCE_HORIZON_DAYS = 90;
const RECURRENCE_TOPUP_BUFFER_DAYS = 30;
const TRASH_RETENTION_DAYS = 30;

// --- File uploads (Documents) ---
const UPLOADS_DIR = path.join(store.DATA_DIR, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${req.params.id}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — generous for a local personal tool
});

// Collections that support soft delete / trash
const TRASHABLE_COLLECTIONS = ["inbox", "tasks", "projects", "documents", "notes", "events"];

function deleteDocumentFile(doc) {
  if (doc && doc.fileName) {
    const filePath = path.join(UPLOADS_DIR, doc.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

function trashLabel(collection, item) {
  if (collection === "projects") return item.name || "(untitled project)";
  if (collection === "inbox") return item.content || "(empty)";
  return item.title || "(untitled)";
}

// --- Recurrence helpers shared by tasks & events ---

function makeRecurringCreateHandler(collectionName) {
  return (req, res) => {
    const payload = req.body || {};
    const recurrence = payload.recurrence;

    if (!recurrence || recurrence === "none" || !payload.date) {
      const item = store.create(collectionName, payload);
      return res.status(201).json(item);
    }

    const horizon = addDays(todayISO(), horizonDaysFor(recurrence, RECURRENCE_HORIZON_DAYS));
    const dates = generateOccurrenceDates(payload.date, recurrence, payload.recurrenceEndDate, horizon);

    const first = store.create(collectionName, { ...payload, seriesId: undefined });
    const firstWithSeries = store.update(collectionName, first.id, { seriesId: first.id });

    dates.slice(1).forEach((d) => {
      store.create(collectionName, { ...payload, date: d, seriesId: first.id });
    });

    res.status(201).json(firstWithSeries);
  };
}

function topUpRecurring(collectionName) {
  const items = store.list(collectionName);
  const bySeries = {};
  items.forEach((it) => {
    if (!it.seriesId) return;
    (bySeries[it.seriesId] = bySeries[it.seriesId] || []).push(it);
  });

  const today = todayISO();
  const bufferEdge = addDays(today, RECURRENCE_TOPUP_BUFFER_DAYS);

  Object.values(bySeries).forEach((group) => {
    const template = group[0];
    const recurrence = template.recurrence;
    if (!recurrence || recurrence === "none") return;

    // Each recurrence cadence needs its own horizon: a 90-day window is
    // plenty to keep a daily/weekly/monthly series topped up, but a yearly
    // series (e.g. a birthday) needs over a year of runway or its next
    // occurrence will always fall outside the window and never get created.
    const horizon = addDays(today, horizonDaysFor(recurrence, RECURRENCE_HORIZON_DAYS));

    const maxDate = group.reduce((m, it) => (it.date > m ? it.date : m), template.date);
    const until = template.recurrenceEndDate;
    if (until && maxDate >= until) return;
    if (maxDate >= bufferEdge) return;

    let nextStart;
    if (recurrence === "daily") nextStart = addDays(maxDate, 1);
    else if (recurrence === "weekly") nextStart = addDays(maxDate, 7);
    else if (recurrence === "monthly") nextStart = addMonths(maxDate, 1);
    else if (recurrence === "yearly") nextStart = addYears(maxDate, 1);
    else return;
    if (nextStart > horizon) return;

    const { id, createdAt, updatedAt, ...templateFields } = template;
    const nextDates = generateOccurrenceDates(nextStart, recurrence, until, horizon);
    nextDates.forEach((d) => {
      const extra = collectionName === "tasks" ? { done: false } : {};
      store.create(collectionName, { ...templateFields, ...extra, date: d });
    });
  });
}

/** Permanently erase trash items older than the retention window. */
function purgeOldTrash() {
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  TRASHABLE_COLLECTIONS.forEach((name) => {
    store.listDeleted(name).forEach((item) => {
      const deletedAt = new Date(item.deletedAt).getTime();
      if (Number.isFinite(deletedAt) && deletedAt < cutoff) {
        if (name === "documents") deleteDocumentFile(item);
        store.purge(name, item.id);
      }
    });
  });
}

function registerArrayCollection(name, hooks = {}) {
  const base = `/api/${name}`;
  const trashable = TRASHABLE_COLLECTIONS.includes(name);
  // Optional: transform a batch of items before they go out over the wire —
  // e.g. computing a project's progress from its tasks. Runs for both the
  // list endpoint and the single-item endpoint, so the value is always
  // consistent no matter which route a page happens to call.
  const decorateAll = hooks.decorateAll || ((items) => items);

  app.get(base, (req, res) => {
    res.json(decorateAll(store.list(name)));
  });

  app.get(`${base}/:id`, (req, res) => {
    const item = store.getById(name, req.params.id);
    if (!item) return res.status(404).json({ error: "not_found" });
    res.json(decorateAll([item])[0]);
  });

  app.post(base, hooks.onCreate || ((req, res) => {
    const item = store.create(name, req.body || {});
    res.status(201).json(item);
  }));

  app.put(`${base}/:id`, (req, res) => {
    const item = store.update(name, req.params.id, req.body || {});
    if (!item) return res.status(404).json({ error: "not_found" });
    res.json(item);
  });

  app.delete(`${base}/:id`, (req, res) => {
    const existing = store.getById(name, req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (trashable) {
      store.softRemove(name, req.params.id);
    } else {
      store.purge(name, req.params.id);
    }
    res.status(204).end();
  });

  if (hooks.supportsSeries) {
    // Remove this occurrence and every future occurrence in its series.
    // This is a deliberate bulk action, not a single accidental delete, so
    // it bypasses the trash and removes outright (past instances are kept
    // for history).
    app.delete(`${base}/:id/series`, (req, res) => {
      const item = store.getById(name, req.params.id);
      if (!item) return res.status(404).json({ error: "not_found" });
      const seriesId = item.seriesId || item.id;
      const today = todayISO();
      const all = store.list(name);
      const toRemove = all.filter((x) => x.seriesId === seriesId && (!x.date || x.date >= today));
      toRemove.forEach((x) => store.purge(name, x.id));
      res.json({ removed: toRemove.length });
    });
  }
}

registerArrayCollection("inbox");
registerArrayCollection("tasks", {
  onCreate: makeRecurringCreateHandler("tasks"),
  supportsSeries: true,
});
registerArrayCollection("projects", {
  decorateAll: (items) => {
    const tasks = store.list("tasks");
    return items.map((project) => {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      if (!projectTasks.length) return project;
      const done = projectTasks.filter((t) => t.done).length;
      const progress = Math.round((done / projectTasks.length) * 100);
      return { ...project, progress };
    });
  },
});
registerArrayCollection("documents");
registerArrayCollection("notes");
registerArrayCollection("events", {
  onCreate: makeRecurringCreateHandler("events"),
  supportsSeries: true,
});

// --- Trash: browse, restore, or permanently delete soft-deleted items ---

app.get("/api/trash", (req, res) => {
  const items = [];
  TRASHABLE_COLLECTIONS.forEach((name) => {
    store.listDeleted(name).forEach((item) => {
      items.push({
        collection: name,
        id: item.id,
        label: trashLabel(name, item),
        deletedAt: item.deletedAt,
      });
    });
  });
  items.sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || ""));
  res.json(items);
});

app.post("/api/trash/:collection/:id/restore", (req, res) => {
  const { collection, id } = req.params;
  if (!TRASHABLE_COLLECTIONS.includes(collection)) return res.status(400).json({ error: "bad_collection" });
  const item = store.restore(collection, id);
  if (!item) return res.status(404).json({ error: "not_found" });
  res.json(item);
});

app.delete("/api/trash/:collection/:id", (req, res) => {
  const { collection, id } = req.params;
  if (!TRASHABLE_COLLECTIONS.includes(collection)) return res.status(400).json({ error: "bad_collection" });
  const item = store.getById(collection, id, { includeDeleted: true });
  if (!item) return res.status(404).json({ error: "not_found" });
  if (collection === "documents") deleteDocumentFile(item);
  store.purge(collection, id);
  res.status(204).end();
});

app.delete("/api/trash", (req, res) => {
  let removed = 0;
  TRASHABLE_COLLECTIONS.forEach((name) => {
    store.listDeleted(name).forEach((item) => {
      if (name === "documents") deleteDocumentFile(item);
      store.purge(name, item.id);
      removed++;
    });
  });
  res.json({ removed });
});

// --- Document file attachments ---

app.post("/api/documents/:id/upload", upload.single("file"), (req, res) => {
  const doc = store.getById("documents", req.params.id);
  if (!doc) return res.status(404).json({ error: "not_found" });
  if (!req.file) return res.status(400).json({ error: "no_file" });

  if (doc.fileName) {
    const oldPath = path.join(UPLOADS_DIR, doc.fileName);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const updated = store.update("documents", doc.id, {
    fileName: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
  });
  res.json(updated);
});

app.get("/api/documents/:id/file", (req, res) => {
  const doc = store.getById("documents", req.params.id);
  if (!doc || !doc.fileName) return res.status(404).json({ error: "not_found" });
  const filePath = path.join(UPLOADS_DIR, doc.fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "file_missing" });
  res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(doc.originalName || doc.fileName)}"`
  );
  fs.createReadStream(filePath).pipe(res);
});

// --- Daily logs: keyed by ISO date (YYYY-MM-DD) ---

app.get("/api/dailyLogs", (req, res) => {
  res.json(store.getObject("dailyLogs", {}));
});

app.get("/api/dailyLogs/:date", (req, res) => {
  const logs = store.getObject("dailyLogs", {});
  const entry = logs[req.params.date] || {
    date: req.params.date,
    goals: [],
    reflection: "",
    notes: "",
  };
  res.json(entry);
});

app.put("/api/dailyLogs/:date", (req, res) => {
  const logs = store.getObject("dailyLogs", {});
  logs[req.params.date] = {
    ...(logs[req.params.date] || {}),
    ...req.body,
    date: req.params.date,
  };
  store.setObject("dailyLogs", logs);
  res.json(logs[req.params.date]);
});

// --- Settings singleton ---

const SETTINGS_DEFAULTS = {
  name: "",
  quoteOfDay: true,
  weatherLocation: "",
  theme: "meadow",
  customQuotes: [],
  geminiApiKey: "",
  notifyTimeBlocks: false,
  googleClientId: "",
  pinnedSections: ["dashboard", "planner", "calendar", "projects", "documents", "knowledge"],
  documentCategories: ["School", "Personal", "Business", "Financial", "Medical", "Legal", "Other"],
};

app.get("/api/settings", (req, res) => {
  const current = store.getObject("settings", SETTINGS_DEFAULTS);
  // Never leak OAuth tokens or the client secret to the frontend —
  // it only needs to know whether a Google connection is active.
  const { googleTokens, googleClientSecret, ...safe } = current;
  res.json({
    ...SETTINGS_DEFAULTS,
    ...safe,
    googleConnected: !!(googleTokens && googleTokens.refresh_token),
    googleClientSecretSet: !!googleClientSecret,
  });
});

app.put("/api/settings", (req, res) => {
  const current = store.getObject("settings", SETTINGS_DEFAULTS);
  const { googleConnected, googleClientSecretSet, ...patch } = req.body || {};
  const next = { ...current, ...patch };
  store.setObject("settings", next);
  const { googleTokens, googleClientSecret, ...safe } = next;
  res.json({
    ...SETTINGS_DEFAULTS,
    ...safe,
    googleConnected: !!(googleTokens && googleTokens.refresh_token),
    googleClientSecretSet: !!googleClientSecret,
  });
});

// --- Analytics: derived, computed on read (never stored redundantly) ---

app.get("/api/analytics/summary", (req, res) => {
  const tasks = store.list("tasks");
  const projects = store.list("projects");

  const today = todayISO();

  const tasksToday = tasks.filter((t) => t.date === today);
  const completedToday = tasksToday.filter((t) => t.done);

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayTasks = tasks.filter((t) => t.date === iso);
    days.push({
      date: iso,
      total: dayTasks.length,
      completed: dayTasks.filter((t) => t.done).length,
    });
  }

  const projectStats = projects.map((p) => {
    const pTasks = tasks.filter((t) => t.projectId === p.id);
    const done = pTasks.filter((t) => t.done).length;
    const progress = pTasks.length ? Math.round((done / pTasks.length) * 100) : p.progress || 0;
    return { id: p.id, name: p.name, progress, status: p.status };
  });

  const totalTasks = tasks.length;
  const totalCompleted = tasks.filter((t) => t.done).length;

  res.json({
    today: { date: today, total: tasksToday.length, completed: completedToday.length },
    last14Days: days,
    projects: projectStats,
    allTime: {
      totalTasks,
      totalCompleted,
      completionRate: totalTasks ? Math.round((totalCompleted / totalTasks) * 100) : 0,
    },
  });
});

// --- Weekly review: aggregated view of a single Mon–Sun week ---

function mondayOf(iso) {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

app.get("/api/analytics/weekly", (req, res) => {
  const startParam = req.query.start; // ISO date of the Monday of the desired week
  const weekStart = startParam || mondayOf(todayISO());
  const weekEnd = addDays(weekStart, 6);

  const tasks = store.list("tasks");
  const projects = store.list("projects");
  const dailyLogs = store.getObject("dailyLogs", {});

  const weekTasks = tasks.filter((t) => t.date && t.date >= weekStart && t.date <= weekEnd);
  const completedTasks = weekTasks.filter((t) => t.done);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(weekStart, i);
    const dayTasks = tasks.filter((t) => t.date === iso);
    days.push({ date: iso, total: dayTasks.length, completed: dayTasks.filter((t) => t.done).length });
  }

  let goalsSet = 0;
  const reflections = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(weekStart, i);
    const log = dailyLogs[iso];
    if (log) {
      goalsSet += (log.goals || []).length;
      if (log.reflection && log.reflection.trim()) {
        reflections.push({ date: iso, text: log.reflection.trim() });
      }
    }
  }

  const projectIdsTouched = new Set(completedTasks.map((t) => t.projectId).filter(Boolean));
  const projectsTouched = projects
    .filter((p) => projectIdsTouched.has(p.id))
    .map((p) => {
      const pTasks = tasks.filter((t) => t.projectId === p.id);
      const done = pTasks.filter((t) => t.done).length;
      const progress = pTasks.length ? Math.round((done / pTasks.length) * 100) : p.progress || 0;
      const completedThisWeek = completedTasks.filter((t) => t.projectId === p.id).length;
      return { id: p.id, name: p.name, progress, completedThisWeek };
    });

  res.json({
    weekStart,
    weekEnd,
    days,
    totals: { total: weekTasks.length, completed: completedTasks.length },
    goalsSet,
    reflections,
    completedTasks: completedTasks.map((t) => ({ id: t.id, title: t.title, date: t.date })),
    projectsTouched,
  });
});

// --- Global search: lightweight fuzzy scan across tasks/projects/documents/notes ---

app.get("/api/search", (req, res) => {
  const q = (req.query.q || "").toString().trim().toLowerCase();
  if (!q) return res.json([]);

  const results = [];
  store.list("tasks").forEach((t) => {
    if (t.title && t.title.toLowerCase().includes(q)) {
      results.push({ type: "task", id: t.id, title: t.title, subtitle: t.date || "", projectId: t.projectId });
    }
  });
  store.list("projects").forEach((p) => {
    if (p.name && p.name.toLowerCase().includes(q)) {
      results.push({ type: "project", id: p.id, title: p.name, subtitle: p.status || "" });
    }
  });
  store.list("documents").forEach((d) => {
    const tagMatch = (d.tags || []).some((t) => t.toLowerCase().includes(q));
    if ((d.title && d.title.toLowerCase().includes(q)) || tagMatch) {
      results.push({ type: "document", id: d.id, title: d.title, subtitle: d.category || "" });
    }
  });
  store.list("notes").forEach((n) => {
    const tagMatch = (n.tags || []).some((t) => t.toLowerCase().includes(q));
    if ((n.title && n.title.toLowerCase().includes(q)) || tagMatch || (n.content || "").toLowerCase().includes(q)) {
      results.push({ type: "note", id: n.id, title: n.title, subtitle: "Knowledge Base" });
    }
  });

  res.json(results.slice(0, 30));
});

// --- Backup: zip the entire data directory for download ---

app.get("/api/backup", (req, res) => {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="life-os-backup-${todayISO()}.zip"`);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    console.error("Backup error:", err);
    res.status(500).end();
  });
  archive.pipe(res);
  archive.directory(store.DATA_DIR, false);
  archive.finalize();
});

// --- Backup: restore from a previously downloaded zip ---
// This entirely replaces the current data folder with the contents of the
// uploaded zip, so the user can move their data to a new machine or recover
// from a mistake. We stage the upload outside of DATA_DIR first and do a
// basic sanity check before touching any existing data.
const backupImportUpload = multer({ dest: path.join(os.tmpdir(), "life-os-backup-import") });

app.post("/api/backup/import", backupImportUpload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no_file" });

  const cleanup = () => {
    fs.unlink(req.file.path, () => {});
  };

  let zip;
  try {
    zip = new AdmZip(req.file.path);
  } catch (err) {
    cleanup();
    return res.status(400).json({ error: "invalid_zip" });
  }

  const KNOWN_DATA_FILES = [
    "tasks.json",
    "events.json",
    "projects.json",
    "documents.json",
    "notes.json",
    "settings.json",
    "inbox.json",
    "dailyLogs.json",
  ];
  const entryNames = zip.getEntries().map((e) => e.entryName);
  const looksLikeBackup = entryNames.some((name) => KNOWN_DATA_FILES.includes(name));
  if (!looksLikeBackup) {
    cleanup();
    return res.status(400).json({ error: "not_a_life_os_backup" });
  }

  try {
    // Wipe the current data folder, then extract the backup in its place.
    fs.readdirSync(store.DATA_DIR).forEach((name) => {
      fs.rmSync(path.join(store.DATA_DIR, name), { recursive: true, force: true });
    });
    zip.extractAllTo(store.DATA_DIR, true);
    cleanup();
    res.json({ imported: true });
  } catch (err) {
    console.error("Backup import error:", err);
    cleanup();
    res.status(500).json({ error: "import_failed" });
  }
});

// --- Google Calendar (read-only sync) ---
// Requires the user to create their own OAuth client in Google Cloud Console
// (see README) and paste the Client ID / Secret into Settings.

const GOOGLE_REDIRECT_URI = `http://localhost:${PORT}/api/google/callback`;
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || `http://localhost:${PORT}`;

app.get("/api/google/auth-url", (req, res) => {
  const settings = store.getObject("settings", SETTINGS_DEFAULTS);
  if (!settings.googleClientId) return res.status(400).json({ error: "missing_client_id" });
  const params = new URLSearchParams({
    client_id: settings.googleClientId,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

app.get("/api/google/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`${CLIENT_ORIGIN}/settings?google=error`);
  const settings = store.getObject("settings", SETTINGS_DEFAULTS);
  if (!code || !settings.googleClientId || !settings.googleClientSecret) {
    return res.redirect(`${CLIENT_ORIGIN}/settings?google=error`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: settings.googleClientId,
        client_secret: settings.googleClientSecret,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokens.error_description || "Token exchange failed");

    const current = store.getObject("settings", SETTINGS_DEFAULTS);
    store.setObject("settings", {
      ...current,
      googleTokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || (current.googleTokens || {}).refresh_token,
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
      },
    });
    res.redirect(`${CLIENT_ORIGIN}/settings?google=connected`);
  } catch (err) {
    console.error("Google OAuth error:", err.message);
    res.redirect(`${CLIENT_ORIGIN}/settings?google=error`);
  }
});

app.post("/api/google/disconnect", (req, res) => {
  const current = store.getObject("settings", SETTINGS_DEFAULTS);
  const { googleTokens, ...rest } = current;
  store.setObject("settings", rest);
  res.json({ disconnected: true });
});

async function getValidGoogleAccessToken() {
  const settings = store.getObject("settings", SETTINGS_DEFAULTS);
  const tokens = settings.googleTokens;
  if (!tokens || !tokens.refresh_token) return null;

  if (tokens.expiresAt && tokens.expiresAt > Date.now() + 60_000) {
    return tokens.access_token;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: settings.googleClientId,
      client_secret: settings.googleClientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const refreshed = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(refreshed.error_description || "Token refresh failed");

  const current = store.getObject("settings", SETTINGS_DEFAULTS);
  store.setObject("settings", {
    ...current,
    googleTokens: {
      ...tokens,
      access_token: refreshed.access_token,
      expiresAt: Date.now() + (refreshed.expires_in || 3600) * 1000,
    },
  });
  return refreshed.access_token;
}

app.get("/api/google/calendar/events", async (req, res) => {
  try {
    const accessToken = await getValidGoogleAccessToken();
    if (!accessToken) return res.json([]);

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 180);

    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await calRes.json();
    if (!calRes.ok) throw new Error(data.error?.message || "Calendar fetch failed");

    const events = (data.items || []).map((ev) => {
      const dateStr = ev.start?.date || (ev.start?.dateTime || "").slice(0, 10);
      const timeStr = ev.start?.dateTime ? ev.start.dateTime.slice(11, 16) : undefined;
      return {
        id: `google:${ev.id}`,
        title: ev.summary || "(no title)",
        date: dateStr,
        time: timeStr,
        type: "event",
        source: "google",
        url: ev.htmlLink,
      };
    });
    res.json(events.filter((e) => e.date));
  } catch (err) {
    console.error("Google Calendar error:", err.message);
    res.status(502).json({ error: "google_calendar_failed", message: err.message });
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

// --- Serve the built client (production / packaged desktop app) ---
// In normal local dev you run the Vite dev server separately (npm run dev)
// and this block is simply skipped because client/dist doesn't exist yet.
// Once you `npm run build` the client (or build the Electron app, which does
// this automatically), this same server can serve the whole app on one port.
const CLIENT_DIST = process.env.LIFE_OS_CLIENT_DIST || path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(path.join(CLIENT_DIST, "index.html"))) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback: any non-API GET that didn't match a static file goes to
  // index.html so client-side routing (React Router) can take over.
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

// Background maintenance: keep recurring series topped up and expire old trash.
topUpRecurring("tasks");
topUpRecurring("events");
purgeOldTrash();
setInterval(() => {
  topUpRecurring("tasks");
  topUpRecurring("events");
  purgeOldTrash();
}, 6 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Life OS server running at http://localhost:${PORT}`);
  console.log(`Data stored in ${store.DATA_DIR}`);
});
