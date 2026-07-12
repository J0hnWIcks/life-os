// holidays.js
// Seeds a default set of commonly-celebrated US holidays into the events
// collection so the Calendar isn't empty on first run. Fixed-date holidays
// (Christmas, Halloween, etc.) reuse the same yearly-recurrence engine as
// user-created birthdays/recurring events, so they keep themselves topped up
// forever. Floating-date holidays (Thanksgiving, Easter, etc.) don't fit a
// fixed month/day, so they're precomputed for a wide range of years instead.

const { generateOccurrenceDates, addDays, horizonDaysFor } = require("./recurrence");

const FIXED_HOLIDAYS = [
  { title: "New Year's Day", month: 1, day: 1 },
  { title: "Valentine's Day", month: 2, day: 14 },
  { title: "St. Patrick's Day", month: 3, day: 17 },
  { title: "Independence Day", month: 7, day: 4 },
  { title: "Halloween", month: 10, day: 31 },
  { title: "Veterans Day", month: 11, day: 11 },
  { title: "Christmas Day", month: 12, day: 25 },
  { title: "New Year's Eve", month: 12, day: 31 },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

/** The nth (1-based) occurrence of `weekday` (0=Sun..6=Sat) in a given month. */
function nthWeekdayOfMonth(year, month /* 1-12 */, weekday, n) {
  const first = new Date(year, month - 1, 1);
  const firstWeekday = first.getDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** The last occurrence of `weekday` in a given month. */
function lastWeekdayOfMonth(year, month, weekday) {
  const lastDay = new Date(year, month, 0).getDate();
  const last = new Date(year, month - 1, lastDay);
  const lastWeekday = last.getDay();
  const back = (lastWeekday - weekday + 7) % 7;
  return `${year}-${pad(month)}-${pad(lastDay - back)}`;
}

/** Easter Sunday via the Anonymous Gregorian algorithm. */
function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function floatingHolidaysForYear(year) {
  return [
    { title: "Martin Luther King Jr. Day", date: nthWeekdayOfMonth(year, 1, 1, 3) },
    { title: "Presidents' Day", date: nthWeekdayOfMonth(year, 2, 1, 3) },
    { title: "Easter", date: easter(year) },
    { title: "Mother's Day", date: nthWeekdayOfMonth(year, 5, 0, 2) },
    { title: "Memorial Day", date: lastWeekdayOfMonth(year, 5, 1) },
    { title: "Father's Day", date: nthWeekdayOfMonth(year, 6, 0, 3) },
    { title: "Labor Day", date: nthWeekdayOfMonth(year, 9, 1, 1) },
    { title: "Columbus Day", date: nthWeekdayOfMonth(year, 10, 1, 2) },
    { title: "Thanksgiving", date: nthWeekdayOfMonth(year, 11, 4, 4) },
  ];
}

/**
 * Create the default holiday events. Safe to call more than once: it always
 * purges any existing isHoliday-flagged events first, so re-seeding (e.g. via
 * a "restore default holidays" action) never produces duplicates.
 */
function seedHolidays(store) {
  const existing = store.list("events").filter((e) => e.isHoliday);
  existing.forEach((e) => store.purge("events", e.id));

  const today = new Date();
  const thisYear = today.getFullYear();
  const horizonDays = horizonDaysFor("yearly", 90);
  const horizon = addDays(today.toISOString().slice(0, 10), horizonDays);

  // Fixed-date holidays: one yearly-recurring series each, exactly like a
  // user-created birthday.
  FIXED_HOLIDAYS.forEach((h) => {
    // Anchor the series a year in the past so "today" always falls within
    // an already-generated occurrence rather than only future ones.
    const anchorYear = thisYear - 1;
    const startDate = `${anchorYear}-${pad(h.month)}-${pad(h.day)}`;
    const dates = generateOccurrenceDates(startDate, "yearly", undefined, horizon);
    const first = store.create("events", {
      title: h.title,
      date: dates[0] || startDate,
      type: "holiday",
      isHoliday: true,
      source: "local",
      recurrence: "yearly",
    });
    store.update("events", first.id, { seriesId: first.id });
    dates.slice(1).forEach((d) => {
      store.create("events", {
        title: h.title,
        date: d,
        type: "holiday",
        isHoliday: true,
        source: "local",
        recurrence: "yearly",
        seriesId: first.id,
      });
    });
  });

  // Floating-date holidays: precompute a wide range of years since their
  // date shifts annually and doesn't fit the fixed-cadence recurrence engine.
  for (let y = thisYear - 1; y <= thisYear + 10; y++) {
    floatingHolidaysForYear(y).forEach((h) => {
      store.create("events", {
        title: h.title,
        date: h.date,
        type: "holiday",
        isHoliday: true,
        source: "local",
        recurrence: "none",
      });
    });
  }
}

module.exports = { seedHolidays, floatingHolidaysForYear, easter };
