// Tests of the core's releases (releases.mjs) and of cutting one (release.mjs): what a project follows, which tags are
// releases, which is the newest and whether it is past a pin, what a sync between two commits asks, whether a release
// asks a sync of a project at all, and what the next release would be. In a scratch repository that stands in for the core, fetched as the scripts fetch the core; on
// Linux and on Windows. Git and Node's own modules only.
//
//   node scripts/releases-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE, OWNER } from "./core-address.mjs";
import { OWN, costed, held, inTheCore, next } from "./release.mjs";
import { STEPS } from "./steps.mjs";
import { NOTES, OWN_FILES, RELEASE, asksBetween, elsewhere, fetchCore, followsOf, matters, namedReleases, newestRelease, ownerOf, past, releasesIn, staysAt, takenBetween } from "./releases.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

// what a project follows
const manifest = (owner, row = "") =>
  `# Core manifest\n\nCore: ${CORE} at ${"a".repeat(40)}, copied whole under core/ (never edited here).\n\n| Slot | Here |\n| --- | --- |\n| *owner's account* | \`${owner}\` |\n${row}`;
ok(ownerOf(manifest("someone")) === "someone" && ownerOf("no manifest") === null, "the owner's account is read from its one row");
ok(followsOf(manifest(OWNER)) === "main" && followsOf(manifest(OWNER.toUpperCase())) === "main", "with no row, the core's own owner's project follows main, however the login is cased");
ok(followsOf(manifest("someone-else")) === "releases", "with no row, another owner's project follows the releases");
ok(followsOf(manifest(OWNER, "| *follows* | `releases` |\n")) === "releases" && followsOf(manifest("someone-else", "| *follows* | `main` |\n")) === "main", "a row decides it, either way");
ok(followsOf(manifest("someone-else", "|*follows*|  `main`  |\n")) === "main", "the row is read whatever its blanks");
ok(followsOf(manifest(OWNER, "| *follows* | releases |\n")) === null && followsOf(manifest(OWNER, "| *follows* | `main` or `releases` |\n")) === null && followsOf(manifest(OWNER, "| *follows* | `tags` |\n")) === null, "a row that says anything else, or says it without backticks, gives no answer");
ok(followsOf(manifest(OWNER, "| *follows* | `main` |\n| *follows* | `releases` |\n")) === null, "two rows give no answer");
ok(followsOf("| *owner's account* | someone |\n") === null, "no row and no owner's account to go by give no answer");
ok(RELEASE.test("release-1") && RELEASE.test("release-120") && !RELEASE.test("release-0") && !RELEASE.test("release-01") && !RELEASE.test("release-1a") && !RELEASE.test("v1") && !RELEASE.test("release-1\n"), "a release's name is the word and a whole number above zero");

// a scratch core: main with four commits, a side branch, and tags
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "releases-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
// (git's own variables that point at a repository are left out, so every call lands in the scratch one)
for (const name of Object.keys(process.env)) if (elsewhere.test(name)) delete process.env[name];
// (and git finds no bare repository by itself, as Git 3.0 has it by default: the scripts name each one they make)
Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.bareRepository", GIT_CONFIG_VALUE_0: "explicit" });
// (the test's own calls never take a variable that points elsewhere, even while one is set to try the scripts)
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env: Object.fromEntries(Object.entries(process.env).filter(([name]) => !elsewhere.test(name))), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const core = path.join(tmp, "core");
fs.mkdirSync(path.join(core, path.dirname(NOTES)), { recursive: true });
git(core, "init", "-q", "-b", "main");
let n = 0;
const commit = (notes) => {
  fs.writeFileSync(path.join(core, NOTES), notes);
  fs.writeFileSync(path.join(core, "n"), String(++n));
  git(core, "add", "-A");
  git(core, "commit", "-q", "-m", `commit ${n}`);
  return git(core, "rev-parse", "HEAD");
};
const head = "# What a sync asks of a project\n\n";
const c1 = commit(head), c2 = commit(`${head}- **First.** Done when one.\n`);
git(core, "checkout", "-q", "-b", "side");
const side = commit(`${head}- **First.** Done when one.\n- **Aside.** Never on main.\n`);
git(core, "checkout", "-q", "main");
const c3 = commit(`${head}- **First.** Done when one.\n- **Second.** Done when two.\n`), c4 = commit(`${head}- **First.** Done when one.\n- **Second.** Done when two.\n`);
const fetched = () => { const dir = fs.mkdtempSync(path.join(tmp, "fetched-")); fetchCore(dir, core); return dir; };

