// recurrence.js
// Pure helper functions for expanding a recurring task/event template
// into individual dated occurrences. Kept dependency-free and deterministic.

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISO(d);
}

function addMonths(iso, n) {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  // handle month-length overflow (e.g. Jan 31 + 1 month)
  if (d.getDate() !== day) d.setDate(0);
  return toISO(d);
}

function addYears(iso, n) {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDate();
  d.setFullYear(d.getFullYear() + n);
  // handle Feb 29 on a non-leap target year, same overflow trick as addMonths
  if (d.getDate() !== day) d.setDate(0);
  return toISO(d);
}

/**
 * How far ahead (in days) we need to generate/top-up occurrences for a given
 * recurrence so that at least one future instance always exists. Daily/weekly/
 * monthly series comfortably fit inside the default horizon, but a yearly
 * series (e.g. a birthday) needs slightly more than a full year of runway or
 * it will only ever produce its first occurrence and then silently stop.
 */
function horizonDaysFor(recurrence, defaultDays) {
  if (recurrence === "yearly") return Math.max(defaultDays, 400);
  return defaultDays;
}

/**
 * Generate the list of occurrence dates (ISO strings, inclusive of startDate)
 * for a recurrence rule, capped by an end date and/or a horizon date.
 *
 * @param {string} startDate - ISO date of the first occurrence
 * @param {"daily"|"weekly"|"monthly"|"yearly"} recurrence
 * @param {string|undefined} untilDate - ISO date; stop generating after this date (inclusive)
 * @param {string} horizonDate - ISO date; hard cap regardless of untilDate
 * @param {number} maxCount - safety cap on number of instances generated
 */
function generateOccurrenceDates(startDate, recurrence, untilDate, horizonDate, maxCount = 400) {
  const dates = [];
  let cursor = startDate;
  const cap = untilDate && untilDate < horizonDate ? untilDate : horizonDate;

  while (cursor <= cap && dates.length < maxCount) {
    dates.push(cursor);
    if (recurrence === "daily") cursor = addDays(cursor, 1);
    else if (recurrence === "weekly") cursor = addDays(cursor, 7);
    else if (recurrence === "monthly") cursor = addMonths(cursor, 1);
    else if (recurrence === "yearly") cursor = addYears(cursor, 1);
    else break; // "none" or unrecognized — single occurrence only
  }
  return dates;
}

module.exports = { generateOccurrenceDates, addDays, addMonths, addYears, horizonDaysFor, toISO };
