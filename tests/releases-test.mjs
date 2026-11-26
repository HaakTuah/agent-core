// Tests of the core's releases (releases.mjs): which tags are releases, which is the newest and whether it is past a pin, what
// a sync between two commits asks, and whether a release asks a sync of a project at all. What a project follows:
// follows-test.mjs; cutting one (release.mjs, with the trial on a real project in release-trial.mjs): release-test.mjs
// (#958). In a scratch repository that stands in for the core, fetched as the scripts fetch the core; on Linux and on
// Windows. Git and Node's own modules only.
//
//   node tests/releases-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STEPS } from "../scripts/steps.mjs";
import { FOLDER, POINTER, QUIET, entries, notesAt, quiet, quietAt } from "../scripts/sync-notes.mjs";
import { NOTES, OWN_FILES, RELEASE, asksBetween, asksLeft, fetchCore, inBare, jumped, matters, namedReleases, newestRelease, past, releasesIn, staysAt, takenBetween } from "../scripts/releases.mjs";
import { scratchCore, victimRepo } from "../scripts/releases-scratch.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

ok(RELEASE.test("release-1") && RELEASE.test("release-120") && !RELEASE.test("release-0") && !RELEASE.test("release-01") && !RELEASE.test("release-1a") && !RELEASE.test("v1") && !RELEASE.test("release-1\n"), "a release's name is the word and a whole number above zero");

// a scratch core: main with four commits, a side branch, and tags
const { tmp, git, core, commit, head, c1, c2, c3, c4, side, fetched } = scratchCore("releases-test-");

let dir = fetched();
ok(releasesIn(dir).length === 0 && newestRelease(c1, dir) === null && !jumped(c1, dir), "a core with no tag has no release, and no copy is older than its last two");
ok(past(c1, c3, dir) && past(c3, c3, dir) && !past(c3, c1, dir) && !past("0".repeat(40), c3, dir) && !past("not-a-commit", c3, dir), "a commit is past the ones it came from, and itself; what is no commit there is past nothing");

