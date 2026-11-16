// Where a hook's command takes the project's files from (floor rule 3: what an agent tool starts by itself runs from
// its copy on `main`; agent-tools.mjs). The starter kit's hooks fetch the script they run from the remote's `main`
// (`git show refs/remotes/origin/main:<path>`), which a session's branch cannot change; a hook that names a file the
// project holds otherwise runs or reads the working tree's copy, which the branch it runs on can change.
//
// What it reads, two ways, and no more. Each word of the command that names a file the project holds, as the command
// writes it (relative to the project's root, or after a variable such as $CLAUDE_PROJECT_DIR or "$r"), and each quoted
// text so; and, given the list of the project's files, each of them wherever its path stands in the command whole (not
// within a longer name), as written, with the shell's backslashes read, and with its quotes taken out too, so that no
// quoting hides it. A path written `<ref>:<path>` names the copy git holds at that ref, the remote's `main`
// (refs/remotes/origin/main or origin/main) being the one that counts as `main`; and a file only tested for
// (`[ -f <path> ]`, `test -e <path>`) is neither run nor read. A path the command builds from parts, reaches by changing
// folder, or names under another spelling (through ".." past a link, say) is not read here, and stays the review's.
// Node's own modules only.
//
//   import { fromTree, pathsIndex } from "./hook-source.mjs";
//   fromTree(command, holds, index) -> the paths it takes from the working tree, where holds(path) says the project
//                                      holds one and index, pathsIndex(the project's files), lists them
import path from "node:path";
import { inProject } from "./guards.mjs";

