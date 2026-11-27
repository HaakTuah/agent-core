// The files a file of code reaches by listing a folder (#1361, point 25), for the selection's links (select.mjs): a test
// that reads the files of a folder it lists (`fs.readdirSync(path.join(ROOT, "game"))`, `glob("tools/rules/*.js")`,
// `os.listdir("data")`) names none of them, so their names alone never tie it to them. Where a file holds a call that
// lists a folder, it reaches every file under each folder a string of it names whole, by its path from the root or the
// file's own folder (one the file lies in, the root's every file among them, only where it stands on the line
// that lists, and the root where a call is handed `.` or a pattern that starts with a wildcard), or by the last parts of its path ("layout" for tools/layout), a pattern's part before its first
// wildcard; and every file under its own folder where a line that lists one names the file's own place (`__dirname`,
// `import.meta.dirname` or `.url`, `__file__`). It names more, never less: a string that only shares a folder's name
// ties the file to that folder all the same. A folder built from no string the file holds (a path read at run time) it
// cannot tell, and the test's builder names that test under "select.whole" (tasks/tests.md). Node's own modules alone.
import path from "node:path";

// A call that lists a folder, in JavaScript, TypeScript or Python.
const LISTS = /(?<![\w$])(?:readdirSync|readdir|opendirSync|opendir|globSync|glob|globby|fastGlob|listdir|scandir|iterdir|rglob|walk)\s*\(/u;
// A string of the file: its text between quotes, on one line, with no expansion in it.
const STRING = /(["'`])((?:(?!\1)[^\\\n$]|\\.)*)\1/gu;
// The root, where a call is handed it first: `.` or `./`, or a pattern with nothing before its first wildcard
// (`walk(".")`, `glob("**/*.js")`), a string's own methods aside (`parts.join(".")`).
const ROOT = /(?<![\w$])(?!(?:join|split|indexOf|lastIndexOf|includes|startsWith|endsWith|replace|replaceAll|search|match|matchAll|concat|padStart|padEnd|trim|at|test|exec|push|has|get|set|add|log)\s*\()[A-Za-z_$][\w$]*\s*\(\s*(["'`])(?:\.\/?|\*[^"'`$\n]*)\1/u;
// The file's own place.
const OWN = /(?<![\w$])(?:__dirname|__file__|import\.meta\.(?:dirname|url))(?![\w$])/u;

/** Of `files`, the folders they lie in, for `listed`: { by, under }, `by` each folder by its path and each last part of
 *  it, `under` each folder's files at any depth. */
export function folders(files) {
  const by = new Map(), under = new Map();
  for (const f of files) {
    const parts = f.split("/");
    for (let k = 1; k < parts.length; k++) {
      const dir = parts.slice(0, k).join("/");
      if (!under.has(dir)) {
        under.set(dir, []);
        for (let j = 0; j < k; j++) { const tail = parts.slice(j, k).join("/"); if (!by.has(tail)) by.set(tail, []); by.get(tail).push(dir); }
      }
      under.get(dir).push(f);
    }
  }
  under.set(".", [...files]);
  return { by, under };
}

/** The files `file`, of the text `text` (its comments out), reaches by listing a folder, given `folders`' answer. */
export function listed(file, text, { by, under }) {
  const out = new Set(), lines = text.split("\n").filter((l) => LISTS.test(l));
  if (!lines.length) return out;
  const own = path.posix.dirname(file), add = (dir) => { for (const f of under.get(dir) ?? []) if (f !== file) out.add(f); };
  if (lines.some((l) => OWN.test(l))) add(own);
  if (ROOT.test(text)) add(".");
  for (const line of text.split("\n")) for (const [, , s] of line.matchAll(STRING)) for (const dir of named(s, line, own, by, under)) add(dir);
  return out;
}


// The folders a string `s` of `line`, in a file of the folder `own`, names: by its path from the root or from `own`, or
// by its last parts. A pattern names the folder before its first wildcard.
function named(s, line, own, by, under) {
  const wild = s.search(/[*?[{]/u), plain = wild < 0 ? s : s.slice(0, wild).replace(/[^/]*$/u, "");
  const name = path.posix.normalize(plain || ".").replace(/^(?:\.\/|\/)+|\/+$/gu, "");
  const near = path.posix.join(own, name);
  if (name.startsWith("..")) {
    // (a folder the file lies in, the root among them, counts only where the line lists: `ROOT = join(__dirname, "..")` names no folder it lists)
    const holds = near === "." || own.startsWith(`${near}/`);
    return !near.startsWith("..") && (!holds || LISTS.test(line)) ? [near] : [];
  }
  if (!name || name === ".") return [];
  return [...(by.get(name) ?? []), ...(under.has(near) ? [near] : [])];
}
