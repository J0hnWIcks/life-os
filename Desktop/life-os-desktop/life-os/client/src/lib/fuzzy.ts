/**
 * Minimal fuzzy matcher: scores how well `query` matches `target` as a
 * subsequence, favoring contiguous runs and matches near the start.
 * Returns null if query's characters don't all appear in order.
 */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 0;

  // Fast path: direct substring match scores best, weighted by position.
  const idx = t.indexOf(q);
  if (idx !== -1) {
    return 1000 - idx;
  }

  let score = 0;
  let tIdx = 0;
  let consecutive = 0;
  for (let qIdx = 0; qIdx < q.length; qIdx++) {
    const ch = q[qIdx];
    const found = t.indexOf(ch, tIdx);
    if (found === -1) return null;
    consecutive = found === tIdx ? consecutive + 1 : 0;
    score += 10 - Math.min(found - tIdx, 8) + consecutive * 2;
    tIdx = found + 1;
  }
  return score;
}

export function fuzzyMatch<T>(query: string, items: T[], getText: (item: T) => string): T[] {
  if (!query.trim()) return items;
  const scored = items
    .map((item) => ({ item, score: fuzzyScore(query, getText(item)) }))
    .filter((x): x is { item: T; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.item);
}