let dir = fetched();
ok(releasesIn(dir).length === 0 && newestRelease(c1, dir) === null, "a core with no tag has no release");
ok(next(dir).name === "release-1" && next(dir).sha === c4 && next(dir).before === null && next(dir).asks.length === 0, "the first release would stand on main's newest commit");
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
ok(asksBetween("f".repeat(40), c3, dir) === null, "notes that cannot be read give no all-clear");
const coming = next(dir);
ok(coming.name === "release-4" && coming.sha === c4 && coming.before.name === "release-2" && coming.asks.length === 0, "the next release stands on main's newest commit, numbered after every tag with a release's name, the one that is no release too, so its name is never taken");

// a tag of a tag, and a number out of main's order
git(core, "tag", "-a", "-m", "inner", "inner", c4);
git(core, "tag", "-a", "-m", "a tag of a tag", "release-5", "inner");
git(core, "tag", "release-6", c1); // (numbered newest, on main's oldest commit: a mistake)
dir = fetched();
const five = releasesIn(dir)[0];
ok(five.name === "release-5" && five.sha === c4 && git(dir, `--git-dir=${dir}`, "cat-file", "-t", five.sha) === "commit", "a release made as a tag of a tag is the commit it leads to, never a tag", JSON.stringify(five));
ok(!releasesIn(dir).some(r => r.name === "release-6") && namedReleases(dir).at(-1).name === "release-6" && newestRelease(c1, dir).name === "release-5", "a tag numbered newest on an older commit is no release: the newest by number is the newest in main's history");
ok(next(dir) === null, "with the newest release on main's newest commit there is nothing to release");
commit(`${head}- **First.** Done when one.\n- **Second.** Done when two.\n- **Third.** Done when three.\n`);
dir = fetched();
ok(next(dir).name === "release-7" && next(dir).before.name === "release-5" && next(dir).asks.join() === "- **Third.** Done when three.", "the next one is numbered past the mistaken tag, and carries what the notes gained since the newest release");
git(core, "tag", "release-999999999", c1);
let refused = false;
try { next(fetched()); } catch { refused = true; }
ok(refused, "a tag numbered so high that the next would be no release's name stops the cut, and says so");
git(core, "tag", "-d", "release-999999999");
dir = fetched();
const tip = git(core, "rev-parse", "main");
let moved = "";
try { next(dir, c4); } catch (e) { moved = e.message; }
ok(next(dir, tip).sha === tip && moved.includes("main has moved on"), "asked for one commit, the cut is refused where main's newest commit is another");

