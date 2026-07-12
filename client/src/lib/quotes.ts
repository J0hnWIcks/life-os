import type { Quote } from "../types";

export const PRESET_QUOTES: Quote[] = [
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act but a habit.", author: "Will Durant, on Aristotle" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "You have power over your mind, not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "Well begun is half done.", author: "Aristotle" },
  { text: "Do not spoil what you have by desiring what you have not.", author: "Epicurus" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "What we plant in the soil of contemplation, we shall reap in the harvest of action.", author: "Meister Eckhart" },
  { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
  { text: "Order and simplification are the first steps toward mastery of a subject.", author: "Thomas Mann" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "A journey of a thousand miles begins with a single step.", author: "Laozi" },
  { text: "Nothing is particularly hard if you divide it into small jobs.", author: "Henry Ford" },
  { text: "He who has begun has half done. Dare to know; begin!", author: "Horace" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { text: "Better three hours too soon than a minute too late.", author: "William Shakespeare" },
];

/** Deterministic string hash (FNV-1a) → well-scrambled non-negative int, seeds the day's pick. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Picks a quote that looks randomly chosen from the combined preset + custom
 * pool, but stays stable for the whole day (re-randomizing tomorrow) so it
 * doesn't change every time the dashboard re-renders.
 */
export function quoteOfTheDay(customQuotes: Quote[] = [], date = new Date()): Quote {
  const pool = [...PRESET_QUOTES, ...customQuotes];
  const dateKey = date.toISOString().slice(0, 10);
  const index = hashString(dateKey) % pool.length;
  return pool[index];
}
