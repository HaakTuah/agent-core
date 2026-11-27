// The git clones the licence scan reads through a function that hands its arguments on to git (licence-scan.mjs fails
// them as it does a fetch licence-fetchers.mjs finds): a function the file defines, or one it imports by name from a
// file of the project's that defines and exports it, which passes a parameter of its own to one of Node's calls of
// "git", alone or spread in an array after options; and each call of it by its own name whose arguments make "clone"
// git's subcommand, past git's own options. Node's own modules only (none).
import { arrayAt, gitSubcommand, opening, runOn, stringEnd } from "./licence-fetchers.mjs";

const NAME = "[A-Za-z_$][\\w$]*";
// A function's start: `const n = (`, `const n = function (`, `const n = p =>`, or `function n(`, exported or not.
const DEFINE = new RegExp(String.raw`(?<![\w$.#])(export\s+)?(?:(?:const|let|var)\s+(${NAME})\s*=\s*(?:async\s+)?(?:(?:function\b\s*\*?\s*(?:${NAME})?\s*)?(\()|(${NAME})\s*=>)|(?:async\s+)?function\s*\*?\s*(${NAME})\s*(\())`, "gu");
// A call of one of Node's that run a program, of "git" by that name or a path ending in it, up to its second argument.
const GIT_CALL = new RegExp(String.raw`(?<![\w$#])(?:execFileSync|execFile|spawnSync|spawn)\s*\(\s*(["'\x60])(?:[^"'\x60\s]*[/\\])?git\1\s*,\s*`, "gu"), GIT_AT = new RegExp(GIT_CALL.source, "uy");
// What changes a parameter's arguments before they reach git.
const changes = (p, body) => new RegExp(String.raw`(?<![\w$.])${p.replace(/\$/gu, "\\$")}\s*(?:(?:[-+*]|\?\?|\|\||&&)?=(?!=)|\+\+|--|\[[^\]]*\]\s*=(?!=)|\.\s*(?:unshift|splice|shift|reverse|sort|fill|copyWithin)\b)`, "u").test(body);

// The place after the "}" of the block that opens at text[i], its strings and comments read past, or -1 where it
// cannot be read exactly (a "/" outside a string or comment).
function blockEnd(text, i) {
  for (let depth = 0; i < text.length; i++) {
    const ch = text[i];
    if ("'\"`".includes(ch)) { i = stringEnd(text, i); if (i < 0) return -1; }
    else if (text.startsWith("//", i)) { i = text.indexOf("\n", i); if (i < 0) return -1; }
    else if (text.startsWith("/*", i)) { i = text.indexOf("*/", i + 2) + 1; if (i <= 0) return -1; }
    else if (ch === "/") return -1;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return i + 1;
  }
  return -1;
}

// The array a name of the file holds, `const n = [...]`, as arrayAt reads it, or null where it is not one written so once.
function constArray(text, name) {
  const at = [...text.matchAll(new RegExp(String.raw`(?<![\w$.])(?:const|let|var)\s+${name.replace(/\$/gu, "\\$")}\s*=\s*\[`, "gu"))];
  return at.length === 1 ? arrayAt(text, at[0].index + at[0][0].length - 1)?.args ?? null : null;
}

// What the git call at text[i] (its second argument's place) hands on of the parameters `params`: the place of the
// parameter, whether it is a rest parameter, and the arguments before it, strings or a name the file holds as an array
// of strings; or null where it hands on none exactly.
function handsOn(text, i, params) {
  const alone = new RegExp(String.raw`^(${NAME})\s*[,)]`, "u").exec(text.slice(i));
  if (alone) { const at = params.findIndex((p) => p?.name === alone[1]); return at < 0 ? null : { at, rest: params[at].rest, before: [] }; }
  const array = text[i] === "[" ? arrayAt(text, i) : null, before = [];
  for (const a of array?.args ?? []) {
    const spread = a.kind === "spread" && new RegExp(String.raw`^\.\.\.\s*(${NAME})$`, "u").exec(a.raw)?.[1];
    const at = spread ? params.findIndex((p) => p?.name === spread) : -1;
    if (at >= 0) return { at, rest: params[at].rest, before };
    const held = spread ? constArray(text, spread) : null;
    if (a.kind === "text") before.push(a);
    else if (held?.every((h) => h.kind === "text")) before.push(...held);
    else return null;
  }
  return null;
}