const WORD = /[^\s'"`;|&()<>{}$\\=,\u0001]+/gu;
const MAIN = /^(?:refs\/remotes\/)?origin\/main$/u;
// (a variable, as the shell, cmd and PowerShell write one, read as one mark: what it holds is not the command's text)
const VARIABLE = /\$env:\w+|\$\{[^}]*\}|\$\w+|%\w+%/gu;
// (what stands before a word that only tests a file: "[", "[[" or "test" where a command starts (at the start, after
// ";", "&", "|", "(", "{" or "!", after a quote that opens, or after a keyword such as "then"), perhaps after "!", then
// a test's operator, perhaps a quote and a variable; an option of another program, as node's -r, is no test, nor is
// "test" given to another program, as in "go test -v")
const TESTED = /(?:^|[;&|({!]|(?:^|[\s=])\\?["']|(?:^|\s)(?:if|then|else|elif|while|until|do))[ \t]*(?:![ \t]+)?(?:\[\[?|test)[ \t]+(?:![ \t]+)?-[A-Za-z][ \t]+\\?["']?\u0001?\\?["']?$/u;
// (what stands before a path read from the project's root: a variable or a command's output, as $(git rev-parse
// --show-toplevel), perhaps closed by a quote)
const ROOTED = /[\u0001)]\\?["']?$/u;

// The quoted texts of a script, read left to right as the shell reads them: a single-quoted text is taken as written, a
// double-quoted one with its backslashes read, and a backslash outside quotes keeps the next character; each quoted text
// is read again as a script of its own, as bash -c '...' runs one, a few levels deep. Each is [its text, what stood
// before it]; a text holding a blank is a name a word alone would split, as "scripts/my hook.sh".
function quotedTexts(script, depth = 0, out = []) {
  if (depth > 4) return out;
  for (let i = 0; i < script.length; i++) {
    const c = script[i];
    if (c === "\\") { i++; continue; }
    if (c !== "'" && c !== '"') continue;
    let j = i + 1, body = "";
    for (; j < script.length && script[j] !== c; j++) {
      if (c === '"' && script[j] === "\\" && j + 1 < script.length) j++;
      body += script[j];
    }
    // (a quote never closed opens nothing, and reading goes on after it; an apostrophe in a comment or a here-document
    // that a later quote of its kind closes is read as a pair, which the shell would not, and stays the review's)
    if (j >= script.length) continue;
    out.push([body, script.slice(Math.max(0, i - 200), i)]);
    quotedTexts(body, depth + 1, out);
    i = j;
  }
  return out;
}
// (a word whose blanks a backslash keeps, as scripts/my\ hook.sh: each word read whole, once, and kept where it holds one)
const ESCAPED = /(?:[^\s'"`;|&()<>{}$\\=,\u0001]|\\ )+/gu;

// The project's files as a tree of their paths' characters, for finding each wherever it stands in a command.
export function pathsIndex(files) {
  const root = new Map();
  for (const f of files) {
    let node = root;
    for (const c of f) { if (!node.has(c)) node.set(c, new Map()); node = node.get(c); }
    node.set("", true);
  }
  return root;
}
const NAME = /[\w.-]/u;
// (where a path may start: at the start, after a character no name holds, or after "./" or a root's "/" there)
const STARTS = /(?:^|[^\w./-])(?:\.\/|[\u0001)]["']?\/+)?$/u;
const FETCHED = /(?:refs\/remotes\/)?origin\/main:["']?$/u;
// A script with one level of the shell's quoting read, as the shell reads it before running it: a single-quoted text
// (and $'...', its backslashes read) as written, a double-quoted one and a word outside quotes with their backslashes
// read, the quotes themselves gone; a quote never closed runs to the end.
function dequote(s) {
  let out = "";
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === "\\") { out += s[i + 1] ?? ""; i += 2; continue; }
    const ansi = c === "$" && s[i + 1] === "'";
    if (c !== "'" && c !== '"' && !ansi) { out += c; i++; continue; }
    const q = ansi ? "'" : c;
    for (i += ansi ? 2 : 1; i < s.length && s[i] !== q; i++) {
      if (q === '"' || ansi) { if (s[i] === "\\" && i + 1 < s.length) i++; }
      out += s[i];
    }
    i++;
  }
  return out;
}

// Each of the project's files whose path stands whole in `text`, not fetched from main nor only tested for, into `found`.
function scan(text, index, holds, found) {
  for (let i = 0; i < text.length; i++) {
    if (i > 0 && NAME.test(text[i - 1]) && text[i - 1] !== "/") continue;
    let node = index;
    for (let j = i; j < text.length && (node = node.get(text[j])); j++) {
      if (!node.has("") || (j + 1 < text.length && /[\w./-]/u.test(text[j + 1]))) continue;
      const at = text.slice(i, j + 1);
      if (found.has(at)) continue;
      const before = text.slice(Math.max(0, i - 200), i);
      // (a root's "/" before a tested path is the test's: "[ -f "$r/x" ]")
      if (STARTS.test(before) && !FETCHED.test(before) && !TESTED.test(before.replace(/\/+$/u, "")) && holds(at)) found.add(at);
    }
  }
}

export function fromTree(command, holds, index = null) {
  const raw = String(command).replace(VARIABLE, "\u0001");
  // (a backslash before a name's letter is Windows' separator; one before a quote, a blank or a "$" is the shell's escape)
  const text = raw.replace(/\\(?=[\w.%-])/gu, "/");
  const found = new Set();
  const take = (word, before, quoted = false) => {
    const colon = word.lastIndexOf(":"), ref = colon > 0 ? word.slice(0, colon) : null;
    let p = colon >= 0 ? word.slice(colon + 1) : word;
    if ((ref !== null && MAIN.test(ref)) || (ref === null && (TESTED.test(before) || FETCHED.test(before)))) return;
    // (a path after a variable is read from the project's root, which is what such a variable holds in a hook)
    if (quoted && /^(?:\u0001|\$\([^)]*\))\/+/u.test(p)) p = p.replace(/^(?:\u0001|\$\([^)]*\))\/+/u, "");
    else if (p.startsWith("/")) { if (ref !== null || !ROOTED.test(before)) return; p = p.replace(/^\/+/u, ""); }
    if (!inProject(p)) return;
    const at = path.posix.normalize(p);
    if (at !== "." && holds(at)) found.add(at);
  };
  for (const m of text.matchAll(WORD)) take(m[0], text.slice(Math.max(0, m.index - 200), m.index));
  for (const m of text.matchAll(ESCAPED)) if (m[0].includes("\\ ")) take(m[0].replace(/\\ /gu, " "), text.slice(Math.max(0, m.index - 200), m.index));
  for (const [body, before] of quotedTexts(raw)) take(body.replace(/\\(?=[\w.%-])/gu, "/"), before, true);
  if (index) {
    // (as written, Windows' separators read; with one, two and three levels of the shell's quoting read, as scripts
    // within scripts are; and with every backslash read and every quote taken out)
    const once = dequote(raw), twice = dequote(once);
    for (const variant of [text, once, twice, dequote(twice), raw.replace(/\\(.)/gsu, "$1").replace(/["']/gu, "")]) scan(variant, index, holds, found);
  }
  return [...found];
}
