// Where a hook's command takes the project's files from (floor rule 3: what an agent tool starts by itself runs from
// its copy on `main`; agent-tools.mjs). The starter kit's hooks fetch the script they run from the remote's `main`
// (`git show refs/remotes/origin/main:<path>`), which a session's branch cannot change; a hook that names a file the
// project holds otherwise runs or reads the working tree's copy, which the branch it runs on can change.
//
// Read only where it can be read exactly, two ways and no other. The starter kit's own two forms (KIT_FORMS), whole,
// are the core's: of one, only the plain words after its script are read. A plain command (PLAIN) holds nothing a shell
// reads otherwise than as written: letters, digits, blanks and `_ . / : = @ + , -`, quotes that only group (balanced,
// none within another, and nothing in them a shell reads either), and $CLAUDE_PROJECT_DIR outside single quotes, the project's root, as an
// agent tool sets it; a path with a ".." is no plain command, since the file system reads ".." after the links before it.
// Of it, each word, and each part of a word between blanks (a quoted script given to sh -c) or `=`, `:`, `,` and `@`,
// that names a file the project holds (through
// a link inside the checkout too, as holds() reads it) is taken from the working tree, whatever program it is given to;
// and so is a file at the project's root that a Windows shell runs in the place of its first word. No other command is
// read: fromTree() says so, and agent-tools.mjs notes it, the review's. A shell's own syntax is never read, so nothing a
// reading here could get wrong grants a hook anything. Node's own modules only.
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
const PLAIN = /^[\w \t./:=@+,'"-]*$/u;
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
    if (c === " " || c === "\t") { if (word !== null) out.push(word); word = null; continue; }
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

// Each word, and each part of it, that names a file the project holds.
function named(list, holds) {
  const found = new Set();
  for (const word of list) {
    // (whole, at its blanks, as a quoted script given to sh -c holds its words, and at each = : , @ besides)
    for (const part of new Set([word, ...word.split(/[ \t]+/u), ...word.split(/[=:,@]/u), ...word.split(/[ \t=:,@]+/u)])) {
      if (!inProject(part)) continue;
      const at = path.posix.normalize(part);
      if (at !== "." && holds(at)) found.add(at);
    }
  }
  return found;
}

export function fromTree(command, holds) {
  const text = String(command);
  const kit = KIT_FORMS.map(f => f.exec(text)).find(Boolean);
  if (kit) return [...named((kit[1] ?? "").split(" ").filter(Boolean), holds)];
  if (!PLAIN.test(text.replace(/\$(?:\{CLAUDE_PROJECT_DIR\}|CLAUDE_PROJECT_DIR(?!\w))/gu, ""))) return null;
  const list = nested(text) ? null : words(text);
  if (list === null || list.some(w => PARENT.test(w))) return null;
  const found = named(list, holds);
  // (its first word, past the variables it sets, as a Windows shell runs it from the project's root)
  const first = list.find(w => !/^\w+=/u.test(w));
  if (first && !first.includes("/")) for (const ext of RUNS) if (holds(`${first}${ext}`)) found.add(`${first}${ext}`);
  return [...found];
}
