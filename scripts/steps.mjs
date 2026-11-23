// What a release asks of a project, step by step (AGENTS.md, "Nothing locks a project"; core archive 215): each entry
// of the sync notes (sync-notes.mjs, beside this file) has a step, by the entry's lead (its date and its name), with
// roughly what it costs and how it is told done, in a file of its own in steps/ beside this file, named as the entry's
// file is. A step is told done one of four ways, each exact and none by guessing:
//   - "check": this script reads the project and answers done, or not done with the mend, in words a session acts on
//     with no rule file open;
//   - "held": a check of the project's own, named, fails where the step is not done, and its failure says the mend;
//   - "unread": no check reads it exactly, and the step says why; the staged case "steps" plants it and reads what a
//     session did, or says why it cannot (staged/steps.mjs, beside this file);
//   - "host": its state is GitHub's, not a file's, and a check reads it from what GitHub answered (host.mjs and
//     step-checks-host.mjs, beside this file; #1092), run where the host was read (the daily look, and host.mjs at a
//     sync) and left out elsewhere; one GitHub gave no answer for is said not read, never done or missing.
// A step only the project's owner can do says so ("owner"): it is advisory, labelled `needs-owner` (labels.json, beside
// this file), and the rest goes on. A step the project leaves undone on purpose is declared in its manifest's "Differences", on its owner's
// word, by a line that quotes the step's lead ("13 November 2026, the core has moved"): such a step is not reported.
// The sync runs this from the copy it has just written (sync.mjs, beside this file), so a sync reports every step
// not done, a standing one too, and never fails over one: nothing waits on a step, and running it twice changes
// nothing. It reads only, but where it is told to write: a step whose work is exact, a check's own config or baseline,
// a pointer's path, or the manifest's module lines placed from what is read (#1094), has a writer ("write",
// step-writers.mjs beside this file; #1091), which --write runs where its step is not done, never on a file with changes
// not yet committed, and lists what it wrote; a step that needs judgement has none. Node's own modules and git only.
//
//   node core/scripts/steps.mjs                  from a project's root: the steps not done, each with its mend; nothing else
//   node core/scripts/steps.mjs --write          each writer of a step not done run, and what it wrote listed, for a pull
//                                                request of its own with the usual reviews
//   node core/scripts/steps.mjs --write --aside  the same, then what it wrote set aside in a stash, as the sync runs it,
//                                                so the sync's pull request stays a pure sync (sync.mjs, beside this file)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { differencesOf } from "./manifest-reads.mjs";
import { FOLDER as NOTES_FOLDER, NOTES } from "./sync-notes.mjs";
import { READ_MOST, ownFiles } from "./own-files.mjs";
import { readNothing, saidOf } from "./read-nothing.mjs";
import { started } from "./started.mjs";
import { parseYaml } from "./parse-yaml.mjs";
import { copyAt } from "./workflow-calls.mjs";
import { HERE, mendAt, plain, shown } from "./step-checks.mjs";
import { MANIFEST, PIN_LINE, held } from "./step-writers.mjs";

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
// done: it is reported, with what went wrong. `host`, what GitHub answered (host.mjs's readHost), runs the steps read on
// the host too; one of those that cannot read what it needs is listed in `hostUnread`, { lead, why }, and not reported.
export function notDone(root, steps = STEPS, host = null) {
  const p = project(root), copy = copyAt(p);
  // (a path of the project's own files outside the copy, a file or a folder: what a mend names as the core's is the copy's
  // and never that)
  const mine = p.files.filter(f => !f.startsWith(copy)), own = at => mine.some(f => f === at || f.startsWith(`${at}/`));
  const out = [], hostUnread = [];
  for (const step of steps) {
    const read = step.check ?? (host && step.host ? q => step.host(q, host) : null);
    if (!read || declared(p, step)) continue;
    let mend, unread = false;
    try { mend = read(p); } catch (e) {
      if (!step.check) { hostUnread.push({ lead: step.lead, why: plain(e.message, root) }); continue; }
      unread = true; mend = `Its check could not read the project (${plain(e.message, root)}): read its entry in \`core/${NOTES_FOLDER}/\` against it.`;
    }
    // (the entries and the checks say core/, the starter kit's path for the copy; a project that keeps it elsewhere is
    // told its own: #628. `unread`: its check could not read the project, which attached.mjs counts neither way)
    if (mend) out.push({ lead: step.lead, owner: typeof step.owner === "function" ? !!step.owner(host) : !!step.owner, cost: step.cost, mend: mendAt(mend, copy, own), unread });
  }
  out.unread = p.unread;
  out.hostUnread = hostUnread;
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

// Each writer of a step not done in the project at `root` run, in the steps' order, and the step read again after it:
// each { lead, wrote (the files it wrote), mend (what is left of the step, null where it is done now) } or { lead, why }
// where it wrote nothing (it could not run, or its check could not read the project). A step the manifest declares
// undone on purpose, or done already, is left; a file with changes not yet committed when the run began is never written.
export function written(root, steps = STEPS) {
  const busy = held(root), copy = copyAt(project(root)), out = [];
  // (a writer runs the copy's own scripts and reads what the copy holds: this script must be the copy's)
  if (path.resolve(root, copy) !== HERE) throw new Error(`the writers run only as the copy's own script, from the project's root: node ${copy}scripts/steps.mjs --write`);
  for (const step of steps.filter(s => s.write)) {
    const p = project(root), mine = p.files.filter(f => !f.startsWith(copy)), own = at => mine.some(f => f === at || f.startsWith(`${at}/`));
    if (declared(p, step)) continue;
    try { if (step.check && !step.check(p)) continue; } catch (e) { out.push({ lead: step.lead, why: `its check could not read the project (${plain(e.message, root)})` }); continue; }
    let wrote;
    try { wrote = step.write(p, busy); } catch (e) { out.push({ lead: step.lead, why: lower(plain(e.message, root)) }); continue; }
    if (!wrote.length) continue;
    let mend;
    try { mend = step.check ? step.check(project(root)) : null; } catch (e) { mend = `its check could not read the project after it (${plain(e.message, root)})`; }
    out.push({ lead: step.lead, wrote, mend: mend && mendAt(mend, copy, own) });
  }
  return out;
}

// What --write prints: each step written, with its files and what is left of it, and each it could not write, with why;
// `how` "aside" where they stand in the stash ASIDE, "put back" where git could not make one and each was put back.
export function writeReport(done, how = null) {
  if (!done.length) return "No step left a script could write (`core/scripts/steps.mjs --write`).";
  const kept = " No word of a rule's text is written, but a pointer's path and the manifest's module lines.", later = "once this sync's pull request merges, on a fresh branch from `main`,";
  const head = !done.some(d => d.wrote?.length) ? "The steps' writers wrote nothing (`core/scripts/steps.mjs --write`)."
    : how === "aside" ? `Written by the steps' writers (\`core/scripts/steps.mjs --write\`), then set aside in the stash "${ASIDE}", so this sync stays a pure one: ${later} run \`git stash list\` and \`git stash pop stash@{N}\`, N the number it gives the stash "${ASIDE}" (or \`node core/scripts/steps.mjs --write\` again, which writes the same) and commit them in a pull request of its own, with the usual reviews.${kept}`
    : how === "put back" ? `Written by the steps' writers (\`core/scripts/steps.mjs --write\`), and put back as they stood, since git could not set them aside, so this sync stays a pure one: ${later} run \`node core/scripts/steps.mjs --write\` and commit what it writes in a pull request of its own, with the usual reviews.${kept}`
    : `Written by the steps' writers (\`core/scripts/steps.mjs --write\`): commit them in a pull request of their own, with the usual reviews.${kept}`;
  return [head, ...done.map(d => d.why ? `- ${d.lead}: wrote nothing, since ${d.why}.` : `- ${d.lead}: wrote ${d.wrote.map(f => `\`${shown(f)}\``).join(", ")}${d.mend ? `; still to do: ${d.mend}` : "; the step is done"}.`)].join("\n");
}
// What the writers wrote set aside in a stash, so the tree stands as it stood before them; where git cannot make one (no
// name to make it under, a file it refuses), each file put back as it stood, and false: a file git holds taken back from
// its last commit, index and tree, since a writer writes none with changes not yet committed, and a new one taken out.
// Paths are read as written, never as patterns. The manifest's `Core:` line as it stood is put back after either, so a
// pin the sync moved stays in its pull request (#1094). (`push`, git's own, is given another only by the test, to fail.)
export function setAside(root, files, push = () => execFileSync("git", ["--literal-pathspecs", "stash", "push", "--include-untracked", "--quiet", "-m", ASIDE, "--", ...files], { cwd: root, stdio: ["ignore", "ignore", "pipe"] })) {
  const manifest = path.join(root, MANIFEST), pin = files.includes(MANIFEST) ? PIN_LINE.exec(fs.readFileSync(manifest, "utf8"))?.[0] : null;
  const pinBack = () => { if (pin && fs.existsSync(manifest)) fs.writeFileSync(manifest, fs.readFileSync(manifest, "utf8").replace(PIN_LINE, () => pin)); };
  try {
    push();
    pinBack();
    return true;
  } catch {
    const tracked = execFileSync("git", ["--literal-pathspecs", "ls-tree", "-r", "-z", "--name-only", "HEAD", "--", ...files], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
    execFileSync("git", ["--literal-pathspecs", "reset", "-q", "--", ...files], { cwd: root, stdio: "ignore" });
    if (tracked.length) execFileSync("git", ["--literal-pathspecs", "checkout", "-q", "HEAD", "--", ...tracked], { cwd: root, stdio: "ignore" });
    for (const f of files.filter(f => !tracked.includes(f))) fs.rmSync(path.join(root, f), { force: true });
    pinBack();
    return false;
  }
}
const lower = text => text.replace(/^[A-Z](?=[a-z ])/u, c => c.toLowerCase());
export const ASIDE = "the steps' writes (#1091)";

if (started(import.meta.url) && process.argv.includes("--write")) {
  try {
    const root = process.cwd(), done = written(root), aside = process.argv.includes("--aside"), files = [...new Set(done.flatMap(d => d.wrote ?? []))];
    console.log(writeReport(done, !aside || !files.length ? null : setAside(root, files) ? "aside" : "put back"));
  } catch (e) {
    console.error(`FAIL: the steps' writers could not run here (${plain(e.message)}). Mend: run it as the copy's own script, node core/scripts/steps.mjs --write, from the project's root, a git repository`);
    process.exitCode = 1;
  }
} else if (started(import.meta.url)) {
  try {
    console.log(report(notDone(process.cwd())));
  } catch (e) {
    console.error(`FAIL: the steps could not be read here (${plain(e.message)}): run it from the project's root, a git repository`);
    process.exitCode = 1;
  }
}
