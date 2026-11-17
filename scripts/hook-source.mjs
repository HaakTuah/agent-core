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
// command. Of a plain command, each word, and each part of a word
// between spaces (a quoted script given to sh -c) or `=`, `:`, `,` and `@`, that names a file the project holds,
// alone or after a word a few before it (a folder a program is told to work in), through a link inside the checkout
// too, as holds() reads it, is taken from the working tree, whatever program it is given to; and so is a file at the project's root that a Windows shell runs in the place of its first word. No other
// command is read: fromTree() says so, and agent-tools.mjs notes it, the review's. A shell's own syntax is never read,
// so nothing a reading here could get wrong grants a hook anything. Node's own modules only.
//
//   import { fromTree } from "./hook-source.mjs";
//   fromTree(command, holds) -> the paths it takes from the working tree, where holds(path) says the project holds one;
//                               or null, where the command is neither the kit's nor plain, and so not read
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
// (a command of more words than this is no plain command: each word is asked joined to those before it)
const WORDS = 1000;
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

// Each word, and each part of it, that names a file the project holds; and each joined to a part of one of the
// NEAR words before it, as a program given a folder to work in (env -C scripts bash run.sh, make -C, --prefix=...)
// reads a path after it from there, whatever its option is called.
const NEAR = 8;
function named(list, holds) {
  const found = new Set(), asked = new Set();
  const ask = p => { if (asked.has(p) || !inProject(p)) return; asked.add(p); const at = path.posix.normalize(p); if (at !== "." && holds(at)) found.add(at); };
  const each = list.map(word => [...parts(word)].filter(Boolean));
  each.forEach((mine, i) => {
    for (const part of mine) {
      ask(part);
      for (let j = Math.max(0, i - NEAR); j < i; j++) for (const folder of each[j]) ask(`${folder}/${part}`);
    }
  });
  return found;
}

export function fromTree(command, holds) {
  const text = String(command);
  const kit = KIT_FORMS.map(f => f.exec(text)).find(Boolean);
  if (kit) return [...named((kit[1] ?? "").split(" ").filter(Boolean), holds)];
  if (!PLAIN.test(text.replace(/\$(?:\{CLAUDE_PROJECT_DIR\}|CLAUDE_PROJECT_DIR(?!\w))/gu, ""))) return null;
  const list = nested(text) ? null : words(text);
  // (and a path from the file system's root, which may lead into the checkout from wherever it stands: not read)
  if (list === null || list.length > WORDS || list.some(w => PARENT.test(w) || SETS.test(w) || [...parts(w)].some(p => p.startsWith("/")))) return null;
  const found = named(list, holds);
  // (its first word, as a Windows shell runs it from the project's root)
  const first = list[0];
  if (first && !first.includes("/")) for (const ext of RUNS) if (holds(`${first}${ext}`)) found.add(`${first}${ext}`);
  return [...found];
}
