// The delegates a file of C# declares, for the test selection (select-csharp.mjs; #675), read on the parser's tokens as
// the namespaces they stand in go, with the pairs of brackets the reading of a using directive asks too.

export const word = k => k.v.replace(/^@/u, "");
export const join = (a, b) => (a ? `${a}.${b}` : b);

// Where each "(" and "<" of a file's tokens closes (a Map of its place to that of its ")" or ">"), and at each place
// the next ";" (semi); read once per file.
const paired = new WeakMap(), SHUT = { __proto__: null, ")": "(", ">": "<" };
export function pairs(toks) {
  if (paired.has(toks)) return paired.get(toks);
  const close = new Map(), open = { "(": [], "<": [] }, semi = new Int32Array(toks.length + 1).fill(toks.length);
  toks.forEach((t, k) => { if (t.v === "(" || t.v === "<") open[t.v].push(k); else if (open[SHUT[t.v]]?.length) close.set(open[SHUT[t.v]].pop(), k); });
  for (let k = toks.length - 1; k >= 0; k--) semi[k] = toks[k].v === ";" ? k : semi[k + 1];
  paired.set(toks, Object.assign(close, { semi }));
  return paired.get(toks);
}

// The delegates a file declares, by their full names: `delegate` then a return type (an anonymous delegate, "delegate {"
// or "delegate (…) {", and a function pointer, "delegate*", declare none; "delegate ref (int X, int Y) P()" returns a
// tuple), each in the namespace it stands in, read from the tokens as they go (namespaces). Each scan goes on where
// the last stopped (pairs): linear in the tokens, and a namespace's full name is made once, where a delegate stands.
export function delegates(r, pace) {
  const toks = r.toks, out = [], within = namespaces(toks, new Set(r.namespaces), pace);
  for (let i = 0; i < toks.length; i++) {
    const next = within.step(i);
    if (next !== i) { i = next; continue; }
    if (toks[i].v !== "delegate" || ["{", "*"].includes(toks[i + 1]?.v)) continue;
    let s = i + 1;
    while (["ref", "readonly"].includes(toks[s]?.v)) s++;
    const start = toks[s]?.v === "(" ? (pairs(toks).get(s) ?? toks.length - 1) + 1 : s;
    if (toks[start]?.v === "{") continue;
    const { name, end } = delegateName(toks, start);
    if (name) out.push(join(within.name(), name));
    i = Math.max(i, end - 1);
  }
  return out;
}

// The namespace a scan of a file's tokens stands in: step(i) reads the token at i, a brace or a namespace's head, and
// gives where the scan goes on (i, or past the head); name() the full name where it stands. The tokens drop an escaped
// word's "@", so "namespace" heads a namespace only at a namespace's own level, not after a ".", and naming one the
// grammar declared (`known`): `class C { @namespace field; }` declares none. `pace` is asked at each head.
function namespaces(toks, known, pace) {
  const open = [];
  let depth = 0, file = { full: "" };
  return {
    name: () => (open.at(-1) ?? file).full,
    step(i) {
      const v = toks[i].v;
      if (v === "{") depth++;
      else if (v === "}") { depth--; while (open.at(-1)?.depth > depth) open.pop(); }
      else if (v === "namespace" && depth === (open.at(-1)?.depth ?? 0) && toks[i - 1]?.v !== ".") {
        pace();
        const { name, end } = dotted(toks, i + 1), whole = join((open.at(-1) ?? file).full, name);
        if (toks[end]?.v === ";" && known.has(name)) file = { full: name };
        else if (toks[end]?.v === "{" && known.has(whole)) open.push({ full: whole, depth: ++depth });
        else return i;
        return end;
      }
      return i;
    },
  };
}

// A dotted name from `k` on ("App.Rules"), and where it ended.
function dotted(toks, k) {
  const parts = [];
  for (; toks[k]?.t === "id"; k += 2) { parts.push(word(toks[k])); if (toks[k + 1]?.v !== ".") { k++; break; } }
  return { name: parts.join("."), end: k };
}

// A delegate's name, from its return type at `k` on (the last word before "(" outside the type's "<>"), and where
// the scan ended (a ";", "{" or "}": `@delegate` reads as the keyword, and `new[] { @delegate }` declares none).
function delegateName(toks, k) {
  let depth = 0, name = null;
  for (; k < toks.length && ![";", "{", "}"].includes(toks[k].v); k++) {
    const v = toks[k].v;
    if (v === "<") depth++;
    else if (v === ">") depth--;
    else if (v === "(" && depth === 0) break;
    else if (toks[k].t === "id" && depth === 0) name = word(toks[k]);
  }
  return { name, end: k };
}
