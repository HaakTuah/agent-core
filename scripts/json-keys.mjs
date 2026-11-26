// Fails a key that stands twice in one object of a JSON file the core reads (#1367): JSON.parse keeps the last and drops
// the first without a word, so a list such as .github/sizes.json reads as two marks while one counts and no one can tell
// which. Every tracked file ending .json is read, but the dated records whose words stay as written (archive/, words/;
// the lists of reports/, which scripts read, are read), lock files, which a tool writes,
// and a link, which may point out of the repository; a file that is no JSON is left to the readers of it. Node's own
// modules only.
//
// Its cases and a run over the tracked files are in tests/parse-errors-test.mjs.
//
//   node scripts/json-keys.mjs [<file> ...]     (no file: those git tracks)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { started } from "./started.mjs";

const SKIP = ["archive/", "words/"];
const LOCKS = /(^|\/)(package-lock|npm-shrinkwrap)\.json$/u;

// A string literal of valid JSON, as the text it stands for.
function decode(literal) {
  try { return JSON.parse(literal); } catch { return literal; }
}

// The index of the quote that closes the string opening at `at`.
function stringEnd(text, at) {
  let j = at + 1;
  while (text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
  return j;
}

// The keys that stand twice in one object of `text`: [{ key, first, again }], the lines of the two. Of text that is no JSON, none.
export function duplicateKeys(text) {
  try { JSON.parse(text); } catch { return []; }
  const found = [], stack = []; // (one { object, keys, key } for each open object or array: whether a key is next)
  let line = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], top = stack[stack.length - 1];
    if (c === "\n") line++;
    else if (c === "{" || c === "[") stack.push({ object: c === "{", keys: new Map(), key: c === "{" });
    else if (c === "}" || c === "]") stack.pop();
    else if (c === ",") { if (top?.object) top.key = true; }
    else if (c === '"') {
      const end = stringEnd(text, i);
      if (top?.object && top.key) {
        const key = decode(text.slice(i, end + 1)), first = top.keys.get(key);
        if (first === undefined) top.keys.set(key, line); else found.push({ key, first, again: line });
        top.key = false;
      }
      i = end;
    }
  }
  return found;
}

// A key or a file's name as it is said: cut at 80 characters, all but printable ASCII written as "?".
const clip = text => (text.length > 80 ? `${text.slice(0, 80)}...` : text).replace(/[^\x20-\x7e]/gu, "?");

// Of `files`, paths from `root`, those the check reads: no dated record, lock file or link.
export function toRead(root, files) {
  return files.filter(f => f && !SKIP.some(s => f.startsWith(s)) && !LOCKS.test(f))
    .filter(f => { try { return !fs.lstatSync(path.join(root, f)).isSymbolicLink(); } catch { return false; } });
}

// The JSON files git tracks under `root` that the check reads, their paths from `root`.
export function trackedJson(root = process.cwd()) {
  return toRead(root, execFileSync("git", ["ls-files", "-z", "*.json"], { cwd: root, encoding: "utf8" }).split("\0"));
}

// What a file's duplicates say, one failure each, in the form of scripts/mend.mjs.
export function failuresOf(file, text) {
  const name = clip(file);
  return duplicateKeys(text).map(d => `FAIL ${name} holds the key "${clip(d.key)}" twice in one object, at lines ${d.first} and ${d.again}, and JSON.parse keeps only the last. Mend: keep the key once in ${name}, with the value meant, and take the other out; where the two differ, keep the one the readers use now (the last)`);
}

// The top folder of the git repository `cwd` is in, or null where it is in none.
export function repoRoot(cwd = process.cwd()) {
  try { return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; }
}
export const outside = dir => `FAIL ${clip(path.basename(dir) || dir)} is in no git repository, so no tracked JSON file could be read. Mend: run the check from inside the repository, or name the files to read`;

// The files of `files` that stand, read from `root` (a path that is absolute stays itself) and named from it, or by
// their own name where they lie outside it, so that no failure prints a folder above it (floor rule 1), and what their
// duplicates say; a folder named is told with its mend.
export const folder = name => `FAIL ${clip(name)} is a folder, not a JSON file. Mend: name the JSON files in it, or run the check with no names to read every tracked one`;
export function check(root, files) {
  let read = 0;
  const failures = files.flatMap(f => {
    const at = path.resolve(root, f), from = path.relative(root, at), name = from.startsWith("..") || path.isAbsolute(from) ? path.basename(at) : from || f;
    let text;
    try { text = fs.readFileSync(at, "utf8"); } catch (e) { if (e?.code === "ENOENT") return []; if (e?.code === "EISDIR") return [folder(name)]; throw e; }
    read++;
    return failuresOf(name, text);
  });
  return { read, failures };
}

if (started(import.meta.url)) {
  const named = process.argv.slice(2), root = named.length ? process.cwd() : repoRoot();
  if (root === null) { console.error(outside(process.cwd())); process.exit(1); }
  const { read, failures } = check(root, named.length ? named : trackedJson(root));
  for (const line of failures) console.error(line);
  if (failures.length) process.exit(1);
  console.log(`ok   ${read} JSON files hold no key twice in one object`);
}
