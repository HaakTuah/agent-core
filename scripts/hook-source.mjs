// Whether a hook's command runs its copy on `main` (floor rule 3: what an agent tool starts by itself runs from its copy
// on `main`; agent-tools.mjs): only the starter kit's own two forms (KIT_FORMS) show it, whole, each fetching its script
// from the remote's `main` (`git show refs/remotes/origin/main:<path>`), which a session's branch cannot change, and
// running it, perhaps with plain words after it, which that script, main's, reads. Nothing else is read: no other
// command shows where what it runs comes from, so none passes for it. Node's own modules only.
//
//   import { fetchedBy, kitForm } from "./hook-source.mjs";
//   kitForm(command) -> whether it is one of the kit's forms, whole
//   fetchedBy(command) -> the path of the project it fetches from main, or null where it is in neither form

// The starter kit's two forms of a hook's command, as setup/'s templates write them: its script fetched from main into
// "$f" and run, perhaps with plain words after it, and nothing else, the second after one or more tests that a file is
// there or is not; only the paths and those words change.
const KIT_PATH = "[\\w.-]+(?:/[\\w.-]+)*", KIT_ARGS = "((?: [\\w.-]+)*)";
// (the path fetched from main, written one way alone: each name starting with a letter, a digit, "_" or "-", so no "."
// or "..", which git reads from the folder it runs in, and no other spelling of the same file)
const FETCHED = "[\\w-][\\w.-]*(?:/[\\w-][\\w.-]*)*";
const kitFetch = dir => `f=\\$\\(git -C "${dir}" --no-replace-objects show refs/remotes/origin/main:(?<fetched>${FETCHED}) 2>/dev/null\\)`;
const KIT_FORMS = [
  new RegExp(`^bash -c '${kitFetch("\\$\\{CLAUDE_PROJECT_DIR:-\\.\\}")} \\|\\| (?:exit 0|\\{ echo "[^"'$\`\\\\]*"; exit 0; \\}); (?:bash -c "\\$f"${KIT_ARGS}|node --input-type=module -e "\\$f"())'$`, "u"),
  new RegExp(`^bash -c 'r=\\$\\(git rev-parse --show-toplevel 2>/dev/null\\) \\|\\| exit 0; (?:\\[ (?:! )?-f "\\$r/${KIT_PATH}" \\] \\|\\| exit 0; )+${kitFetch("\\$r")} \\|\\| exit 0; CLAUDE_PROJECT_DIR="\\$r" bash -c "\\$f"${KIT_ARGS}'$`, "u"),
];

// The path a command in one of the kit's forms fetches from main, or null where the command is in neither.
export function fetchedBy(command) {
  for (const form of KIT_FORMS) {
    const found = form.exec(String(command));
    if (found) return found.groups.fetched;
  }
  return null;
}
export const kitForm = command => fetchedBy(command) !== null;
