// Every node `next` leads to from `start`, itself left out: what a package brings, or what brings it, in the lookup's
// readers of a lock file (lookup.mjs, lookup-pypi.mjs); and `closure`, the same for every node at once.
export function reach(start, next) {
  const seen = new Set([start]), todo = [start];
  while (todo.length) for (const n of next(todo.pop())) if (!seen.has(n)) { seen.add(n); todo.push(n); }
  seen.delete(start);
  return seen;
}

// What `closure` holds at once and does in all, in words of 32 bits (about 128 MB, and about a second here), past which
// it gives no answer: some graphs hold more to say of each node than a pass can carry, and the lookup says so.
const ROOM = 1 << 25, WORK = 1 << 26;
const OVER = new Error("past what the closure holds or does");

/** What each of `nodes` brings and which of the `shown` ones bring it, for all of them in one pass (#1388, point 3),
 *  where `reach` asked of each walks the graph again, quadratic over a chain: { brings(node), by(node) }, `children`
 *  a Map of each node to what it leads to. The graph is cut into its cycles (Tarjan's strongly connected components,
 *  walked without recursion, so a chain of any length is read); what each cycle leads to is gathered from the sinks up,
 *  and the shown nodes that lead to it from the sources down, each set listed while it is short and held as bits once
 *  longer. `brings` counts what `reach` would, the node itself left out; `by` gives the shown nodes among what leads to
 *  it, in the order of `shown`; each gives undefined where the graph took the pass past ROOM or WORK. */
export function closure(nodes, children, shown) {
  const at = new Map(nodes.map((n, i) => [n, i])), adj = nodes.map((n) => [...(children.get(n) ?? [])].map((c) => at.get(c)).filter((c) => c !== undefined));
  const { comp, comps } = components(adj);
  // (each cycle's cycles below and above, each once)
  const kids = comps.map(() => []), ups = comps.map(() => []);
  comps.forEach((members, c) => {
    const seen = new Set();
    for (const u of members) for (const w of adj[u]) { const d = comp[w]; if (d !== c && !seen.has(d)) { seen.add(d); kids[c].push(d); ups[d].push(c); } }
  });
  const marks = [...new Set(shown)].filter((n) => at.has(n)), own = comps.map(() => []);
  marks.forEach((n, k) => own[comp[at.get(n)]].push(k));
  const counts = bounded(() => counted(comps, kids, ups)), anc = bounded(() => above(ups, own, marks.length));
  // (a set many cycles share is put in order once, so a long chain under many shown nodes is answered in one pass too)
  const sorted = new Map(), inOrder = (set) => {
    if (!sorted.has(set)) { const ks = []; if (set) each(set, (k) => ks.push(k)); sorted.set(set, Object.freeze(ks.sort((a, b) => a - b).map((k) => marks[k]))); }
    return sorted.get(set);
  };
  return {
    brings: (n) => (at.has(n) ? counts?.[comp[at.get(n)]] : 0),
    by: (n) => {
      if (!at.has(n)) return [];
      if (!anc) return undefined;
      const c = comp[at.get(n)], ks = own[c].filter((k) => marks[k] !== n);
      if (!ks.length) return inOrder(anc[c]);
      if (anc[c]) each(anc[c], (k) => ks.push(k));
      return ks.sort((a, b) => a - b).map((k) => marks[k]);
    },
  };
}

// What each cycle brings: its other members and each node of the cycles it leads to, gathered from the sinks up. A
// cycle with one cycle below takes over that one's set where nothing else reads it, and a set is let go once every
// cycle above has read it, so a chain holds one set at a time; one that nothing leads to keeps only its count.
function counted(comps, kids, ups) {
  const C = comps.length, at = new Int32Array(C).fill(-1), weight = [];
  for (let c = 0; c < C; c++) if (ups[c].length) { at[c] = weight.length; weight.push(comps[c].length); }
  const S = sets(weight.length), desc = new Array(C).fill(null), left = ups.map((u) => u.length), counts = new Array(C);
  const read = (d) => { if (--left[d] === 0 && desc[d]) { S.drop(desc[d]); desc[d] = null; } };
  for (let c = 0; c < C; c++) {
    const ks = kids[c], keep = ups[c].length > 0;
    let below = 0;
    if (ks.length === 1) {
      const d = ks[0];
      below = counts[d] + 1;
      if (keep && left[d] === 1) { desc[c] = desc[d] ?? S.make(); desc[d] = null; S.add(desc[c], at[d]); }
      else if (keep) desc[c] = S.union([desc[d]], [at[d]], () => 0).set;
      read(d);
    } else if (ks.length) {
      const { set, grew } = S.union(ks.map((d) => desc[d]), ks.map((d) => at[d]), (i) => weight[i]);
      below = grew;
      if (keep) desc[c] = set; else S.drop(set);
      for (const d of ks) read(d);
    }
    counts[c] = comps[c].length - 1 + below;
  }
  return counts;
}

// The shown nodes that lead to each cycle, passed down from the sources: a cycle whose one cycle above holds no shown
// node shares that one's set, unchanged; any other gathers its own.
function above(ups, own, n) {
  const S = sets(n), anc = new Array(ups.length).fill(null);
  for (let c = ups.length - 1; c >= 0; c--) {
    const ps = ups[c];
    if (ps.length === 1 && !own[ps[0]].length) anc[c] = anc[ps[0]];
    else if (ps.length) anc[c] = S.union(ps.map((p) => anc[p]), ps.flatMap((p) => own[p]), () => 0).set;
  }
  return anc;
}

// Sets of numbers below `size`, each listed while short, as bits once its list would outgrow them, every word read or
// written spent from WORK and every word kept held against ROOM; `union` gives a new set and the weight it gathered.
function sets(size) {
  const W = (size + 31) >>> 5, stamp = new Int32Array(size);
  let room = ROOM, work = WORK, gen = 0;
  const spend = (n) => { if ((work -= n) < 0) throw OVER; };
  const hold = (n) => { spend(n); if ((room -= n) < 0) throw OVER; };
  const make = () => ({ list: [], bits: null });
  // (`add` is given a number the set lacks: by its caller's word, or by the stamp `union` keeps)
  const add = (s, i) => {
    if (s.bits) { spend(1); s.bits[i >>> 5] |= 1 << (i & 31); return; }
    hold(1); s.list.push(i);
    if (s.list.length <= W) return;
    hold(W); s.bits = new Uint32Array(W);
    for (const j of s.list) s.bits[j >>> 5] |= 1 << (j & 31);
    room += s.list.length; s.list = null;
  };
  return {
    make, add,
    drop: (s) => { if (s) room += s.bits ? W : s.list.length; },
    union(sources, extra, weigh) {
      let grew = 0;
      gen++;
      const set = make(), put = (i) => { if (stamp[i] === gen) return; stamp[i] = gen; add(set, i); grew += weigh(i); };
      for (const s of sources) if (s) { spend(s.bits ? W : s.list.length); each(s, put); }
      for (const i of extra) put(i);
      return { set, grew };
    },
  };
}

// Each number of the set `s`, in no set order.
function each(s, fn) {
  if (!s.bits) { for (const i of s.list) fn(i); return; }
  for (let w = 0; w < s.bits.length; w++) for (let x = s.bits[w]; x; x &= x - 1) fn(w * 32 + 31 - Math.clz32(x & -x));
}

const bounded = (f) => { try { return f(); } catch (e) { if (e === OVER) return undefined; throw e; } };

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
