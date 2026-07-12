// store.js
// A tiny, dependency-free JSON-file datastore.
// Every "collection" is a plain array persisted to <profile>/<name>.json.
// This keeps your data human-readable and trivially backup-able —
// just copy the active profile's folder.
//
// Soft delete: removing an item sets `deletedAt` instead of erasing it.
// list()/getById() hide deleted items by default; use listDeleted()/restore()/
// purge() to work with the trash.
//
// --- Profiles ---
// Multiple people can use the same install without mixing data: each
// profile gets its own folder under data/profiles/<id>/, and a small
// registry file (data/profiles.json) tracks which profiles exist and which
// one is currently active. Switching the active profile changes what every
// subsequent read/write in this module operates on.

const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

// Allows the desktop (Electron) wrapper to redirect storage to a writable,
// per-user location (e.g. app.getPath("userData")) instead of the folder
// the server code itself lives in, which is read-only once packaged.
const BASE_DIR = process.env.LIFE_OS_DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

const PROFILES_DIR = path.join(BASE_DIR, "profiles");
const REGISTRY_PATH = path.join(BASE_DIR, "profiles.json");
const LEGACY_COLLECTIONS = ["tasks", "projects", "documents", "notes", "events", "inbox", "dailyLogs", "settings"];

function profileDir(id) {
  return path.join(PROFILES_DIR, id);
}

function loadRegistryFile() {
  if (!fs.existsSync(REGISTRY_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function saveRegistry(reg) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2));
  return reg;
}

function initRegistry() {
  const existing = loadRegistryFile();
  if (existing) return existing;

  if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true });

  // Migrate a pre-existing single-profile install: if legacy data files sit
  // directly under BASE_DIR (how this app worked before profiles existed),
  // move them into a new "Default" profile so nobody loses data.
  const legacyFiles = LEGACY_COLLECTIONS.map((c) => path.join(BASE_DIR, `${c}.json`)).filter((fp) => fs.existsSync(fp));
  const legacyUploads = path.join(BASE_DIR, "uploads");
  const hasLegacyData = legacyFiles.length > 0 || fs.existsSync(legacyUploads);

  const defaultId = "default";
  const dir = profileDir(defaultId);
  fs.mkdirSync(dir, { recursive: true });

  if (hasLegacyData) {
    legacyFiles.forEach((fp) => fs.renameSync(fp, path.join(dir, path.basename(fp))));
    if (fs.existsSync(legacyUploads)) fs.renameSync(legacyUploads, path.join(dir, "uploads"));
  }

  return saveRegistry({
    activeId: defaultId,
    profiles: [{ id: defaultId, name: "Default", createdAt: new Date().toISOString() }],
  });
}

let registry = initRegistry();

function ensureProfileDirExists() {
  const dir = profileDir(registry.activeId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
ensureProfileDirExists();

function currentDataDir() {
  return ensureProfileDirExists();
}

function filePath(collection) {
  return path.join(currentDataDir(), `${collection}.json`);
}

function ensureFile(collection, defaultValue) {
  const fp = filePath(collection);
  if (!fs.existsSync(fp)) {
    fs.writeFileSync(fp, JSON.stringify(defaultValue, null, 2));
  }
}

function readAll(collection, defaultValue = []) {
  ensureFile(collection, defaultValue);
  const raw = fs.readFileSync(filePath(collection), "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function writeAll(collection, data) {
  fs.writeFileSync(filePath(collection), JSON.stringify(data, null, 2));
  return data;
}

// --- Array-collection helpers (tasks, projects, documents, notes, events, inbox) ---

function list(collection, opts = {}) {
  const all = readAll(collection, []);
  return opts.includeDeleted ? all : all.filter((item) => !item.deletedAt);
}

function listDeleted(collection) {
  return readAll(collection, []).filter((item) => !!item.deletedAt);
}

function getById(collection, id, opts = {}) {
  const all = readAll(collection, []);
  const item = all.find((i) => i.id === id);
  if (!item) return null;
  if (item.deletedAt && !opts.includeDeleted) return null;
  return item;
}

function create(collection, payload) {
  const items = readAll(collection, []);
  const now = new Date().toISOString();
  const item = { id: nanoid(10), createdAt: now, updatedAt: now, ...payload };
  items.push(item);
  writeAll(collection, items);
  return item;
}

function update(collection, id, patch) {
  const items = readAll(collection, []);
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch, id, updatedAt: new Date().toISOString() };
  writeAll(collection, items);
  return items[idx];
}

/** Soft delete: marks the item as trashed but keeps it on disk. */
function softRemove(collection, id) {
  return update(collection, id, { deletedAt: new Date().toISOString() });
}

/** Restore a soft-deleted item back to active use. */
function restore(collection, id) {
  const items = readAll(collection, []);
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  delete items[idx].deletedAt;
  items[idx].updatedAt = new Date().toISOString();
  writeAll(collection, items);
  return items[idx];
}

/** Permanently erase an item (used by Empty Trash / the 30-day auto-purge). */
function purge(collection, id) {
  const items = readAll(collection, []);
  const next = items.filter((item) => item.id !== id);
  writeAll(collection, next);
  return next.length !== items.length;
}

// --- Keyed-object helpers (dailyLogs keyed by date, settings singleton) ---

function getObject(collection, defaultValue = {}) {
  return readAll(collection, defaultValue);
}

function setObject(collection, data) {
  return writeAll(collection, data);
}

// --- Profiles ---

function listProfiles() {
  return registry.profiles;
}

function getActiveProfileId() {
  return registry.activeId;
}

function getActiveProfileDir() {
  return currentDataDir();
}

function createProfile(name) {
  const id = nanoid(10);
  fs.mkdirSync(profileDir(id), { recursive: true });
  const profile = { id, name: name.trim() || "New profile", createdAt: new Date().toISOString() };
  registry.profiles.push(profile);
  saveRegistry(registry);
  return profile;
}

function renameProfile(id, name) {
  const profile = registry.profiles.find((p) => p.id === id);
  if (!profile) return null;
  profile.name = name.trim() || profile.name;
  saveRegistry(registry);
  return profile;
}

function deleteProfile(id) {
  if (registry.profiles.length <= 1) {
    const err = new Error("cannot_delete_last_profile");
    err.code = "cannot_delete_last_profile";
    throw err;
  }
  const idx = registry.profiles.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  fs.rmSync(profileDir(id), { recursive: true, force: true });
  registry.profiles.splice(idx, 1);
  if (registry.activeId === id) {
    registry.activeId = registry.profiles[0].id;
  }
  saveRegistry(registry);
  ensureProfileDirExists();
  return true;
}

function setActiveProfile(id) {
  const profile = registry.profiles.find((p) => p.id === id);
  if (!profile) return false;
  registry.activeId = id;
  saveRegistry(registry);
  ensureProfileDirExists();
  return true;
}

module.exports = {
  list,
  listDeleted,
  getById,
  create,
  update,
  softRemove,
  restore,
  purge,
  getObject,
  setObject,
  // Profiles
  listProfiles,
  getActiveProfileId,
  getActiveProfileDir,
  createProfile,
  renameProfile,
  deleteProfile,
  setActiveProfile,
  get DATA_DIR() {
    // Kept for any code that still reads this as a property (e.g. logging) —
    // always reflects whichever profile is currently active.
    return currentDataDir();
  },
};
