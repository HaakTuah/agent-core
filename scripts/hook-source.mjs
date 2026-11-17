// Where a hook's command takes the project's files from (floor rule 3: what an agent tool starts by itself runs from
// its copy on `main`; agent-tools.mjs). The starter kit's hooks fetch the script they run from the remote's `main`
// (`git show refs/remotes/origin/main:<path>`), which a session's branch cannot change; a hook that names a file the
// project holds otherwise runs or reads the working tree's copy, which the branch it runs on can change.
//
// Read only where it can be read exactly, two ways and no other. The starter kit's own two forms (KIT_FORMS), whole,
// are the core's: of one, only the plain words after its script are read. A plain command (PLAIN) holds nothing a shell
// reads otherwise than as written: letters, digits, spaces and `_ . / : = @ + , -`; quotes that only group (balanced,
// none within another); and $CLAUDE_PROJECT_DIR outside single quotes, the project's root, as an agent tool sets it.
// A word that sets a variable (PATH=x and the like change which program runs), a path with a ".." (read by the file
// system after the links before it) or one from the root ("/", which may lead into the checkout) makes it no plain
// command. Of a plain command, each word, and each part of a word between spaces (a quoted script given to sh -c) or
// `=`, `:`, `,` and `@`, or after an option's letters (-r./x.rb), that names a file the project holds, at the root or
// in a folder another part names (a folder a program may be told to work in), through a link inside the checkout too,
// as holds() reads it, is taken from the working tree, whatever program it is given to; and so is a file at the
// project's root that a Windows shell runs in the place of its first word. No other
// command is read: fromTree() says so, and agent-tools.mjs notes it, the review's. A shell's own syntax is never read,
// so nothing a reading here could get wrong grants a hook anything. Node's own modules only.
//
//   import { fromTree } from "./hook-source.mjs";
//   fromTree(command, holds, folder) -> the paths it takes from the working tree, where holds(path) says the project
//                               holds a file there and folder(path) a folder; or null, where the command is neither the
//                               kit's nor plain, or would ask too much, and so not read
import path from "node:path";
import { inProject } from "./guards.mjs";

// The starter kit's two forms of a hook's command, whole, as setup/'s templates write them: its script fetched from
// main into "$f" and run, perhaps with plain words after it, and nothing else, the second after one or more tests that a
// file is there or is not; only the paths and those words change.
const KIT_PATH = "[\\w.-]+(?:/[\\w.-]+)*", KIT_ARGS = "((?: [\\w.-]+)*)";
const kitFetch = dir => `f=\\$\\(git -C "${dir}" --no-replace-objects show refs/remotes/origin/main:${KIT_PATH} 2>/dev/null\\)`;
const KIT_FORMS = [
  new RegExp(`^bash -c '${kitFetch("\\$\\{CLAUDE_PROJECT_DIR:-\\.\\}")} \\|\\| (?:exit 0|\\{ echo "[^"'$\`\\\\]*"; exit 0; \\}); (?:bash -c "\\$f"${KIT_ARGS}|node --input-type=module -e "\\$f"())'$`, "u"),
  new RegExp(`^bash -c 'r=\\$\\(git rev-parse --show-toplevel 2>/dev/null\\) \\|\\| exit 0; (?:\\[ (?:! )?-f "\\$r/${KIT_PATH}" \\] \\|\\| exit 0; )+${kitFetch("\\$r")} \\|\\| exit 0; CLAUDE_PROJECT_DIR="\\$r" bash -c "\\$f"${KIT_ARGS}'$`, "u"),
];

// (the project's root, as an agent tool sets it, written so or in braces, and nothing after it that would join its name)
const ROOT = /\$(?:\{CLAUDE_PROJECT_DIR\}|CLAUDE_PROJECT_DIR(?!\w))/uy;
const PLAIN = /^[\w ./:=@+,'"-]*$/u;
// (a word that sets a variable, for the program after it or, through env and the like, for one it runs: PATH and the
// like change which program runs, and no plain reading follows them)
const SETS = /^[A-Za-z_]\w*=/u;
// (a ".." in a path is read by the file system after the links before it, which a plain reading cannot follow)
const PARENT = /(?:^|[/=:,@\s])\.\.(?:$|[/=:,@\s])/u;
// (a file at the project's root that a Windows shell runs in the place of a command's first word, since cmd looks in
// the folder it stands in first)
const RUNS = ["", ".exe", ".bat", ".cmd", ".com", ".ps1", ".js", ".jse", ".vbs", ".vbe", ".wsf", ".wsh", ".msc"];

// A plain command's words, its quotes taken out and $CLAUDE_PROJECT_DIR read as "." where the shell reads it (outside
// single quotes), or null where a quote is never closed or holds the root's name in single quotes, as written.
function words(command) {
  const out = [];
  let word = null, quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (c === "$") {
      const end = rootAt(command, i, quote);
      if (end < 0) return null;
      word = (word ?? "") + ".";
      i = end - 1;
      continue;
    }
    if (quote) { if (c === quote) quote = null; else word += c; continue; }
    if (c === "'" || c === '"') { quote = c; word ??= ""; continue; }
    if (c === " ") { if (word !== null) out.push(word); word = null; continue; }
    word = (word ?? "") + c;
  }
  if (quote) return null;
  if (word !== null) out.push(word);
  return out;
}