// a release that brings nothing a project takes asks no sync of it (#242)
const taking = (list, left = "`b.md` (no use here)") => `# Core manifest\n\nFloor: whole. Modules: ${list}.\nNot taken: ${left}.\n`;
const onlyA = taking("`how-to-work.md`, `modules/a.md`");
ok(!matters("scripts/x-test.mjs", onlyA) && !matters(".github/ISSUE_TEMPLATE/f.md", onlyA) && !matters("modules/b.md", onlyA), "what never matters: a test of the core's own scripts, its own issue forms, a module the manifest leaves out by name");
ok(matters("modules/c.md", onlyA) && matters("modules/b.md", taking("`a.md`", "")) && matters("modules/b.md", taking("every module but `game-design.md`", "`game-design.md` (no game)")), "a module the list forgot, named nowhere, still matters: in doubt it syncs");
ok(OWN_FILES.every(f => !matters(f, onlyA)) && !matters("QUEUE.md", onlyA) && !matters(".github/workflows/tests.yml", onlyA), "nor do the core's own files, its queue and each workflow no project can call (#342)");
ok(["modules/a.md", "modules/how-to-work.md", "scripts/x.mjs", "scripts/x-test-data.json", "scripts/sub/y-test.mjs", "floor/security.md", NOTES, ".github/workflows/core.yml", ".github/workflows/core-moved.yml", ".github/workflows/own-other.yml", "README.md", "queue.md", "archive/instructions.md"].every(f => matters(f, onlyA)), "everything else matters: a module it names, a script, the floor, the notes, a workflow a project calls or one not named, the rest of the copy");
ok(matters("modules/b.md", taking("all")) && matters("modules/b.md", "# Core manifest\n") && matters("modules/b.md", taking("<the list>")), "every module matters where the manifest takes all, or its list cannot be read");
// (that a test of the core's own scripts never matters holds only while nothing a project runs names one: no script but
// a test, no file of the starter kit and no workflow but the core's own tests.yml, outside its comments)
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const runs = [...walk(path.join(repo, "scripts")).filter(f => !/-test\.mjs$/.test(f)), ...walk(path.join(repo, "setup", "template")),
  ...fs.readdirSync(path.join(repo, ".github", "workflows")).filter(f => f !== "tests.yml").map(f => path.join(repo, ".github", "workflows", f))];
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
const r1 = change({ "modules/a.md": "a", "modules/b.md": "b", "scripts/x.mjs": "x", "scripts/x-test.mjs": "t", ".github/ISSUE_TEMPLATE/f.md": "f", [NOTES]: head }, "release-1");
const r2 = change({ "modules/b.md": "b2", "scripts/x-test.mjs": "t2", ".github/ISSUE_TEMPLATE/f.md": "f2" }, "release-2");
const otherDir = () => { const d = fs.mkdtempSync(path.join(tmp, "other-")); fetchCore(d, other); return d; };
dir = otherDir();
ok(takenBetween(r1, r2, onlyA, dir).length === 0 && staysAt(r1, onlyA, dir), "a release that changes only what never matters asks no sync of a project at the release before it");
ok(takenBetween(r1, r2, taking("`a.md`, `b.md`"), dir).join() === "modules/b.md" && !staysAt(r1, taking("`a.md`, `b.md`"), dir) && !staysAt(r1, taking("all"), dir), "one that changes a module the project takes asks it");
ok(!staysAt(r2, onlyA, dir) && !staysAt("f".repeat(40), onlyA, dir), "a project at the newest release, or at no release, stays at nothing: there is nothing to pass over");
ok(takenBetween("f".repeat(40), r2, onlyA, dir) === null && takenBetween(r1, "f".repeat(40), onlyA, dir) === null, "a change that cannot be read is no all-clear");
const r3 = change({ "scripts/x-test.mjs": "t3" }, "release-3");
dir = otherDir();
ok(!staysAt(r1, onlyA, dir) && staysAt(r2, onlyA, dir), "one release is passed over at most: a project that stayed syncs at the next, which the upgrade test proves from either of the last two");
const r4 = change({ "modules/b.md": null, "modules/c.md": "b2" }, "release-4");
dir = otherDir();
ok(takenBetween(r3, r4, taking("`b.md`", "`c.md` (x)"), dir).join() === "modules/b.md" && takenBetween(r3, r4, taking("`c.md`", "`b.md` (x)"), dir).join() === "modules/c.md", "a module moved matters by either name: a project that names the old one or the new one is asked");
change({ [NOTES]: `${head}- **New.** Done when new.\n` }, "release-5");
dir = otherDir();
ok(!staysAt(r4, onlyA, dir), "a release whose notes ask something new asks a sync");

