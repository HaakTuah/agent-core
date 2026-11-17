// Where a hook's command takes the project's files from (floor rule 3: what an agent tool starts by itself runs from
// its copy on `main`; agent-tools.mjs). The starter kit's hooks fetch the script they run from the remote's `main`
// (`git show refs/remotes/origin/main:<path>`), which a session's branch cannot change; a hook that names a file the
// project holds otherwise runs or reads the working tree's copy, which the branch it runs on can change.
//
// Read only where it can be read exactly, two ways and no other. The starter kit's own two forms (KIT_FORMS), whole,
// are the core's: of one, only the plain words after its script are read. A plain command (PLAIN) holds nothing a shell
// reads otherwise than as written: letters, digits, blanks and `_ . / : = @ + , -`, quotes that only group (balanced,
// and nothing in them a shell reads either), and $CLAUDE_PROJECT_DIR, the project's root, as an agent tool sets it.
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
const ROOT = /\$(?:\{CLAUDE_PROJECT_DIR\}|CLAUDE_PROJECT_DIR(?!\w))/gu;
const PLAIN = /^[\w \t./:=@+,'"-]*$/u;
// (a file at the project's root that a Windows shell runs in the place of a command's first word, since cmd looks in
// the folder it stands in first)
const RUNS = ["", ".exe", ".bat", ".cmd", ".com", ".ps1", ".js", ".jse", ".vbs", ".vbe", ".wsf", ".wsh", ".msc"];

// A plain command's words, its quotes taken out, or null where a quote is never closed.
function words(command) {
  const out = [];
  let word = null, quote = null;
  for (const c of command) {
    if (quote) { if (c === quote) quote = null; else word += c; continue; }
    if (c === "'" || c === '"') { quote = c; word ??= ""; continue; }
    if (c === " " || c === "\t") { if (word !== null) out.push(word); word = null; continue; }
    word = (word ?? "") + c;
  }
  if (quote) return null;
  if (word !== null) out.push(word);
  return out;
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
  const plain = text.replace(ROOT, ".");
  if (!PLAIN.test(plain)) return null;
  const list = words(plain);
  if (list === null) return null;
  const found = named(list, holds);
  // (its first word, past the variables it sets, as a Windows shell runs it from the project's root)
  const first = list.find(w => !/^\w+=/u.test(w));
  if (first && !first.includes("/")) for (const ext of RUNS) if (holds(`${first}${ext}`)) found.add(`${first}${ext}`);
  return [...found];
}
