// Every node `next` leads to from `start`, itself left out: what a package brings, or what brings it, in the lookup's
// readers of a lock file (lookup.mjs, lookup-pypi.mjs); and `closure`, the same for every node at once.
export function reach(start, next) {
  const seen = new Set([start]), todo = [start];
  while (todo.length) for (const n of next(todo.pop())) if (!seen.has(n)) { seen.add(n); todo.push(n); }
  seen.delete(start);
  return seen;
}

/** What each of `nodes` brings and which of the `shown` ones bring it, for all of them in one pass (#1388, point 3),
 *  where `reach` asked of each walks the graph again, quadratic over a chain: { brings(node), by(node) }, `children`
 *  a Map of each node to what it leads to. The graph is cut into its cycles (Tarjan's strongly connected components,
 *  walked without recursion, so a chain of any length is read), and each cycle's descendants, then the shown nodes that
 *  lead to it, gathered as bits from the cycles it leads to, then from those that lead to it. `brings` counts what
 *  `reach` would, the node itself left out; `by` gives the shown nodes among what leads to it, in the order of `shown`. */
export function closure(nodes, children, shown) {
  const at = new Map(nodes.map((n, i) => [n, i])), adj = nodes.map((n) => [...(children.get(n) ?? [])].map((c) => at.get(c)).filter((c) => c !== undefined));
  const { comp, comps } = components(adj);
  const W = (comps.length + 31) >>> 5, desc = comps.map(() => new Uint32Array(W)), counts = new Array(comps.length);
  // (a cycle's descendants, the cycles found first being those it leads to; each counted by its members, past the one bit)
  const big = comps.map((m, c) => [c, m.length - 1]).filter(([, extra]) => extra > 0);
  comps.forEach((members, c) => {
    for (const u of members) for (const w of adj[u]) if (comp[w] !== c) { const d = comp[w]; desc[c][d >>> 5] |= 1 << (d & 31); or(desc[c], desc[d]); }
    counts[c] = members.length - 1 + bits(desc[c]) + big.reduce((sum, [b, extra]) => sum + (desc[c][b >>> 5] >>> (b & 31) & 1) * extra, 0);
  });
  // (the shown nodes that lead to each cycle, passed on from each cycle to those it leads to, the last found first)
  const marks = [...new Set(shown)].filter((n) => at.has(n)), S = (marks.length + 31) >>> 5, anc = comps.map(() => new Uint32Array(S)), own = comps.map(() => []);
  marks.forEach((n, k) => own[comp[at.get(n)]].push(k));
  for (let c = comps.length - 1; c >= 0; c--) {
    const passed = Uint32Array.from(anc[c]);
    for (const k of own[c]) passed[k >>> 5] |= 1 << (k & 31);
    for (const u of comps[c]) for (const w of adj[u]) if (comp[w] !== c) or(anc[comp[w]], passed);
  }
  return {
    brings: (n) => (at.has(n) ? counts[comp[at.get(n)]] : 0),
    by: (n) => {
      if (!at.has(n)) return [];
      const c = comp[at.get(n)];
      return marks.filter((m, k) => (anc[c][k >>> 5] >>> (k & 31) & 1) === 1 || (m !== n && comp[at.get(m)] === c));
    },
  };
}

const or = (into, from) => { for (let i = 0; i < from.length; i++) into[i] |= from[i]; };
const bits = (set) => { let n = 0; for (let x of set) { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); n += (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; } return n; };

// The cycles of the graph `adj` (each node's list of the nodes it leads to): { comp, comps }, each node's cycle and each
// cycle's members, a cycle found only after every cycle it leads to (Tarjan's order), with no recursion.
function components(adj) {
  const n = adj.length, index = new Int32Array(n).fill(-1), low = new Int32Array(n), on = new Uint8Array(n), comp = new Int32Array(n);
  const stack = [], comps = [];
  let next = 0;
  for (let s = 0; s < n; s++) {
    if (index[s] >= 0) continue;
    const work = [[s, 0]];
    index[s] = low[s] = next++; stack.push(s); on[s] = 1;
    while (work.length) {
      const top = work[work.length - 1], v = top[0];
      if (top[1] < adj[v].length) {
        const w = adj[v][top[1]++];
        if (index[w] < 0) { index[w] = low[w] = next++; stack.push(w); on[w] = 1; work.push([w, 0]); }
        else if (on[w]) low[v] = Math.min(low[v], index[w]);
        continue;
      }
      work.pop();
      if (work.length) { const u = work[work.length - 1][0]; low[u] = Math.min(low[u], low[v]); }
      if (low[v] !== index[v]) continue;
      const members = [];
      let w;
      do { w = stack.pop(); on[w] = 0; comp[w] = comps.length; members.push(w); } while (w !== v);
      comps.push(members);
    }
  }
  return { comp, comps };
}