// the checks on the commit a release would stand on
const run = (name, status, conclusion, path = `.github/workflows/${name}.yml`) => ({ name, path, status, conclusion });
const list = (...runs) => ({ total_count: runs.length, workflow_runs: runs });
ok(held(list(run("tests", "completed", "success"), run("size", "completed", "success"))).length === 0, "a commit whose every check has passed may carry a release");
ok(held(list(run("tests", "completed", "success"), run("size", "completed", "skipped"), run("other", "completed", "neutral"))).length === 0, "a check that was skipped holds nothing where another passed");
ok(held(list(run("tests", "in_progress", null), run("size", "completed", "success"))).join() === "tests: in_progress" && held(list(run("tests", "queued", null))).join() === "tests: queued", "a check still going holds it");
ok(held(list(run("tests", "completed", "failure"), run("size", "completed", "cancelled"), run("x", "completed", "timed_out"))).join() === "tests: failure,size: cancelled,x: timed_out", "so does each that failed, was cancelled or ran out of time");
ok(held(list()).join() === "no check has passed on it yet" && held(list(run("size", "completed", "skipped"))).join() === "no check has passed on it yet", "so does a commit no check has run on yet, or on which every check only skipped");
ok(held(list(run("release", "completed", "failure", OWN), run("tests", "completed", "success"))).length === 0 && held(list(run("release", "in_progress", null, OWN))).join() === "no check has passed on it yet", "the release workflow's own runs, an earlier try that failed too, are no check of the commit");
ok(held({ total_count: 3, workflow_runs: [run("tests", "completed", "success")] }).join().includes("3 runs stand on it and 1 were read"), "a list read only in part holds it");
ok([null, undefined, {}, [], "text", { workflow_runs: [] }, { total_count: "1", workflow_runs: [run("tests", "completed", "success")] }, { total_count: 1, workflow_runs: {} }].every(l => held(l).join() === "the list of the checks on it could not be read"), "so does a list in any other form");
// (asked of the script itself, in this repository: each stops before anything is fetched or pushed)
const cutting = (...args) => { const r = spawnSync(process.execPath, [fileURLToPath(new URL("./release.mjs", import.meta.url)), "--cut", ...args], { encoding: "utf8" }); return r.status === 1 && /--cut needs --at <sha> and --runs <file>|needs a value/.test(r.stderr) && !r.stdout; };
ok(cutting() && cutting("--at", "a".repeat(40)) && cutting("--runs", "runs.json") && cutting("--runs", "runs.json", "--at"), "a cut asked for without the commit it is for, or without the checks on it, is refused before anything is fetched");
ok(held({ total_count: 2, workflow_runs: [null, run("tests", "completed", "success")] }).join() === "a check: unreadable" && held(list({ name: "tests", path: "p" })).join() === "tests: unreadable", "and a run in it that cannot be read");

// git's own variables that point elsewhere: a project's repository is never touched, and the guard is not fooled
const victim = path.join(tmp, "victim");
fs.mkdirSync(path.join(victim, "core", "scripts"), { recursive: true });
git(victim, "init", "-q", "-b", "main");
fs.writeFileSync(path.join(victim, "f"), "x");
git(victim, "add", "-A");
git(victim, "commit", "-q", "-m", "its own");
const own = git(victim, "rev-parse", "HEAD");
process.env.GIT_DIR = path.join(victim, ".git");
process.env.GIT_WORK_TREE = victim;
let pointed, fooled;
try {
  pointed = fs.mkdtempSync(path.join(tmp, "pointed-"));
  fetchCore(pointed, core);
  fooled = inTheCore(path.join(victim, "core", "scripts", "release.mjs"));
} finally { delete process.env.GIT_DIR; delete process.env.GIT_WORK_TREE; }
ok(releasesIn(pointed)[0]?.name === "release-5" && git(victim, "rev-parse", "HEAD") === own && git(victim, "config", "--get", "core.bare") === "false" && git(victim, "tag").trim() === "", "with git pointed at a project's repository, the core is still fetched into its own folder and the project's is left as it was");
ok(fooled === false, "and a project's copy is still no place to cut a release from");

// where a release may be cut
ok(inTheCore(), "this file lies in the core's own repository");
const project = path.join(tmp, "project");
fs.mkdirSync(path.join(project, "core", "scripts"), { recursive: true });
git(project, "init", "-q");
ok(!inTheCore(path.join(project, "core", "scripts", "release.mjs")), "a copy under a project's core/ is not the core: a project cuts no release");
ok(!inTheCore(path.join(tmp, "nowhere", "scripts", "release.mjs")), "nor is a folder that is no repository");
// a copy kept as a repository of its own under a project's core/, the project's manifest beside it
const nested = path.join(tmp, "nested");
fs.mkdirSync(path.join(nested, "core", "scripts"), { recursive: true });
fs.writeFileSync(path.join(nested, "core-manifest.md"), "# Core manifest\n");
git(path.join(nested, "core"), "init", "-q");
ok(!inTheCore(path.join(nested, "core", "scripts", "release.mjs")), "nor is a clone or submodule of the core under a project's core/");

// what a release asks, each with roughly what it costs a project where it is not done yet (steps.mjs)
const owners = STEPS.find(s => s.owner);
ok(costed(`- **${STEPS[0].lead}.** Done when one.`).endsWith(`\n  Cost: ${STEPS[0].cost}.`) && costed(`- **${owners.lead}.** Done when two.`).includes("(the owner's)")
  && costed("- **No such entry.** Done when three.").includes("unknown"), "each ask of a release says what it costs, the owner's marked so, and one with no step says so");

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the core's releases`);
process.exitCode = failed ? 1 : 0;
