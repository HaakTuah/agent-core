// Every node `next` leads to from `start`, itself left out: what a package brings, or what brings it, in the lookup's
// readers of a lock file (lookup.mjs, lookup-pypi.mjs).
export function reach(start, next) {
  const seen = new Set([start]), todo = [start];
  while (todo.length) for (const n of next(todo.pop())) if (!seen.has(n)) { seen.add(n); todo.push(n); }
  seen.delete(start);
  return seen;
}
