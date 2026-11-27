// The files a file of code reaches by listing a folder (#1361, point 25), for the selection's links (select-reach.mjs): a test
// that reads the files of a folder it lists (`fs.readdirSync(path.join(ROOT, "game"))`, `glob("tools/rules/*.js")`,
// `os.listdir("data")`) names none of them, so their names alone never tie it to them. Where a file holds a call of
// LISTS below, it reaches every file under each folder a string of it names whole: by its path from the root or from
// the file's own folder, `..` resolved, or by the last parts of its path ("layout" for tools/layout); a pattern by its
// part before its first wildcard; the literal pieces of a template literal or a Python f-string each as a string of
// its own. The root counts where a call is handed `.`, `./` or a pattern that starts with a wildcard; the file's own
// folder where a line that lists names its own place (`__dirname`, `import.meta.dirname` or `.url`, `__file__`); a
// folder the file lies in, the root among them, only where the line that lists names it, so
// `ROOT = path.join(__dirname, "..")` then `readdirSync(ROOT)` reaches no folder. It names more, never less: a string
// that only shares a folder's name ties the file to that folder all the same. What it cannot tell (a folder built from
// no string the file holds, a call not in LISTS, a string longer than twice the longest path, read as naming none) the
// test's builder names under "select.whole" (tasks/tests.md). Node's own modules alone.
import path from "node:path";

// A call that lists a folder, in JavaScript, TypeScript or Python.
const LISTS = /(?<![\w$])(?:readdirSync|readdir|opendirSync|opendir|globSync|glob|globby|fastGlob|fg|(?:glob|globby|fastGlob|fg)\.sync|listdir|scandir|iterdir|rglob|walk)\s*\(/u;
// A string of the file: its text between quotes, on one line, and before it a Python f-string's prefix, if any.
const STRING = /((?<![\w$])(?:[rR]?[fF]|[fF][rR]))?(["'`])((?:(?!\2)[^\\\n]|\\.)*)\2/gu;
// The root, where a call is handed it first: `.` or `./`, or a pattern with nothing before its first wildcard
// (`walk(".")`, `glob("**/*.js")`), a string's own methods aside (`parts.join(".")`).
const ROOT = /(?<![\w$])(?!(?:join|split|indexOf|lastIndexOf|includes|startsWith|endsWith|replace|replaceAll|search|match|matchAll|concat|padStart|padEnd|trim|at|test|exec|push|has|get|set|add|log)\s*\()[A-Za-z_$][\w$]*\s*\(\s*(["'`])(?:\.\/?|\*[^"'`$\n]*)\1/u;
// The file's own place.
const OWN = /(?<![\w$])(?:__dirname|__file__|import\.meta\.(?:dirname|url))(?![\w$])/u;

/** Of `files`, the folders they lie in, for `listed`: { by, under, pace }, `by` each folder by its last part, `under`
 *  each folder's files at any depth. `pace` is asked for each folder and each file, and again by `listed`, so a path of
 *  many folders runs the whole suite at the budget (SECURITY.md, rule 5): a folder named by its last parts is matched
 *  where it is looked up, not each tail held, which took time in step with the cube of a path's depth. */
export function folders(files, pace = () => {}) {
  const by = new Map(), under = new Map();
  let long = 0;
  for (const f of files) {
    pace();
    long = Math.max(long, f.length);
    const parts = f.split("/");
    let dir = "";
    for (let k = 1; k < parts.length; k++) {
      dir = k === 1 ? parts[0] : `${dir}/${parts[k - 1]}`;
      if (!under.has(dir)) {
        pace();
        under.set(dir, []);
        if (!by.has(parts[k - 1])) by.set(parts[k - 1], []);
        by.get(parts[k - 1]).push(dir);
      }
      under.get(dir).push(f);
    }
  }
  under.set(".", [...files]);
  return { by, under, pace, long };
}

/** The files `file`, of the text `text` (its comments out), reaches by listing a folder, given `folders`' answer. */
export function listed(file, text, { by, under, pace = () => {}, long = 0 }) {
  const out = new Set(), all = text.split("\n"), lines = all.filter((l) => LISTS.test(l));
  if (!lines.length) return out;
  // (each folder named is taken once, however many strings name it; a string longer than any path can name, past
  // twice the longest and 64 more for `..` and `./`, names none, so resolving it never takes time in step with its square)
  const own = path.posix.dirname(file), dirs = new Set(), most = 2 * long + 64;
  if (lines.some((l) => OWN.test(l))) dirs.add(own);
  if (ROOT.test(text)) dirs.add(".");
  for (const line of all) for (const [, f, q, s] of line.matchAll(STRING)) {
    pace();
    if (s.length > most) continue;
    const pieces = q === "`" ? s.split(/\$\{[^}]*\}/u) : f ? s.split(/\{[^}]*\}/u) : [s];
    for (const piece of pieces) for (const dir of named(piece, line, own, by, under, pace)) dirs.add(dir);
  }
  for (const dir of dirs) { pace(); for (const f of under.get(dir) ?? []) if (f !== file) out.add(f); }
  return out;
}

// The folders a string `s` of `line`, in a file of the folder `own`, names: by its path from the root or from `own`, or
// by its last parts. A pattern names the folder before its first wildcard.
function named(s, line, own, by, under, pace) {
  const wild = s.search(/[*?[{]/u), plain = wild < 0 ? s : s.slice(0, wild).replace(/[^/]*$/u, "");
  const name = path.posix.normalize(plain || ".").replace(/^(?:\.\/|\/)+|\/+$/gu, "");
  const near = path.posix.join(own, name);
  if (name.startsWith("..")) {
    // (a folder the file lies in, the root among them, counts only where the line lists: `ROOT = join(__dirname, "..")` names no folder it lists)
    const holds = near === "." || own.startsWith(`${near}/`);
    return !near.startsWith("..") && (!holds || LISTS.test(line)) ? [near] : [];
  }
  if (!name || name === ".") return [];
  const last = name.slice(name.lastIndexOf("/") + 1), tails = (by.get(last) ?? []).filter((d) => { pace(); return d === name || d.endsWith(`/${name}`); });
  return [...tails, ...(under.has(near) ? [near] : [])];
}