// Whether a quote holds a quote of the other kind: quoting for a shell that runs it in turn, as sh -c 'bash "a b"'.
function nested(command) {
  let quote = null;
  for (const c of command) {
    if (c !== "'" && c !== '"') continue;
    if (quote === null) quote = c;
    else if (c === quote) quote = null;
    else return true;
  }
  return false;
}

// Where the root's name that starts at `i` ends, or -1 where none does or it stands in single quotes, written as is.
function rootAt(command, i, quote) {
  ROOT.lastIndex = i;
  return quote !== "'" && ROOT.test(command) ? ROOT.lastIndex : -1;
}

// A word and its parts: whole, at its spaces, as a quoted script given to sh -c holds its words, and at each = : , @.
const parts = word => new Set([word, ...word.split(/ +/u), ...word.split(/[=:,@]/u), ...word.split(/[ =:,@]+/u)]);

// What a part may name: itself and, of an option (-x, +x), each tail from after its signs through its first letters,
// where a program reads a path given to it in the same word (ruby -r./scripts/run.rb, env -Cscripts, gcc -Iinclude).
function readings(part) {
  const option = /^[-+]+(\w*)/u.exec(part);
  if (!option) return [part];
  const out = [part];
  for (let i = option[0].length - option[1].length; i <= option[0].length && i < part.length; i++) out.push(part.slice(i));
  return out;
}

// Each reading of a part that names a file the project holds, at the root or in a folder a program may be told to work
// in: each folder the project holds that a reading names (env -C scripts, make --directory=scripts, -Cscripts),
// wherever it stands in the command and from any such folder in turn, since which of a program's options moves it, and
// to which word after or before, is the program's and not read here. Each path asked costs its length from BUDGET; a
// command that would ask more is not read.
const BUDGET = 1_000_000, OVER = new Error("over its budget");
function named(list, holds, folder) {
  const each = new Set(list.flatMap(word => [...parts(word)]).filter(Boolean).flatMap(readings));
  let spent = 0;
  const at = (dir, part) => {
    spent += 1 + part.length;
    if (spent > BUDGET) throw OVER;
    const p = dir === "." ? part : `${dir}/${part}`;
    return inProject(p) ? path.posix.normalize(p) : ".";
  };
  const folders = new Set(["."]), work = ["."];
  while (work.length) {
    const dir = work.pop();
    for (const part of each) {
      const f = at(dir, part);
      if (f !== "." && !folders.has(f) && folder(f)) { folders.add(f); work.push(f); }
    }
  }
  const found = new Set();
  for (const dir of folders) for (const part of each) { const f = at(dir, part); if (f !== "." && holds(f)) found.add(f); }
  return found;
}

export function fromTree(command, holds, folder) {
  try { return read(String(command), holds, folder); } catch (e) { if (e === OVER) return null; throw e; }
}

function read(text, holds, folder) {
  const kit = KIT_FORMS.map(f => f.exec(text)).find(Boolean);
  if (kit) return [...named((kit[1] ?? "").split(" ").filter(Boolean), holds, folder)];
  if (!PLAIN.test(text.replace(/\$(?:\{CLAUDE_PROJECT_DIR\}|CLAUDE_PROJECT_DIR(?!\w))/gu, ""))) return null;
  const list = nested(text) ? null : words(text);
  // (and a path from the file system's root, which may lead into the checkout from wherever it stands: not read)
  if (list === null || list.some(w => PARENT.test(w) || SETS.test(w) || [...parts(w)].some(p => p.startsWith("/")))) return null;
  const found = named(list, holds, folder);
  // (its first word, as a Windows shell runs it from the project's root)
  const first = list[0];
  if (first && !first.includes("/")) for (const ext of RUNS) if (holds(`${first}${ext}`)) found.add(`${first}${ext}`);
  return [...found];
}