git(core, "tag", "release-1", c2);
git(core, "tag", "-a", "-m", "the second", "release-2", c3); // (a tag with a message of its own: its commit is what counts)
git(core, "tag", "release-3", side); // (on a commit that is not main's: no release)
git(core, "tag", "release-04", c4); // (not a release's name)
git(core, "tag", "v9", c4);
dir = fetched();
ok(releasesIn(dir).map(r => `${r.name}@${r.sha}`).join() === `release-2@${c3},release-1@${c2}`, "the releases are the tags of that name on main's commits, the newest first", releasesIn(dir).map(r => r.name).join());
ok(newestRelease(c1, dir).name === "release-2" && newestRelease(c1, dir).sha === c3 && newestRelease(c1, dir).moved, "a pin before the newest release is behind it");
ok(!newestRelease(c3, dir).moved && !newestRelease(c4, dir).moved, "a pin at the newest release, or past it on main, has nothing to take");
ok(!newestRelease(side, dir).moved && !newestRelease("f".repeat(40), dir).moved, "a pin that is no commit of main moves nowhere (core.yml fails such a project by itself)");
ok(asksBetween(c1, c3, dir).join("|") === "- **First.** Done when one.|- **Second.** Done when two." && asksBetween(c3, c4, dir).length === 0, "a sync asks what the notes gained between the two commits");
ok(jumped(c1, dir) && !jumped(c2, dir) && !jumped(c3, dir) && !jumped(c4, dir) && !jumped(side, dir) && !jumped("f".repeat(40), dir), "a copy from before the second newest release is older than the last two, and one at it or past it, or no commit of main, is not");
ok(asksBetween("f".repeat(40), c3, dir) === null, "notes that cannot be read give no all-clear");
{
  // (#750, point 1: the notes' entries move from the file into a folder, a file each; a sync across the move asks
  // nothing it did not, and one past it asks what the folder gained, in the order of the files' names)
  const notes = path.join(tmp, "notes"), at = (f, text) => { fs.mkdirSync(path.dirname(path.join(notes, f)), { recursive: true }); if (text === null) fs.rmSync(path.join(notes, f)); else fs.writeFileSync(path.join(notes, f), text); };
  const save = (files) => { for (const [f, text] of Object.entries(files)) at(f, text); git(notes, "add", "-A"); git(notes, "commit", "-q", "--allow-empty", "-m", "notes"); return git(notes, "rev-parse", "HEAD"); };
  fs.mkdirSync(notes); git(notes, "init", "-q", "-b", "main");
  const one = "- **First.** Done when one.", two = "- **Second.** Done when two.", three = "- **Third.** Done when three.";
  const filed = save({ [NOTES]: `${head}${one}\n${two}\n` });
  const foldered = save({ [NOTES]: `${head}${POINTER}\n`, [`${FOLDER}/010-first.md`]: `${one}\n`, [`${FOLDER}/020-second.md`]: `${two}\n` });
  const gained = save({ [`${FOLDER}/015-third.md`]: `${three}\n` });
  const bare = fs.mkdtempSync(path.join(tmp, "notes-")); fetchCore(bare, notes);
  ok(asksBetween(filed, foldered, bare).length === 0, "a sync across the notes' move into a folder asks nothing the file did not hold", asksBetween(filed, foldered, bare).join("\n"));
  ok(asksBetween(filed, gained, bare).join("|") === three && asksBetween(foldered, gained, bare).join("|") === three, "an entry the folder gains is asked, from a commit before the move or after it");
  ok(entries(notesAt(gained, args => git(notes, ...args))).join("|") === [one, three, two].join("|"), "the notes read whole at a commit hold the folder's entries in the order of the files' names");
  // (#1094: the entries that ask nothing)
  const quietRev = save({ "scripts/steps/015-third.mjs": `export default { lead: "Third", cost: "x", ${QUIET}, unread: "-" };\n`, "scripts/steps/010-first.mjs": "export default { lead: \"First\", cost: \"x\", unread: \"\" };\n" });
  const run = args => inBare(bare, args);
  fetchCore(bare, notes);
  ok([...quietAt(quietRev, run)].join("|") === three && !quietAt(gained, run).size && !quietAt("f".repeat(40), run).size, "the entries that ask nothing are those whose step says so", [...quietAt(quietRev, run)].join("|"));
  ok(quiet(`export default { lead: "T", ${QUIET} };`) && quiet(`export default {\n  lead: "T",\n  ${QUIET},\n};`) && !quiet(`// (it once said ${QUIET})\nexport default { lead: "T", check };`) && !quiet(`export default { lead: "T", check }, // ${QUIET}`) && !quiet(`export default { unread: "it ${QUIET}" };`),
    "a step asks nothing by its field, never by a comment or another field");
  const left = asksLeft(filed, quietRev, bare);
  ok(!left.asks.length && left.quiet === 1 && asksLeft(filed, gained, bare).asks.join("|") === three && asksLeft("f".repeat(40), quietRev, bare) === null, "a sync's report leaves out and counts the quiet entries; unread notes give no all-clear", JSON.stringify(left));
  const sd = new URL("../scripts/steps/", import.meta.url), stepFiles = fs.readdirSync(sd).filter(f => f.endsWith(".mjs")).sort();
  const wrong = STEPS.filter((st, k) => ![undefined, "nothing"].includes(st.asks) || (st.asks === "nothing") !== quiet(fs.readFileSync(new URL(stepFiles[k], sd), "utf8")) || (st.asks && (st.check || st.write)));
  ok(STEPS.filter(st => st.asks).length >= 9 && !wrong.length, `each step that asks nothing says \`${QUIET}\`, with no check or writer`, wrong.map(st => st.lead).join("\n"));
  // (a copy older than the folder syncs with its own script, whose reader took the lines a diff of the file alone
  // added: across the move it reads the notice the core's file holds, which sends the session to the folder)
  const notice = entries(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", NOTES), "utf8"));
  const moved = save({ [NOTES]: `${head}${notice.join("\n")}\n\n${POINTER}\n` });
  const oldReader = (a, b) => git(notes, "diff", "--unified=0", "--no-color", a, b, "--", NOTES).split("\n").filter(l => l.startsWith("+- ")).map(l => l.slice(1));
  ok(notice.length === 1 && oldReader(filed, moved).join("|") === notice[0] && notice[0].includes("`core/setup/sync-notes/`"), "a sync from a copy older than the folder, by its own old reader, prints the notice that sends it to the folder", oldReader(filed, moved).join("\n"));
}

// a tag of a tag, and a number out of main's order
git(core, "tag", "-a", "-m", "inner", "inner", c4);
git(core, "tag", "-a", "-m", "a tag of a tag", "release-5", "inner");
git(core, "tag", "release-6", c1); // (numbered newest, on main's oldest commit: a mistake)
dir = fetched();
const five = releasesIn(dir)[0];
ok(five.name === "release-5" && five.sha === c4 && git(dir, `--git-dir=${dir}`, "cat-file", "-t", five.sha) === "commit", "a release made as a tag of a tag is the commit it leads to, never a tag", JSON.stringify(five));
ok(!releasesIn(dir).some(r => r.name === "release-6") && namedReleases(dir).at(-1).name === "release-6" && newestRelease(c1, dir).name === "release-5", "a tag numbered newest on an older commit is no release: the newest by number is the newest in main's history");

// a release that brings nothing a project takes asks no sync of it (#242)
const taking = (list, left = "`b.md` (no use here)") => `# Core manifest\n\nFloor: whole. Modules: ${list}.\nNot taken: ${left}.\n`;
const onlyA = taking("`how-to-work.md`, `tasks/a.md`");
ok(!matters("tests/x-test.mjs", onlyA), "a test of the core's own scripts under tests/, which the copy leaves out, never matters (#527)");
ok(!matters("scripts/x-test.mjs", onlyA) && !matters(".github/ISSUE_TEMPLATE/f.md", onlyA) && !matters("tasks/b.md", onlyA), "what never matters: a test of the core's own scripts, its own issue forms, a module the manifest leaves out by name");
ok(matters("tasks/c.md", onlyA) && matters("tasks/b.md", taking("`a.md`", "")) && matters("tasks/b.md", taking("every module but `game-design.md`", "`game-design.md` (no game)")), "a module the list forgot, named nowhere, still matters: in doubt it syncs");
ok(OWN_FILES.every(f => !matters(f, onlyA)) && !matters("QUEUE.md", onlyA) && !matters(".github/workflows/tests.yml", onlyA), "nor do the core's own files, its queue and each workflow no project can call (#342)");
ok(["tasks/a.md", "roles/shared/how-to-work.md", "scripts/x.mjs", "scripts/x-test-data.json", "scripts/sub/y-test.mjs", "floor/security.md", NOTES, ".github/workflows/core.yml", ".github/workflows/core-moved.yml", ".github/workflows/own-other.yml", "README.md", "queue.md", "archive/instructions.md"].every(f => matters(f, onlyA)), "everything else matters: a module it names, a script, the floor, the notes, a workflow a project calls or one not named, the rest of the copy");
ok(matters("tasks/b.md", taking("all")) && matters("tasks/b.md", "# Core manifest\n") && matters("tasks/b.md", taking("<the list>")), "every module matters where the manifest takes all, or its list cannot be read");
// (that a test of the core's own scripts never matters holds only while nothing a project runs names one: no script but
// a test, no file of the starter kit and no workflow but those on OWN_FILES, which no project can call, tests.yml and
// release.yml among them, which runs the upgrade test on Windows (#715), outside its comments)
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
// (a test is passed over as matters() in releases.mjs passes it over: one of scripts/ itself, never a nested one; and
// the entries of scripts/holders/, data that names the check holding each rule, a test of the core's among them
// (#925), read as data and never run)
const runs = [...walk(path.join(repo, "scripts")).filter(f => !/^scripts\/(?:[^/]+-test\.mjs|holders\/[^/]+\.json)$/.test(path.relative(repo, f).split(path.sep).join("/"))), ...walk(path.join(repo, "setup", "template")),
  ...fs.readdirSync(path.join(repo, ".github", "workflows")).filter(f => !OWN_FILES.includes(`.github/workflows/${f}`)).map(f => path.join(repo, ".github", "workflows", f))];
const naming = runs.flatMap(f => fs.readFileSync(f, "utf8").split("\n").map((l, i) => [l, `${path.relative(repo, f)}:${i + 1}`]))
  .filter(([l]) => /-test\.mjs/.test(l) && !/^\s*(\/\/|#|\*)/.test(l)).map(([, at]) => at);
ok(!naming.length, "nothing a project runs names a test of the core's own scripts, outside a comment", `${naming.join(", ")}\n     Mend: a project runs no test of the core's: move what it needs into a script without -test in its name, or take ${"`scripts/*-test.mjs`"} off the list of what never matters (matters in releases.mjs)`);
// (and that each of the core's own workflows on the list is one no project can call: it exists, has no workflow_call
// trigger, and no file of the starter kit names it; one left off it matters, as anything in doubt does)
const kit = walk(path.join(repo, "setup", "template")).map(f => fs.readFileSync(f, "utf8")).join("\n");
const workflows = fs.readdirSync(path.join(repo, ".github", "workflows")).filter(f => /\.ya?ml$/.test(f)).map(f => `.github/workflows/${f}`);
const callable = workflows.filter(f => /\bworkflow_call\b/.test(fs.readFileSync(path.join(repo, f), "utf8"))); // (in any form: a block, a list, a flow, quoted)
const wrong = OWN_FILES.filter(f => f.startsWith(".github/workflows/")).filter(f => !workflows.includes(f) || callable.includes(f) || kit.includes(path.basename(f)));
ok(!wrong.length, "each workflow on the list of the core's own files is one no project can call", `${wrong.join(", ")}\n     Mend: take it off OWN_FILES in releases.mjs, since a project calls it or it is gone`);
ok(fs.existsSync(path.join(repo, "QUEUE.md")) && !kit.includes("QUEUE.md"), "the core's queue is its own: no file of the starter kit names it");
const other = path.join(tmp, "other");
fs.mkdirSync(other);
git(other, "init", "-q", "-b", "main");
const change = (files, tag) => {
  for (const [f, text] of Object.entries(files)) {
    const at = path.join(other, f);
    if (text === null) fs.rmSync(at); else { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); }
  }
  git(other, "add", "-A");
  git(other, "commit", "-q", "-m", tag);
  git(other, "tag", tag);
  return git(other, "rev-parse", "HEAD");
};
const r1 = change({ "tasks/a.md": "a", "tasks/b.md": "b", "scripts/x.mjs": "x", "scripts/x-test.mjs": "t", ".github/ISSUE_TEMPLATE/f.md": "f", [NOTES]: head }, "release-1");
const r2 = change({ "tasks/b.md": "b2", "scripts/x-test.mjs": "t2", ".github/ISSUE_TEMPLATE/f.md": "f2" }, "release-2");
const otherDir = () => { const d = fs.mkdtempSync(path.join(tmp, "other-")); fetchCore(d, other); return d; };
dir = otherDir();
ok(takenBetween(r1, r2, onlyA, dir).length === 0 && staysAt(r1, onlyA, dir), "a release that changes only what never matters asks no sync of a project at the release before it");
ok(takenBetween(r1, r2, taking("`a.md`, `b.md`"), dir).join() === "tasks/b.md" && !staysAt(r1, taking("`a.md`, `b.md`"), dir) && !staysAt(r1, taking("all"), dir), "one that changes a module the project takes asks it");
ok(!staysAt(r2, onlyA, dir) && !staysAt("f".repeat(40), onlyA, dir), "a project at the newest release, or at no release, stays at nothing: there is nothing to pass over");
ok(takenBetween("f".repeat(40), r2, onlyA, dir) === null && takenBetween(r1, "f".repeat(40), onlyA, dir) === null, "a change that cannot be read is no all-clear");
const r3 = change({ "scripts/x-test.mjs": "t3" }, "release-3");
dir = otherDir();
ok(!staysAt(r1, onlyA, dir) && staysAt(r2, onlyA, dir), "one release is passed over at most: a project that stayed syncs at the next, which the upgrade test proves from either of the last two");
const r4 = change({ "tasks/b.md": null, "tasks/c.md": "b2" }, "release-4");
dir = otherDir();
ok(takenBetween(r3, r4, taking("`b.md`", "`c.md` (x)"), dir).join() === "tasks/b.md" && takenBetween(r3, r4, taking("`c.md`", "`b.md` (x)"), dir).join() === "tasks/c.md", "a module moved matters by either name: a project that names the old one or the new one is asked");
change({ [NOTES]: `${head}- **New.** Done when new.\n` }, "release-5");
dir = otherDir();
ok(!staysAt(r4, onlyA, dir), "a release whose notes ask something new asks a sync");

// git's own variables that point elsewhere: a project's repository is never touched, and the guard is not fooled
const { victim, own } = victimRepo(tmp, git);
process.env.GIT_DIR = path.join(victim, ".git");
process.env.GIT_WORK_TREE = victim;
let pointed;
try {
  pointed = fs.mkdtempSync(path.join(tmp, "pointed-"));
  fetchCore(pointed, core);
} finally { delete process.env.GIT_DIR; delete process.env.GIT_WORK_TREE; }
ok(releasesIn(pointed)[0]?.name === "release-5" && git(victim, "rev-parse", "HEAD") === own && git(victim, "config", "--get", "core.bare") === "false" && git(victim, "tag").trim() === "", "with git pointed at a project's repository, the core is still fetched into its own folder and the project's is left as it was");


console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the core's releases`);
process.exitCode = failed ? 1 : 0;
