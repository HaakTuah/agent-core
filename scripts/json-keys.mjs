// Fails a key that stands twice in one object of a JSON file the core reads (#1367): JSON.parse keeps the last and drops
// the first without a word, so a list such as .github/sizes.json reads as two marks while one counts and no one can tell
// which. Every tracked file ending .json is read, but the dated records (archive/, reports/, words/) and lock files, which a
// tool writes; a file that is no JSON is left to the readers of it. Node's own modules only.
//
// Its cases and a run over the tracked files are in tests/parse-errors-test.mjs.
//
//   node scripts/json-keys.mjs [<file> ...]     (no file: those git tracks)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { started } from "./started.mjs";

const SKIP = ["archive/", "reports/", "words/"];
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

const clip = key => (key.length > 80 ? `${key.slice(0, 80)}...` : key).replace(/[^\x20-\x7e]/gu, "?");

// The JSON files git tracks that the check reads, from the folder it is run in.
export function trackedJson() {
  return execFileSync("git", ["ls-files", "-z", "*.json"], { encoding: "utf8" }).split("\0")
    .filter(f => f && !SKIP.some(s => f.startsWith(s)) && !LOCKS.test(f));
}

// What a file's duplicates say, one failure each, in the form of scripts/mend.mjs.
export function failuresOf(file, text) {
  return duplicateKeys(text).map(d => `FAIL ${file} holds the key "${clip(d.key)}" twice in one object, at lines ${d.first} and ${d.again}, and JSON.parse keeps only the last. Mend: keep the key once in ${file}, with the value meant, and take the other out; where the two differ, keep the one the readers use now (the last)`);
}

if (started(import.meta.url)) {
  let files = process.argv.slice(2);
  if (files.length === 0) files = trackedJson();
  const out = files.flatMap(f => { try { return failuresOf(f, fs.readFileSync(f, "utf8")); } catch (e) { if (e?.code === "ENOENT") return []; throw e; } });
  for (const line of out) console.error(line);
  if (out.length) process.exit(1);
  console.log(`ok   ${files.length} JSON files hold no key twice in one object`);
}
