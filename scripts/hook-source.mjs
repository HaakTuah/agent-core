// Where a hook's command takes the project's files from (floor rule 3: what an agent tool starts by itself runs from
// its copy on `main`; agent-tools.mjs). The starter kit's hooks fetch the script they run from the remote's `main`
// (`git show refs/remotes/origin/main:<path>`), which a session's branch cannot change; a hook that names a file the
// project holds otherwise runs or reads the working tree's copy, which the branch it runs on can change.
//
// Read only where it can be read exactly, two ways and no other. The starter kit's own two forms (KIT_FORMS), whole,
// are the core's: of one, only the plain words after its script are read. A plain command (PLAIN) holds nothing a shell
// reads otherwise than as written: letters, digits, spaces and `_ . / : = @ + , -`; quotes that only group (balanced,
// none within another); and $CLAUDE_PROJECT_DIR outside single quotes and alone in its part, the project's root, as an
// agent tool sets it.
// A word that sets a variable (PATH=x and the like change which program runs), a path with a ".." (read by the file
// system after the links before it) or one from the root ("/", which may lead into the checkout) makes it no plain
// command, wherever it stands in a word. Of a plain command, each word, and each part of a word between spaces (a
// quoted script given to sh -c) or `=`, `:`, `,` and `@`, or after an option's letters (-r./x.rb), names what the
// project holds at its path, the folder there whole, and beside it with an extension added, as a program that resolves
// a name reads it (finder()); all of it is taken from the working tree, whatever program it is given to. No other
// command is read: fromTree() says so, and agent-tools.mjs notes it, the review's. A shell's own syntax is never read,
// so nothing a reading here could get wrong grants a hook anything. Node's own modules only.
//
//   import { finder, fromTree } from "./hook-source.mjs";
//   finder(holds, names) -> finds, where holds(path) says whether the project holds a file there and names(folder)
//                           gives the names in a folder
//   fromTree(command, finds) -> what the command takes from the working tree, as paths of the project; or null, where
//                               it is neither the kit's nor plain, or would ask too much, and so not read
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
// (a ".." in a path is read by the file system after the links before it, which a plain reading cannot follow)
const PARENT = /(?:^|[/=:,@\s])\.\.(?:$|[/=:,@\s])/u;

