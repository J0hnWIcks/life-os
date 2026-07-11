// store.js
// A tiny, dependency-free JSON-file datastore.
// Every "collection" is a plain array persisted to data/<name>.json.
// This keeps your data human-readable and trivially backup-able —
// just copy the /data folder.
//
// Soft delete: removing an item sets `deletedAt` instead of erasing it.
// list()/getById() hide deleted items by default; use listDeleted()/restore()/
// purge() to work with the trash.

const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

// Allows the desktop (Electron) wrapper to redirect storage to a writable,
// per-user location (e.g. app.getPath("userData")) instead of the folder
// the server code itself lives in, which is read-only once packaged.
const DATA_DIR = process.env.LIFE_OS_DATA_DIR || path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
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
  DATA_DIR,
};
