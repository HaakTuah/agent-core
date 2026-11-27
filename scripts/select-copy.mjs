// A project's copy of the core as the selection reads a change to it (select.mjs, select-reach.mjs; tasks/tests.md, "A pull
// request runs the tests its change can reach"; #1093, point 2): its .node-version selects the whole suite, any other
// file of it the tests that can run the copy (copyChange), and a workflow in which only the pins of calls to the core's
// workflows moved, nothing (pinsOnly).
import { CORE } from "./core-address.mjs";
import { corePath } from "./core-path.mjs";
import { git } from "./select-passed.mjs";

// A file of the project's copy of the core (#1093, point 2): its .node-version, the Node the suites run on, reaches
// every test; any other, the copy's scripts first, the tests that can run the copy (copyReaching). Names more, never less.
export function copyChange(f, { add, wholes, copy, copyTests }) {
  if (f === `${copy}.node-version`) return `${f}, the Node the suites run on, changed`;
  for (const t of copyTests()) add(t, `can run the copy of the core (${f})`);
  for (const t of wholes()) add(t, `reaches every file (${f})`);
  return null;
}

// The tests that reach a file naming the copy's folder: as a path ("core/scripts/x.mjs", or with backslashes as Windows
// writes one), its last folder so too, or as a quoted piece of one (path.join("core", ...)). A test that imports the
// copy's scripts is one whose imports the readers cannot follow, which reaches every file (wholes); a test that neither
// names the copy nor imports from it cannot run it.
export function copyReaching(texts, reaches, copy) {
  const esc = t => t.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&"), folder = copy.replace(/\/$/u, "");
  const naming = new RegExp(`(?:^|[^\\w.-])(?:${esc(folder).replace(/\//gu, "[\\\\/]+")}|${esc(folder.split("/").pop())})(?:[\\\\/]|["'\`])`, "u");
  const names = new Set(Object.keys(texts).filter(t => naming.test(texts[t])));
  return [...reaches].filter(([, files]) => [...files].some(x => names.has(x))).map(([t]) => t);
}

// Each workflow the change touches in which only the pins of calls to the core's workflows moved, as a sync moves
// them: a workflow is no code, and its pins no test reads (#1093, point 2). `core.yml` checks those pins.
const PIN = new RegExp(`(${CORE.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&")}/\\.github/workflows/[\\w.-]+\\.ya?ml)@[^\\s'"#]+`, "giu");
const unpinned = text => text.replace(PIN, "$1@");
export function pinsOnly(base, changed) {
  const at = (rev, f) => { try { return git(["show", `${rev}:${f}`]); } catch { return null; } };
  return new Set(changed.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(f)).filter(f => {
    const was = at(base, f), now = at("HEAD", f);
    return was !== null && now !== null && was !== now && unpinned(was) === unpinned(now);
  }));
}

// The path of the project's copy of the core, or null in the core's own repository, where its files are the code.
export const copyOf = () => { try { return corePath(".") || null; } catch { return null; } };
