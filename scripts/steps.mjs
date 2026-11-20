// What a release asks of a project, step by step (AGENTS.md, "Nothing locks a project"; core archive 215): each entry
// of the sync notes (sync-notes.mjs, beside this file) has a step, by the entry's lead (its date and its name), with
// roughly what it costs and how it is told done, in a file of its own in steps/ beside this file, named as the entry's
// file is. A step is told done one of three ways, each exact and none by guessing:
//   - "check": this script reads the project and answers done, or not done with the mend, in words a session acts on
//     with no rule file open;
//   - "held": a check of the project's own, named, fails where the step is not done, and its failure says the mend;
//   - "unread": no check reads it exactly, and the step says why; the staged case "steps" plants it and reads what a
//     session did, or says why it cannot (staged/steps.mjs, beside this file).
// A step only the project's owner can do says so ("owner"): it is advisory, labelled `needs-owner` (labels.json, beside
// this file), and the rest goes on. A step the project leaves undone on purpose is declared in its manifest's "Differences", on its owner's
// word, by a line that quotes the step's lead ("13 November 2026, the core has moved"): such a step is not reported.
// The sync runs this from the copy it has just written (sync.mjs, beside this file), so a sync reports every step
// not done, a standing one too, and never fails over one: nothing waits on a step, and running it twice changes
// nothing. It reads only. Node's own modules and git only.
//
//   node core/scripts/steps.mjs          from a project's root: the steps not done, each with its mend; nothing else
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { differencesOf } from "./manifest-reads.mjs";
import { FOLDER as NOTES_FOLDER, NOTES } from "./sync-notes.mjs";
import { READ_MOST, ownFiles } from "./own-files.mjs";
import { readNothing, saidOf } from "./read-nothing.mjs";
import { started } from "./started.mjs";
import { parseYaml } from "./workflow-run.mjs";
import { copyAt } from "./workflow-calls.mjs";
import { mendAt, plain, shown } from "./step-checks.mjs";

// What a step reads a project with, and the words of an error with no path of the machine's in them: step-checks.mjs
// and the files named step-checks-<what it reads>.mjs, beside this file.
export { COST, plain } from "./step-checks.mjs";
export { MOVED_GLOB, MOVED_GLOBS, NEW_GLOBS, moved } from "./step-checks-moved.mjs";
export { callers } from "./step-checks-ready.mjs";

// The entries' leads, in the order the notes hold them: "12 November 2026, builders named by role".
export const leads = text => [...String(text).matchAll(/^- \*\*([^*]+?)\.\*\*/gm)].map(m => m[1]);

// The project at `root`, as the checks read it: its files as git lists them (committed or not, ignored ones left out),
// a file's text (null where it is not there), its manifest's slots and differences, and its workflows' YAML.
export function project(root) {
  const { listed, read, safe, unread } = ownFiles(root);
  const manifest = read("core-manifest.md") ?? "";
  const differences = differencesOf(manifest);
  const workflows = Object.fromEntries(listed.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f)).map(f => {
    let yaml = null;
    try { yaml = parseYaml(read(f)); } catch { /* (a workflow this reader cannot read: a check that needs it says so) */ }
    return [f.slice(".github/workflows/".length), { text: read(f), yaml }];
  }));
  return { root, files: listed, read, safe, unread, manifest, differences, workflows };
}

// Where the project's run of each check finds its config, and its calls to the core's workflows: check-configs.mjs,
// workflow-calls.mjs and own-runs.mjs, beside this file; a step throws workflow-calls.mjs's `Unread` where it cannot
// read what it needs.
export { KIT_CONFIGS, configs } from "./check-configs.mjs";
export { Unread, call, calls } from "./workflow-calls.mjs";
export { runsOwn } from "./own-runs.mjs";

// The steps, a file each in steps/ beside this file, read in the order of their names: each the step of the entry of
// the sync notes of the same name (sync-notes.mjs), its default export { lead, cost, and how it is told done }.
const FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), "steps");
export const STEPS = await Promise.all(fs.readdirSync(FOLDER).filter(f => f.endsWith(".mjs")).sort()
  .map(async f => (await import(pathToFileURL(path.join(FOLDER, f)).href)).default));

// Whether the manifest declares a step undone on purpose: a line of its "Differences" that quotes the step's lead.
export const declared = (p, step) => p.differences.some(l => l.includes(`"${step.lead}"`));

// The steps not done in the project at `root`: each { lead, owner, cost, mend }. A check that throws is not read as
// done: it is reported, with what went wrong.
export function notDone(root, steps = STEPS) {
  const p = project(root), copy = copyAt(p);
  // (a path of the project's own files outside the copy, a file or a folder: what a mend names as the core's is the copy's
  // and never that)
  const mine = p.files.filter(f => !f.startsWith(copy)), own = at => mine.some(f => f === at || f.startsWith(`${at}/`));
  const out = [];
  for (const step of steps) {
    if (!step.check || declared(p, step)) continue;
    let mend;
    try { mend = step.check(p); } catch (e) { mend = `Its check could not read the project (${plain(e.message, root)}): read its entry in \`core/${NOTES_FOLDER}/\` against it.`; }
    // (the entries and the checks say core/, the starter kit's path for the copy; a project that keeps it elsewhere is
    // told its own: #628)
    if (mend) out.push({ lead: step.lead, owner: !!step.owner, cost: step.cost, mend: mendAt(mend, copy, own) });
  }
  out.unread = p.unread;
  out.copy = copy;
  try { out.nothing = readNothing(p.root, p.manifest, p.read); } catch (e) { out.nothing = null; out.nothingWhy = plain(e.message, root); }
  return out;
}

// The report a sync prints for its pull request's description: the steps not done, and nothing where all are; and the
// checks that read nothing here (read-nothing.mjs; #459, point 2).
export function report(missed) {
  const said = saidOf(missed.nothing === undefined ? [] : missed.nothing, missed.copy, missed.nothingWhy);
  return [steps(missed), ...(said.length ? ["", ...said] : [])].join("\n");
}
function steps(missed) {
  const unread = missed.unread?.length ? `\n\nLeft unread, each past ${READ_MOST} bytes, which no file a step reads reaches: ${missed.unread.map(f => `\`${shown(f)}\``).join(", ")}. A step that reads one may have read it as missing: make it smaller, or take it out of git if it is no file of the project's.` : "";
  const copy = missed.copy ?? "core/";
  if (!missed.length) return `Every step a check reads is done (\`${copy}scripts/steps.mjs\`).${unread}`;
  return [`Steps not done (\`${copy}scripts/steps.mjs\`; ${copy}${NOTES}): each a task the project's agents take, in a pull request of its own, none waiting on another${missed.some(m => m.owner) ? "; one marked \"the owner's\" waits on the owner and is labelled so" : ""}.`,
    ...missed.map(m => `- ${m.lead}${m.owner ? " (the owner's)" : ""}: ${m.mend}`)].join("\n") + unread;
}

if (started(import.meta.url)) {
  try {
    console.log(report(notDone(process.cwd())));
  } catch (e) {
    console.error(`FAIL: the steps could not be read here (${plain(e.message)}): run it from the project's root, a git repository`);
    process.exitCode = 1;
  }
}
