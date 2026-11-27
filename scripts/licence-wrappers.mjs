// The git clones the licence scan reads through a function that hands its arguments on to git (licence-scan.mjs fails
// them as it does a fetch licence-fetchers.mjs finds): a function the file defines, or one it imports by name from a
// file of the project's that defines and exports it, which passes a parameter of its own to one of Node's calls of
// "git", alone or spread in an array after options; and each call of it by its own name whose arguments make "clone"
// git's subcommand, past git's own options, or, where they cannot be read, hold it. Node's own modules only (none).
import { arrayAt, gitSubcommand, holdsClone, opening, runOn, stringEnd } from "./licence-fetchers.mjs";

const NAME = "[A-Za-z_$][\\w$]*";
// A name as a regular expression matches it, each character read as itself.
const esc = (s) => s.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
// A function's start: `const n = (`, `const n = function (`, `const n = p =>`, or `function n(`, exported or not.
const DEFINE = new RegExp(String.raw`(?<![\w$.#])(export\s+)?(?:(?:const|let|var)\s+(${NAME})\s*=\s*(?:async\s+)?(?:(?:function\b\s*\*?\s*(?:${NAME})?\s*)?(\()|(${NAME})\s*=>)|(?:async\s+)?function\s*\*?\s*(${NAME})\s*(\())`, "gu");
// A call of one of Node's that run a program, of "git" by that name or a path ending in it, up to its second argument.
const GIT_CALL = new RegExp(String.raw`(?<![\w$#])(?:execFileSync|execFile|spawnSync|spawn)\s*\(\s*(["'\x60])(?:[^"'\x60\s]*[/\\])?git\1\s*,\s*`, "gu");
// What changes a parameter's arguments before they reach git.
const changes = (p, body) => new RegExp(String.raw`(?<![\w$.])${esc(p)}\s*(?:(?:[-+*]|\?\?|\|\||&&)?=(?!=)|\+\+|--|\[[^\]]*\]\s*=(?!=)|\.\s*(?:unshift|splice|shift|reverse|sort|fill|copyWithin)\b)`, "u").test(body);

// The words after which a "/" opens a regular expression, not a division, and those whose condition's ")" it follows.
const BEFORE_REGEX = /(?:^|[^\w$.])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/u;
const BEFORE_CONDITION = /(?:^|[^\w$.])(?:if|while|for|with)\s*$/u;
// The place of the last character before text[i] that is not a space.
const lastCode = (text, i) => i - 1 - /\s*$/u.exec(text.slice(Math.max(0, i - 200), i))[0].length;
// Whether a "/" after the code that ends at text[last] (comments read past) divides: after a name, a number, a closing
// bracket but a condition's ")", or a string; or null where it cannot be told, after "++" or "--", or after a ")" whose
// "(" cannot be found by brackets alone.
function divides(text, last) {
  const before = text.slice(Math.max(0, last - 19), last + 1);
  if (/(?:\+\+|--)$/u.test(before)) return null;
  if (!/[\w$)\]'"\x60]$/u.test(before) || BEFORE_REGEX.test(before)) return false;
  if (text[last] !== ")") return true;
  const open = openOf(text, last);
  return open < 0 ? null : !BEFORE_CONDITION.test(text.slice(Math.max(0, open - 20), open));
}
// The "(" that the ")" at text[i] closes, read back by brackets alone, or -1 where a string, comment or "/" stands between.
function openOf(text, i) {
  for (let depth = 0; i >= 0; i--) {
    if ("'\"`/".includes(text[i])) return -1;
    if (")]}".includes(text[i])) depth++;
    else if ("([{".includes(text[i]) && --depth === 0) return i;
  }
  return -1;
}
// The place of the last character of what opens at the "/" text[i], after the code that ends at text[last]: the "/"
// itself where it divides, else the "/" that closes its regular expression on that line, or -1 where none does or
// `divides` cannot tell.
function slashEnd(text, i, last) {
  const div = divides(text, last);
  if (div !== false) return div ? i : -1;
  for (let j = i + 1, inClass = false; j < text.length && text[j] !== "\n"; j++) {
    if (text[j] === "\\") j++;
    else if (text[j] === "[") inClass = true;
    else if (text[j] === "]") inClass = false;
    else if (text[j] === "/" && !inClass) return j;
  }
  return -1;
}
// The place of the last character of the string, template, comment or regular expression that opens at text[i], after
// the code that ends at text[last], or -1 where it cannot be read exactly.
function skipped(text, i, last) {
  if (text.startsWith("//", i)) return text.indexOf("\n", i) - 1;
  if (text.startsWith("/*", i)) { const end = text.indexOf("*/", i + 2); return end < 0 ? -1 : end + 1; }
  return text[i] === "/" ? slashEnd(text, i, last) : stringEnd(text, i, (t, j) => codeEnd(t, j, false));
}
// The place where code that starts at text[i] ends, its strings, comments and regular expressions read past: after
// the "}" of the block that opens there where `block`, else at the first ",", ";" or closing bracket at its own depth;
// or -1 where it cannot be read exactly.
function codeEnd(text, i, block) {
  for (let depth = 0, last = lastCode(text, i); i < text.length; i++) {
    const ch = text[i], note = ch === "/" && "/*".includes(text[i + 1]);
    if (!block && !depth && ",;)]}".includes(ch)) return i;
    if ("'\"`/".includes(ch)) { i = skipped(text, i, last); if (i < 0) return -1; }
    else if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch) && --depth === 0 && block) return i + 1;
    else if (depth < 0) return -1;
    if (!note && !/\s/u.test(ch)) last = i;
  }
  return -1;
}