// The body of the function whose parameters' list closes at text[i]: its start and end, a block or, after "=>", an
// expression, which must open with a call of git (above) to be read; or null where it cannot be read exactly.
function bodyAt(text, i, arrow) {
  const after = /^\s*(=>)?\s*/u.exec(text.slice(i)), start = i + after[0].length;
  if (arrow !== Boolean(after[1])) return null;
  if (text[start] === "{") { const end = blockEnd(text, start); return end < 0 ? null : { start, end }; }
  if (!arrow) return null;
  GIT_AT.lastIndex = start;
  const close = GIT_AT.test(text) && arrayAt(text, text.indexOf("(", start), ")");
  return close ? { start, end: close.end } : null;
}

/** The functions `text` defines that hand a parameter of their own on to git (above), each by its name: the place of
 *  the parameter, whether it is a rest parameter, the arguments before it, and whether it is exported. */
export function wrappers(text) {
  const out = new Map();
  for (const m of text.matchAll(DEFINE)) {
    const name = m[2] ?? m[5], open = m[3] || m[6] ? m.index + m[0].length - 1 : -1, arrow = !m[5] && !/function/u.test(m[0]);
    const list = open >= 0 ? arrayAt(text, open, ")") : { args: [{ kind: "other", raw: m[4] }], end: m.index + m[0].length - 2 };
    const body = list && bodyAt(text, list.end, arrow);
    if (!body) continue;
    const params = list.args.map((a) => { const p = /^(\.\.\.)?\s*([A-Za-z_$][\w$]*)\s*(?:=|$)/u.exec(a.raw ?? ""); return p && { name: p[2], rest: Boolean(p[1]) }; });
    const inside = text.slice(body.start, body.end);
    for (const call of inside.matchAll(GIT_CALL)) {
      const hand = handsOn(text, body.start + call.index + call[0].length, params);
      if (hand && !changes(params[hand.at].name, inside)) { out.set(name, { ...hand, exported: Boolean(m[1]) || exportsName(text, name) }); break; }
    }
  }
  return out;
}
const exportsName = (text, name) => [...text.matchAll(/(?<![\w$.])export\s*\{([^}]*)\}/gu)].some((e) => e[1].split(",").some((n) => n.trim() === name));

// The functions `text` takes from a file of the project's (`import { a, b as c } from "./x.mjs"` in its opening) that
// hand a parameter on to git there, each by the name it is called by here; `read` gives the text of the file `f`
// imports as a path, or null.
function imported(text, f, read) {
  const out = new Map(), dir = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "";
  for (const line of opening(text).imports) {
    const m = /^import\s*\{([^}]*)\}\s*from\s*["'](\.{1,2}\/[^"'\n]+)["'];?$/u.exec(line), at = m && normal(`${dir}/${m[2]}`), there = at && read(at);
    if (!there) continue;
    const theirs = wrappers(there);
    for (const entry of m[1].split(",")) {
      const [was, as = was] = entry.trim().split(/\s+as\s+/u), w = theirs.get(was);
      if (w?.exported) out.set(as, w);
    }
  }
  return out;
}
// A path of the project's from its root, its "." and ".." parts read, or null where it leads out of the project.
function normal(p) {
  const parts = [];
  for (const part of p.split("/")) if (part === "..") { if (!parts.length) return null; parts.pop(); } else if (part && part !== ".") parts.push(part);
  return parts.join("/");
}

/** Each git clone in `text`, of the file `f` (a path from the project's root), by a function that hands its arguments
 *  on to git (above), as otherFetches gives a fetch: its line and those that run on to it, spaces run together. */
export function wrapperFetches(text, f = "", read = () => null) {
  const found = [], all = new Map([...imported(text, f, read), ...wrappers(text)]);
  for (const [name, w] of all) {
    for (const call of text.matchAll(new RegExp(String.raw`(?<![\w$.#])${name.replace(/\$/gu, "\\$")}\s*\(`, "gu"))) {
      if (/function\s*\*?\s*$/u.test(text.slice(0, call.index))) continue;
      const args = arrayAt(text, call.index + call[0].length - 1, ")")?.args, given = args?.[w.at];
      const handed = w.rest ? args?.slice(w.at) : given?.kind === "other" && given.raw.startsWith("[") ? arrayAt(given.raw, 0)?.args : null;
      if (handed && gitSubcommand([...w.before, ...handed]) === "clone") found.push(call.index);
    }
  }
  return found.sort((a, b) => a - b).map((i) => runOn(text, i).replace(/\s+/gu, " ").trim());
}
