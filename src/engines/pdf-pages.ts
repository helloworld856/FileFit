/** Explicit page order: 3,1-2,blank,-4 (negative entries exclude pages). */
export function pageSelection(spec: string, count: number): (number | null)[] {
  if (!spec.trim()) return Array.from({length: count}, (_,i)=>i);
  const entries = spec.split(/[,，\s]+/).filter(Boolean);
  const excludes = new Set<number>();
  const result: (number|null)[] = [];
  for (const entry of entries) {
    if (/^(blank|空白)$/i.test(entry)) { result.push(null); continue; }
    const match = /^(-?)(\d+)(?:-(\d+))?$/.exec(entry);
    if (!match) throw new Error(`Invalid page selection: ${entry}`);
    const start = Number(match[2]), end = Number(match[3] ?? start);
    if (start < 1 || end < 1 || start > count || end > count) throw new Error(`Page outside 1–${count}: ${entry}`);
    const step = end >= start ? 1 : -1;
    for(let n=start;;n+=step) { if(match[1]) excludes.add(n-1); else result.push(n-1); if(n===end) break; }
  }
  const selected = result.length ? result : Array.from({length:count},(_,i)=>i);
  const filtered = selected.filter(n=>n===null || !excludes.has(n));
  if (!filtered.length) throw new Error('At least one page must remain.');
  return filtered;
}