// The array a name of the file holds, `const n = [...]`, as arrayAt reads it, or null where it is not one written so once.
function constArray(text, name) {
  const at = [...text.matchAll(new RegExp(String.raw`(?<![\w$.])(?:const|let|var)\s+${esc(name)}\s*=\s*\[`, "gu"))];
  return at.length === 1 ? arrayAt(text, at[0].index + at[0][0].length - 1)?.args ?? null : null;
}

// What the git call at text[i] (its second argument's place) hands on of the parameters `params`: the place of the
// parameter, whether it is a rest parameter, and the arguments before it, strings or a name the file holds as an array
// of strings; or null where it hands on none exactly.
function handsOn(text, i, params) {
  // (a parameter read by "." or "?." there, as `args.filter(Boolean)`, is handed on loosely)
  const alone = new RegExp(String.raw`^(${NAME})\s*([,)]|\??\.)`, "u").exec(text.slice(i, i + 200));
  if (alone) { const at = params.findIndex((p) => p?.name === alone[1]); return at < 0 ? null : { at, rest: params[at].rest, before: [], loose: alone[2] !== "," && alone[2] !== ")" }; }
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
// expression; where it cannot be read to its end, read loosely to the text's end; or null where no body opens there.
function bodyAt(text, i, arrow) {
  const after = /^\s*(=>)?\s*/u.exec(text.slice(i, i + 400)), start = i + after[0].length;
  if (arrow !== Boolean(after[1]) || (!arrow && text[start] !== "{")) return null;
  const end = codeEnd(text, start, text[start] === "{");
  return end < 0 ? { start, end: text.length, loose: true } : { start, end, loose: false };
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
      // (one whose parameter is changed before it reaches git, or whose body cannot be read, is read loosely: each call
      // that holds "clone" is a clone)
      if (hand) { out.set(name, { ...hand, loose: hand.loose || body.loose || changes(params[hand.at].name, inside), exported: Boolean(m[1]) || exportsName(text, name) }); break; }
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

// Whether the arguments that open at text[i], which cannot be read, cannot be read to their end either, or hold "clone"
// as a string up to the later of their end and the next ";", or the text's end where none follows.
const unread = (text, i) => { const end = codeEnd(text, i, true), semi = text.indexOf(";", i); return end < 0 || /['"`]clone['"`]/u.test(text.slice(i, Math.max(end, semi < 0 ? text.length : semi))); };

/** Each git clone in `text`, of the file `f` (a path from the project's root), by a function that hands its arguments
 *  on to git (above), as otherFetches gives a fetch: its line and those that run on to it, spaces run together. A call
 *  whose git subcommand cannot be read is one where its arguments hold "clone", and one whose arguments cannot be
 *  read, where the function holds "clone" before them, or as `unread` says. */
export function wrapperFetches(text, f = "", read = () => null) {
  const found = [], all = new Map([...imported(text, f, read), ...wrappers(text)]);
  for (const [name, w] of all) {
    for (const call of text.matchAll(new RegExp(String.raw`(?<![\w$.#])${esc(name)}\s*\(`, "gu"))) {
      if (/function\s*\*?\s*$/u.test(text.slice(Math.max(0, call.index - 40), call.index))) continue;
      const list = arrayAt(text, call.index + call[0].length - 1, ")"), args = list?.args, given = args?.[w.at];
      const handed = w.rest ? args?.slice(w.at) : given?.kind === "other" && given.raw.startsWith("[") ? arrayAt(given.raw, 0)?.args : null;
      const sub = handed && !w.loose ? gitSubcommand([...w.before, ...handed]) : null;
      if (sub === "clone" || (sub === null && (args ? holdsClone([...w.before, ...(handed ?? args)]) : holdsClone(w.before) || unread(text, call.index + call[0].length - 1)))) found.push(call.index);
    }
  }
  return found.sort((a, b) => a - b).map((i) => runOn(text, i).replace(/\s+/gu, " ").trim());
}
