// Tests of the core's releases (releases.mjs) and of cutting one (release.mjs, with the trial on a real project in release-trial.mjs): what a project follows, which tags are
// releases, which is the newest and whether it is past a pin, what a sync between two commits asks, whether a release
// asks a sync of a project at all, and what the next release would be. In a scratch repository that stands in for the core, fetched as the scripts fetch the core; on
// Linux and on Windows. Git and Node's own modules only.
//
//   node tests/releases-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE, OWNER } from "../scripts/core-address.mjs";
import { OWN, costed, fullRun, held, inTheCore, next, older } from "../scripts/release.mjs";
import { COUNTS, TRIAL, compared, ownCount, trialAt, trialRecord } from "../scripts/release-trial.mjs";
import { shownAs } from "../scripts/state-report.mjs";
import { STEPS } from "../scripts/steps.mjs";
import { FOLDER, NOTICE, POINTER, QUIET, entries, notesAt, quiet, quietAt } from "../scripts/sync-notes.mjs";
import { NOTES, OWN_FILES, RELEASE, asksBetween, asksLeft, elsewhere, fetchCore, inBare, followsOf, hostAccount, hostSaid, jumped, matters, namedReleases, newestRelease, ownerOf, past, releasesIn, staysAt, takenBetween } from "../scripts/releases.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

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
// (#481: with no row at all, the repository's own account where the host says a person holds it; a row still decides)
const PERSON = { login: "someone", type: "User" }, ORG = { login: "a-team", type: "Organization" }, BARE = "# Core manifest\n\n| Slot | Here |\n| --- | --- |\n";
ok(ownerOf(BARE, PERSON) === "someone" && ownerOf(BARE, ORG) === null && ownerOf(BARE) === null, "with no row, the owner's account is read where a person's account holds the repository, and only there");
ok(ownerOf(manifest("other"), PERSON) === "other" && ownerOf("| *owner's account* | someone |\n", PERSON) === null && ownerOf(`${manifest("a")}| *owner's account* | \`b\` |\n`, PERSON) === null, "a row decides over what was read, and a row of another form, or two, give no answer and are never read past");
ok(["| *Owner's Account* | `x` |", "| *owner’s account* | `x` |", "|**owner's account**| `x` |", "| *owners account* | x |", "| *owner's account* (a team's) | `x` |", "| the Owner's  Account | `x` |"].every(row => ownerOf(`${BARE}${row}\n`, PERSON) === null), "a row whose lead is cased or spelt otherwise is still a row: no answer, and the host's account is never read past it");
ok(ownerOf(`${manifest("other")}| *Owner's account* | \`x\` |\n`, PERSON) === "other", "the one row of its form decides beside a row spelt otherwise, as before");
ok(ownerOf(BARE, { login: "a;b", type: "User" }) === null && ownerOf(BARE, { login: "x", type: "user" }) === null, "a login of no form, and a type other than the host's own word, read as nothing");
ok(followsOf(BARE, { login: OWNER, type: "User" }) === "main" && followsOf(BARE, PERSON) === "releases" && followsOf(BARE, ORG) === null, "with no row, what the project follows goes by the account read");
{ // asked once, only when called, saying what it read
  const lines = [], calls = [];
  const host = hostSaid(l => lines.push(l), () => { calls.push(1); return PERSON; });
  ok(ownerOf(manifest("other"), host) === "other" && !calls.length && !lines.length, "with a row, the host is not asked and nothing is said");
  ok(ownerOf(BARE, host) === "someone" && followsOf(BARE, host) === "releases" && calls.length === 1 && lines.length === 1 && /^read from the host: someone, a person's account, holds the repository; a row/.test(lines[0]), "with none, it is asked once and says what it read", lines.join("\n"));
  const none = [];
  ok(ownerOf(BARE, hostSaid(l => none.push(l), () => null)) === null && /nothing/.test(none[0]) && /an account of the type x%0Ay/.test((() => { const l = []; hostSaid(x => l.push(x), () => ({ login: "a", type: "x\ny" }))(); return l[0]; })()), "nothing read is said so, and a type of no form is only quoted");
}
{ // the host's account: from the workflow's event, else from gh, else nothing
  const dir = scratchDir("host-account-"), event = path.join(dir, "event.json"), asked = [];
  try {
    fs.writeFileSync(event, JSON.stringify({ repository: { owner: { login: "someone", type: "User", id: 1 } } }));
    const gh = text => args => { asked.push(args.join(" ")); return text; };
    ok(JSON.stringify(hostAccount({ GITHUB_EVENT_PATH: event }, gh("{}"))) === JSON.stringify(PERSON) && !asked.length, "the event's own account is read, and gh is not asked");
    fs.writeFileSync(event, JSON.stringify({ repository: { full_name: "Someone/Project", owner: { login: "someone", type: "User" } } }));
    ok(JSON.stringify(hostAccount({ GITHUB_EVENT_PATH: event, GITHUB_REPOSITORY: "someone/project" }, gh("{}"))) === JSON.stringify(PERSON), "an event of the repository asked about is read, whatever its case");
    ok(JSON.stringify(hostAccount({ GITHUB_EVENT_PATH: event, GITHUB_REPOSITORY: "a-team/x" }, gh(JSON.stringify(ORG)))) === JSON.stringify(ORG), "an event of another repository is passed over for gh's answer on the one asked about");
    ok(JSON.stringify(hostAccount({ GITHUB_REPOSITORY: "a-team/x" }, gh(JSON.stringify(ORG)))) === JSON.stringify(ORG) && asked.at(-1) === "api repos/a-team/x --jq .owner | {login, type}", "with no event, gh is asked of the repository's own route", asked.join("; "));
    ok(hostAccount({ GITHUB_REPOSITORY: "../x" }, gh(JSON.stringify(PERSON))) === null && hostAccount({ GITHUB_REPOSITORY: "a/x" }, () => { throw new Error("no gh"); }) === null && hostAccount({ GITHUB_REPOSITORY: "a/x" }, gh("not json")) === null, "no repository's name, no gh, or an answer of no form: nothing read, never a guess");
    fs.writeFileSync(event, JSON.stringify({ repository: { owner: { login: "a b", type: "User" } } }));
    ok(JSON.stringify(hostAccount({ GITHUB_EVENT_PATH: event, GITHUB_REPOSITORY: "a-team/x" }, gh(JSON.stringify(ORG)))) === JSON.stringify(ORG), "an event's login of no form is passed over for gh's answer");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
ok(RELEASE.test("release-1") && RELEASE.test("release-120") && !RELEASE.test("release-0") && !RELEASE.test("release-01") && !RELEASE.test("release-1a") && !RELEASE.test("v1") && !RELEASE.test("release-1\n"), "a release's name is the word and a whole number above zero");

// a scratch core: main with four commits, a side branch, and tags
const tmp = scratchDir("releases-test-");
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
ok(releasesIn(dir).length === 0 && newestRelease(c1, dir) === null && !jumped(c1, dir), "a core with no tag has no release, and no copy is older than its last two");
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

// the checks on the commit a release would stand on
const run = (name, status, conclusion, path = `.github/workflows/${name}.yml`) => ({ name, path, status, conclusion });
const list = (...runs) => ({ total_count: runs.length, workflow_runs: runs });
// the core's tests in full on that commit (#733): of the tests' runs there once an hour or by hand, which hold the
// Windows suites, none is unfinished and the newest, by when it last started (a re-run moves it), passed
// (each bears the workflow's own name, as GitHub gives a run whose run-name is empty: tests-parts-test.mjs reads the rest)
const full = (event, conclusion, id, status = "completed", at = `2026-11-19T10:${String(id).padStart(2, "0")}:00Z`) => ({ ...run("tests", status, conclusion), event, id, run_started_at: at, display_title: "tests" });
ok(/have not run in full on it yet/.test(fullRun(list({ ...run("tests", "completed", "success"), event: "push" }))), "a commit whose tests ran only on its push, on Linux, has not had them in full, and the release waits, saying how to start them");
ok(fullRun(list(full("schedule", "success", 10))) === null && fullRun(list(full("workflow_dispatch", "success", 10))) === null, "an hourly or a hand-started run that passed lets the release stand");
ok(fullRun(list(full("workflow_dispatch", "success", 10), full("schedule", "failure", 9))) === null && /hourly run\): failure/.test(fullRun(list(full("schedule", "failure", 10), full("workflow_dispatch", "success", 9)))), "the newest of them, by when it last started, decides, in whatever order GitHub lists them: a pass started after a failure lets it stand, a failure started after a pass holds it");
ok(/hand-started run\): failure/.test(fullRun(list(full("schedule", "success", 20), full("workflow_dispatch", "failure", 10, "completed", "2026-11-19T11:00:00Z")))) && fullRun(list(full("schedule", "failure", 20, "completed", "2026-11-19T10:00:00Z"), full("schedule", "success", 10, "completed", "2026-11-19T10:00:00Z"))) !== null, "an older run started again by hand, which failed, holds it over a skipped run made before; two that started together, the one made last decides");
ok(/hand-started run\): in_progress/.test(fullRun(list(full("schedule", "success", 11), full("workflow_dispatch", null, 10, "in_progress")))), "and a full run still going on the commit holds it, though a skipped hourly run was made after it");
ok(/in_progress/.test(fullRun(list(full("schedule", null, 10, "in_progress")))) && /not run in full/.test(fullRun(list({ ...full("schedule", "success", 10), path: ".github/workflows/other.yml" }))), "one still going holds it, and another workflow's run is no run of the tests");
ok(held(list(run("tests", "completed", "success"), run("size", "completed", "success"))).length === 0, "a commit whose every check has passed may carry a release");
ok(held(list(run("tests", "completed", "success"), run("size", "completed", "skipped"), run("other", "completed", "neutral"))).length === 0, "a check that was skipped holds nothing where another passed");
ok(held(list(run("tests", "in_progress", null), run("size", "completed", "success"))).join() === "tests: in_progress" && held(list(run("tests", "queued", null))).join() === "tests: queued", "a check still going holds it");
ok(held(list(run("tests", "completed", "failure"), run("size", "completed", "cancelled"), run("x", "completed", "timed_out"))).join() === "tests: failure,size: cancelled,x: timed_out", "so does each that failed, was cancelled or ran out of time");
ok(held(list()).join() === "no check has passed on it yet" && held(list(run("size", "completed", "skipped"))).join() === "no check has passed on it yet", "so does a commit no check has run on yet, or on which every check only skipped");
ok(held(list(run("release", "completed", "failure", OWN), run("tests", "completed", "success"))).length === 0 && held(list(run("release", "in_progress", null, OWN))).join() === "no check has passed on it yet", "the release workflow's own runs, an earlier try that failed too, are no check of the commit");
ok(held({ total_count: 3, workflow_runs: [run("tests", "completed", "success")] }).join().includes("3 runs stand on it and 1 were read"), "a list read only in part holds it");
ok([null, undefined, {}, [], "text", { workflow_runs: [] }, { total_count: "1", workflow_runs: [run("tests", "completed", "success")] }, { total_count: 1, workflow_runs: {} }].every(l => held(l).join() === "the list of the checks on it could not be read"), "so does a list in any other form");
const handed = older("release-7", "b".repeat(40));
ok(handed.includes(`node core/scripts/sync.mjs ${"b".repeat(40)}`) && handed.includes("older than release-1") && handed.includes("release-7"), "each release says how a copy older than release-1 takes it: once, with the release's full SHA (#365)", handed);
// (asked of the script itself, in this repository: each stops before anything is fetched or pushed)
const cutting = (...args) => { const r = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/release.mjs", import.meta.url)), "--cut", ...args], { encoding: "utf8" }); return r.status === 1 && /--cut needs --at <sha>, --runs <file> and --full <file>|needs a value/.test(r.stderr) && !r.stdout; };
ok(cutting() && cutting("--at", "a".repeat(40)) && cutting("--runs", "runs.json") && cutting("--runs", "runs.json", "--at") && cutting("--at", "a".repeat(40), "--runs", "runs.json"), "a cut asked for without the commit it is for, without the checks on it, or without the tests' runs there, is refused before anything is fetched");
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
const owners = STEPS.find(s => s.owner === true), hosts = STEPS.find(s => typeof s.owner === "function");
ok(costed(`- **${STEPS[0].lead}.** Done when one.`).endsWith(`\n  Cost: ${STEPS[0].cost}.`) && costed(`- **${owners.lead}.** Done when two.`).endsWith("(the owner's).") && costed(`- **${hosts.lead}.** Done when two.`).endsWith("(the owner's in a private repository).")
  && costed("- **No such entry.** Done when three.").includes("unknown") && costed(`${NOTICE}: and so on.`).includes("each entry it sends the session to") && costed("- A line of no form.").includes("unknown"), "each ask of a release says what it costs, the owner's marked so, one with no step or of no form says so, and the notice costs what it sends to");

// the trial on a real project (#1084): a run before the update beside one after it, and its record, which holds the cut
// where it does not stand for the commit, or where a check passed before and failed after
{
  const c = compared({ "a.yml/x": "passed", "a.yml/y": "failed", "a.yml/z": "passed", "a.yml/gone": "failed" }, { "a.yml/x": "passed", "a.yml/y": "failed", "a.yml/z": "failed", "b.yml/new": "failed", "b.yml/more": "passed" });
  ok(Object.values(c).join(";") === "a.yml/x;;a.yml/y;a.yml/z;b.yml/new;;b.yml/more;;a.yml/gone;;;;;", "each job is in its class of COUNTS: passed both, failed both (standing before), failed after where it passed before or did not run (the update's), ran after alone, and failed before alone", JSON.stringify(c));
  const t = path.join(tmp, "trial");
  git(tmp, "init", "-q", "-b", "main", t);
  const commit = (files, msg) => { for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(t, f)), { recursive: true }); fs.writeFileSync(path.join(t, f), text); } git(t, "add", "-A"); git(t, "-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", msg); return git(t, "rev-parse", "HEAD"); };
  const read = args => git(t, ...args);
  const tried = commit({ "a.txt": "1\n" }, "the commit tried");
  const none = trialAt(tried, read);
  ok(/has not run for/.test(none.said) && /Mend: try the release on a copy of a project/.test(none.held ?? ""), "with no record, the release says the trial has not run, and the cut is held, saying its mend");
  const record = r => commit({ [TRIAL]: `${JSON.stringify(r)}\n` }, "the trial's record");
  const passed = trialRecord(tried, "2026-11-22", [[{ "a.yml/x": "passed", "a.yml/y": "failed" }, { "a.yml/x": "passed", "a.yml/y": "failed" }]]);
  ok(passed.projects === 1 && passed.passedBoth === 1 && passed.failedBoth === 1 && Object.keys(passed).join() === `commit,day,projects,${COUNTS},baselineFromClone`, "the record holds the commit, the day and counts alone, nothing of the project");
  let at = record(passed);
  let r = trialAt(at, read);
  ok(r.held === null && /in 1 project: 1 check passed before and after the update, 0 failed before and passed after, 1 failed before and after \(standing before the release\), 0 passed before and failed after/.test(r.said), "a record of the commit before, which the release changes by the record alone, stands, and one failing both does not hold the cut", r.said);
  at = commit({ "a.txt": "2\n" }, "more since");
  r = trialAt(at, read);
  ok(/changes more than the record since \(a\.txt\)/.test(r.held ?? ""), "a commit that changes more than the record since the commit tried holds the cut", r.held);
  const later = commit({ "a.txt": "3\n" }, "tried again");
  at = record(trialRecord(later, "2026-11-23", [[{ "a.yml/x": "passed" }, { "a.yml/x": "failed" }]]));
  r = trialAt(at, read);
  ok(/1 check failed after the release in the trial on a real project, 1 of them passing before it[\s\S]*Mend: find the release's fault/.test(r.held ?? ""), "a check that passed before and failed after holds the cut, saying its mend", r.held);
  at = record(trialRecord(later, "2026-11-23", [[{ "a.yml/x": "passed", "a.yml/gate": "passed" }, { "a.yml/x": "passed", "a.yml/gate": "unread" }]]));
  r = trialAt(at, read);
  ok(/1 check was not measured in the trial on a real project, 1 of them run before and not read after the update[\s\S]*Mend: teach the core's workflow runner/.test(r.held ?? "") && !/failed after the release/.test(r.held ?? ""), "a check that ran before and the trial's run after could not read holds the cut as not measured, saying its mend (#1257; #1263, point 2)", r.held);
  at = record(trialRecord(later, "2026-11-23", [[{ "a.yml": "failed" }, { "a.yml/x": "passed", "a.yml/gate": "unread" }]]));
  r = trialAt(at, read);
  ok(r.held === null && /1 read in neither run \(not measured, holding nothing\)/.test(r.said), "one read in neither run, under a file an older check.mjs failed whole before, holds nothing and is no failure (#1257)", `${r.said}\n${r.held}`);
  at = record(trialRecord(later, "2026-11-23", []));
  r = trialAt(at, read);
  ok(r.held === null && /No project that takes the core allowed a trial/.test(r.said), "where no project allowed a trial, the release says so, and it is not held");
  const noForm = [{ commit: later, projects: "one" }, { ...trialRecord(later, "2026-11-23", []), failedAfter: 2 }, { ...trialRecord(later, "2026-11-23", []), day: "<b>soon</b>" }]
    .map(bad => trialAt(record(bad), read));
  ok(noForm.every(n => /no form/.test(n.said) && n.held !== null), "a record in no form holds the cut: a count that is no count, one of no project that counts a check, a day of no form");
  // (a later commit that takes out a file git would read as renamed into the record is still more than the record)
  commit({ "old.json": `${JSON.stringify({ a: 1, b: 2, c: 3, d: 4, e: 5 }, null, 2)}\n` }, "a file like the record");
  const like = git(t, "rev-parse", "HEAD");
  git(t, "rm", "-q", "old.json");
  at = record({ ...trialRecord(like, "2026-11-23", []) });
  ok(/changes more than the record since \(old\.json\)/.test(trialAt(at, read).held ?? ""), "a file taken out beside the record is no rename of it: the cut is held", trialAt(at, read).held);
  const cli = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "release.mjs"), "--trial", "abc"], { encoding: "utf8" });
  ok(cli.status === 1 && /--trial needs the full SHA/.test(cli.stderr), "--trial with no full SHA writes nothing and says what it needs", cli.stderr);
  const listed = ["**The projects that take the core** (read 2026-11-22)", `- ${shownAs("o/a", true, false)}: it has no state report yet.`, `- ${shownAs("o/b", true, true)}: from its report of 2026-10: 3.`, `- ${shownAs("x/c", false, false)}: it has no state report yet.`, "- (GitHub's code search gave no answer.)"].join("\n");
  ok(ownCount(listed) === 2 && ownCount("**The projects that take the core**\n- None found.") === 0, "the owner's projects are counted from what state-report.mjs --projects prints, in shownAs's words: its own public and private, never another owner's, a note or none found");
  const inCore = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "release.mjs"), "--trial", later, path.join(path.dirname(fileURLToPath(import.meta.url)), "before.json"), path.join(tmp, "after.json")], { encoding: "utf8" });
  ok(inCore.status === 1 && /lies in the core's own repository/.test(inCore.stderr), "--trial refuses a run's verdicts kept in the core's own repository, where a project's job names could be committed", inCore.stderr);
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the core's releases`);
process.exitCode = failed ? 1 : 0;
