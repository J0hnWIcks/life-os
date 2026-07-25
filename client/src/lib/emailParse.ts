import type { EmailContact, Priority } from "../types";

export interface ExtractedEmailDetails {
  priority: Priority;
  deadline?: string; // YYYY-MM-DD
  contact: EmailContact;
  checklistSuggestions: string[];
  summary: string;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3));

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toISO(y: number, mIdx: number, d: number): string | null {
  if (mIdx < 0 || mIdx > 11 || d < 1 || d > 31) return null;
  return `${y}-${pad(mIdx + 1)}-${pad(d)}`;
}

/** Best-effort date parse from free text: numeric (M/D/Y), "Month D, Y", "Mon D", weekday words, and today/tomorrow. */
function findDeadline(text: string): string | undefined {
  const now = new Date();
  const lower = text.toLowerCase();

  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (/\btoday\b/.test(lower)) {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  // "Month D" or "Month D, YYYY" e.g. "March 3" / "Mar 3, 2027"
  const monthPattern = new RegExp(
    `\\b(${MONTHS.join("|")}|${MONTH_ABBR.join("|")})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`,
    "i"
  );
  const mMatch = text.match(monthPattern);
  if (mMatch) {
    const name = mMatch[1].toLowerCase();
    const mIdx = MONTHS.indexOf(name) >= 0 ? MONTHS.indexOf(name) : MONTH_ABBR.indexOf(name.slice(0, 3));
    const day = parseInt(mMatch[2], 10);
    const year = mMatch[3] ? parseInt(mMatch[3], 10) : now.getFullYear();
    const iso = toISO(year, mIdx, day);
    if (iso) return iso;
  }

  // Numeric M/D/Y or M-D-Y
  const numMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numMatch) {
    const month = parseInt(numMatch[1], 10) - 1;
    const day = parseInt(numMatch[2], 10);
    let year = numMatch[3] ? parseInt(numMatch[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    const iso = toISO(year, month, day);
    if (iso) return iso;
  }

  return undefined;
}

function findPriority(text: string): Priority {
  const lower = text.toLowerCase();
  if (/\b(urgent|asap|immediately|action required|final notice|deadline today|last chance)\b/.test(lower)) {
    return "high";
  }
  if (/\b(fyi|no action needed|just a heads up|for your information only)\b/.test(lower)) {
    return "low";
  }
  return "medium";
}

function findContact(text: string): EmailContact {
  const contact: EmailContact = {};

  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}(?:\.[a-z]{2,})?/i);
  if (emailMatch) contact.email = emailMatch[0];

  const phoneMatch = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/);
  if (phoneMatch) contact.phone = phoneMatch[0].trim();

  // Try a signature block near the end: "Best,\nJane Smith" / "Sincerely,\nJohn Doe, Registrar"
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const signOffIdx = lines.findIndex((l) =>
    /^(best|sincerely|regards|thanks|thank you|cheers|warm regards|best regards)[,!.]?$/i.test(l)
  );
  if (signOffIdx >= 0 && lines[signOffIdx + 1]) {
    const nameLine = lines[signOffIdx + 1];
    const parts = nameLine.split(",");
    contact.name = parts[0].trim();
    if (parts[1]) contact.organization = parts.slice(1).join(",").trim();
  } else {
    // Fall back to a "From: Name <email>" header line if present.
    const fromMatch = text.match(/^from:\s*(.+)$/im);
    if (fromMatch) {
      const nameOnly = fromMatch[1].replace(/<.*?>/, "").trim();
      if (nameOnly) contact.name = nameOnly;
    }
  }

  return contact;
}

function findChecklistSuggestions(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const suggestions: string[] = [];

  for (const line of lines) {
    const isBullet = /^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
    const hasActionWord = /\b(please|must|required|submit|complete|register|sign|bring|upload|attend|schedule|reply|confirm)\b/i.test(line);
    if ((isBullet || hasActionWord) && line.length > 6 && line.length < 140) {
      const cleaned = line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "");
      if (!suggestions.includes(cleaned)) suggestions.push(cleaned);
    }
    if (suggestions.length >= 6) break;
  }

  return suggestions;
}

function findSummary(text: string): string {
  const firstPara = text.split(/\n\s*\n/).map((p) => p.trim()).find(Boolean) || "";
  const oneLine = firstPara.replace(/\s+/g, " ").trim();
  return oneLine.length > 220 ? `${oneLine.slice(0, 217)}...` : oneLine;
}

export function extractEmailDetails(text: string): ExtractedEmailDetails {
  return {
    priority: findPriority(text),
    deadline: findDeadline(text),
    contact: findContact(text),
    checklistSuggestions: findChecklistSuggestions(text),
    summary: findSummary(text),
  };
}
