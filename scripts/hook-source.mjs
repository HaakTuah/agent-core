// Where a hook's command takes the project's files from (floor rule 3: what an agent tool starts by itself runs from
// its copy on `main`; agent-tools.mjs). The starter kit's hooks fetch the script they run from the remote's `main`
// (`git show refs/remotes/origin/main:<path>`), which a session's branch cannot change; a hook that names a file the
// project holds otherwise runs or reads the working tree's copy, which the branch it runs on can change.
//
// What it reads, exactly and no more: each word of the command that names a file the project holds, as the command
// writes it (relative to the project's root, or after a variable such as $CLAUDE_PROJECT_DIR or "$r"); a word written
// `<ref>:<path>` names the copy git holds at that ref, the remote's `main` (refs/remotes/origin/main or origin/main)
// being the one that counts as `main`; and a file only tested for (`[ -f <path> ]`, `test -e <path>`) is neither run
// nor read. A path the command builds from parts, reaches by changing folder, or names under another spelling is not
// read here, and stays the review's. Node's own modules only.
//
//   import { fromTree } from "./hook-source.mjs";
//   fromTree(command, holds) -> the paths it takes from the working tree, where holds(path) says the project holds one
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

// (a quoted text holding a blank, as "scripts/my hook.sh": a name a word alone would split; each kind of quote is read
// in a pass of its own, so a double-quoted name inside a single-quoted script, as bash -c '...' holds it, is found)
const QUOTED = [/"([^"]*\s[^"]*)"/gu, /'([^']*\s[^']*)'/gu];

export function fromTree(command, holds) {
  // (a backslash before a name's letter is Windows' separator; one before a quote or a "$" is the shell's escape)
  const text = String(command).replace(/\\(?=[\w.%-])/gu, "/").replace(VARIABLE, "\u0001");
  const found = new Set();
  const take = (word, before, quoted = false) => {
    const colon = word.lastIndexOf(":"), ref = colon > 0 ? word.slice(0, colon) : null;
    let p = colon >= 0 ? word.slice(colon + 1) : word;
    if ((ref !== null && MAIN.test(ref)) || (ref === null && TESTED.test(before))) return;
    // (a path after a variable is read from the project's root, which is what such a variable holds in a hook)
    if (quoted && /^(?:\u0001|\$\([^)]*\))\/+/u.test(p)) p = p.replace(/^(?:\u0001|\$\([^)]*\))\/+/u, "");
    else if (p.startsWith("/")) { if (ref !== null || !ROOTED.test(before)) return; p = p.replace(/^\/+/u, ""); }
    if (!inProject(p)) return;
    const at = path.posix.normalize(p);
    if (at !== "." && holds(at)) found.add(at);
  };
  for (const m of text.matchAll(WORD)) take(m[0], text.slice(Math.max(0, m.index - 200), m.index));
  for (const pattern of QUOTED) for (const m of text.replace(/\\"/gu, '"').matchAll(pattern)) take(m[1], text.replace(/\\"/gu, '"').slice(Math.max(0, m.index - 200), m.index), true);
  return [...found];
}