// A plain command's words, its quotes taken out and $CLAUDE_PROJECT_DIR read as "." where the shell reads it (outside
// single quotes), or null where a quote is never closed or holds the root's name in single quotes, as written.
function words(command) {
  const out = [];
  let word = null, quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (c === "$") {
      const end = rootAt(command, i, quote, word);
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

// Where the root's name that starts at `i` ends; or -1 where none does, it stands in single quotes, written as is, or
// it does not stand alone in its part, a path the root then begins: the root is a whole path, so `scripts$ROOT/x`
// names a file under scripts/ that "." would not show. Before it, nothing of its part (`word` empty, or ending at a
// blank or `= : , @`); after it, a closing quote at most, then `/`, a blank, `= : , @` or the end.
const BOUNDARY = /[ =:,@]$/u, AFTER = /^[/ =:,@]?$/u;
function rootAt(command, i, quote, word) {
  ROOT.lastIndex = i;
  if (quote === "'" || !ROOT.test(command) || (word && !BOUNDARY.test(word))) return -1;
  const end = ROOT.lastIndex, closes = quote !== null && command[end] === quote;
  return AFTER.test(command[closes ? end + 1 : end] ?? "") ? end : -1;
}

// A word and its parts: whole, at its spaces, as a quoted script given to sh -c holds its words, and at each = : , @.
const parts = word => new Set([word, ...word.split(/ +/u), ...word.split(/[=:,@]/u), ...word.split(/[ =:,@]+/u)]);

// What a part may name: itself and, of an option (-x, +x), each tail from after its signs through its first letters,
// where a program reads a path given to it in the same word (ruby -r./scripts/run.rb, env -Cscripts, gcc -Iinclude).
// Each tail is charged to `spend` before it is made, so a long option asks no more than the budget allows.
const OPTION = /^[-+]+(\w*)/u;
function readings(part, spend) {
  const option = OPTION.exec(part);
  if (!option) return [part];
  const out = [part];
  for (let i = option[0].length - option[1].length; i <= option[0].length && i < part.length; i++) {
    spend(part.length - i);
    out.push(part.slice(i));
  }
  return out;
}

// What the readings of a command's words name in the project, finds() asked of each (finder(), below), and of a
// dotted name as a path too (python -m scripts.run, java com.x.Main). Each costs its length from BUDGET; a command that
// would ask more is not read.
const BUDGET = 1_000_000, OVER = new Error("over its budget");
function named(list, finds) {
  let spent = 0;
  const spend = n => { spent += n; if (spent > BUDGET) throw OVER; };
  const each = new Set(list.flatMap(word => [...parts(word)]).filter(Boolean).flatMap(part => readings(part, spend)));
  const found = new Set();
  for (const part of each) for (const p of /^[\w-]+(?:\.[\w-]+)+$/u.test(part) ? [part, part.replaceAll(".", "/")] : [part]) {
    spend(1 + p.length);
    if (inProject(p)) for (const f of finds(path.posix.normalize(p))) found.add(f);
  }
  return found;
}

// What the project holds that a path names, as `finds(path)`: the file at it, the folder at it (all it holds, as a
// program told to work there or to read it takes it), or a file or folder beside it whose name is its own and an
// extension (scripts/run for scripts/run.js, as node, ruby and cmd add one); "." the project's root itself. Each is
// matched as a file system that ignores case and a name's trailing dots and blanks reads it, as macOS's and Windows' do.
// `holds(file)` says whether the project holds a file there, `names(folder)` the names in a folder.
export function finder(holds, names) {
  const listed = new Map(), list = d => { if (!listed.has(d)) listed.set(d, names(d)); return listed.get(d); };
  const found = new Map();
  return f => {
    if (!found.has(f)) found.set(f, under(f, holds, list));
    return found.get(f);
  };
}
function under(f, holds, names) {
  if (f === ".") return ["."];
  const out = new Set(), at = [f, ...folded(f, names)];
  for (const p of at) if (holds(p) || names(p).length) out.add(p);
  const dir = path.posix.dirname(f), stem = `${bare(path.posix.basename(f))}.`;
  for (const d of dir === "." ? ["."] : [dir, ...folded(dir, names)]) {
    for (const n of names(d)) if (n.toLowerCase().startsWith(stem)) out.add(d === "." ? n : `${d}/${n}`);
  }
  return [...out];
}
// (each path a path names where case and a name's trailing dots and blanks are not read)
const bare = name => name.replace(/[. ]+$/u, "").toLowerCase();
function folded(f, names) {
  let at = ["."];
  for (const name of f.split("/")) {
    at = at.flatMap(d => names(d).filter(n => bare(n) === bare(name)).map(n => (d === "." ? n : `${d}/${n}`)));
    if (!at.length) break;
  }
  return at.filter(p => p !== f);
}

// Whether a word makes the command no plain one: a piece of it between blanks that sets a variable, itself, after an
// `=` (env --split-string=PATH=x) or after a single dash's letters (env -SPATH=x); or any part with a ".." or from the
// file system's root, which may lead into the checkout from wherever it stands, a path given to an option in the same
// word too (-r/x). Where an option's letters end is the program's, so -rscripts/x, read as -rscripts and /x, is not
// read either. Each is read in one pass of the word, no tail of it made.
function unsafe(word) {
  if (word.split(/ +/u).some(sets)) return true;
  return [...parts(word)].some(part => [part, afterOption(part)].some(p => p !== null && (p.startsWith("/") || PARENT.test(p))));
}
// (of an option's tails, only the one after all its letters can begin with "/" or ".."; one within them begins with a
// letter, and a ".." further on is in the part itself)
function afterOption(part) {
  const option = OPTION.exec(part);
  return option && option[0].length < part.length ? part.slice(option[0].length) : null;
}
// (a word that sets a variable, for the program after it or, through env and the like, for one it runs: PATH and the
// like change which program runs, and no plain reading follows them)
const ASSIGNS = /(?:^|=)[A-Za-z_]\w*=/u;
function sets(piece) {
  if (ASSIGNS.test(piece)) return true;
  const option = /^-(?!-)(\w*)/u.exec(piece);
  return option !== null && piece[option[0].length] === "=" && /[A-Za-z_]/u.test(option[1]);
}

export function fromTree(command, finds) {
  try { return read(String(command), finds); } catch (e) { if (e === OVER) return null; throw e; }
}

function read(text, finds) {
  const kit = KIT_FORMS.map(f => f.exec(text)).find(Boolean);
  if (kit) return [...named((kit[1] ?? "").split(" ").filter(Boolean), finds)];
  if (!PLAIN.test(text.replace(/\$(?:\{CLAUDE_PROJECT_DIR\}|CLAUDE_PROJECT_DIR(?!\w))/gu, ""))) return null;
  const list = nested(text) ? null : words(text);
  if (list === null || list.some(unsafe)) return null;
  return [...named(list, finds)];
}
