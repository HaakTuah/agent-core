// Tests of the copy of the core's check (.github/workflows/core.yml), its own job run as GitHub runs it for a project
// (scripts/workflow-run.mjs), so that its shell is tested here before it runs in any project: on a scratch
// project whose copy and calls are as they should be, and on each fault the check names (a default branch of another
// name, a difference from the floor or the review guidelines, a manifest without its one pin or one owner's account, a
// pin off the core's main, a call pinned where its workflow differs or written in another form), and on where the copy
// stands (tasks/repositories.md): at another path the manifest names, and carried by a library, its files committed or
// a submodule, with the floor's own copy it keeps until every tool has passed the staged cases. The copy's own faults
// (an edit, a file added, a link, a submodule, one whose id is the copy's own tree; the executable bit no difference)
// are pure-sync-test.mjs's, which runs this job on each; a report whose name git quotes is left out here as the copy
// leaves it out, and so is the folder of the owner's words (#252), and the core's tests where the pin's .gitattributes
// keeps them (#527), while a top-level name that only ends in a tab and "reports" is kept, as the copy keeps it. A
// scratch core of a few commits on its main and one off it, reached through the core's address by a git rewrite, so no
// call reaches the network. On Linux and on Windows. Git, tar, bash and Node's own modules.
//
//   node tests/core-yml-test.mjs [--part all | faults | places]
// (a part runs alone, beside the other, in a job of its own on Windows, where the whole takes the longest of any step
// of the suites: faults, the faults the check names; places, where the copy stands; #504)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE, OWNER } from "../scripts/core-address.mjs";
import { checkoutStandIn, scratchDir, scratchEnv, projectOf } from "../scripts/scratch-core.mjs";
import { runWorkflow } from "../scripts/workflow-run.mjs";
import { mended } from "../scripts/mend.mjs";

const [flag = "--part", PART = "all", ...more] = process.argv.slice(2);
if (flag !== "--part" || !["all", "faults", "places"].includes(PART) || more.length) {
  console.error("FAIL: the core.yml test takes --part all, faults or places, and nothing else. Mend: run node tests/core-yml-test.mjs, or name one of those parts after --part");
  process.exit(1);
}
const inPart = part => PART === "all" || PART === part;
let section = "faults";
let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = scratchDir("core-yml-test-");
const slash = p => p.replace(/\\/g, "/");
const theCore = path.join(tmp, "the-core");
const env = scratchEnv(theCore, tmp);
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }).trim();
const write = (dir, f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };

// the core: A, then B (the core as it stands, its personal-terms workflow changed since A), and a commit off main
// (without the folders of scripts and records that no case here reads, which are most of the files each project's copy
// of the core is written from and committed with, bar the two files the job reads off main: the staged cases' record
// and the tools they run under)
const unread = ["scripts", "archive", "inventory", "choices", "setup", "reports", "tests", ".packages"], read = ["scripts/staged-tools.json", "reports/staged-cases.json"];
fs.cpSync(root, theCore, { recursive: true, filter: src => {
  const rel = slash(path.relative(root, src));
  return !(slash(src).endsWith("/.git") || slash(src).endsWith("/node_modules")) && (!unread.includes(rel.split("/")[0]) || read.some(f => f === rel || f.startsWith(`${rel}/`)));
} });
git(theCore, "init", "-q", "-b", "main");
const terms = fs.readFileSync(path.join(theCore, ".github/workflows/personal-terms.yml"), "utf8");
write(theCore, ".github/workflows/personal-terms.yml", `${terms}# A\n`);
git(theCore, "add", "-A");
git(theCore, "commit", "-q", "-m", "A");
const A = git(theCore, "rev-parse", "HEAD");
write(theCore, ".github/workflows/personal-terms.yml", terms);
git(theCore, "commit", "-q", "-am", "B");
const B = git(theCore, "rev-parse", "HEAD");
const SIDE = git(theCore, "commit-tree", `${B}^{tree}`, "-p", B, "-m", "off main");
// C: a report whose name git quotes (a letter beyond ASCII), in the folder the core keeps to itself
const quoted = `reports/2026-01-01-${String.fromCodePoint(0xf8)}.md`;
write(theCore, quoted, "A report.\n");
git(theCore, "add", "-A");
git(theCore, "commit", "-q", "-m", "C");
const C = git(theCore, "rev-parse", "HEAD");
// D, where a name may hold a tab (not on Windows): a top-level file whose name only ends in a tab and "reports", which
// the copy keeps, as git archive and copy-tree.mjs keep it
const tabbed = process.platform === "win32" ? null : `x\treports`;
if (tabbed) { write(theCore, tabbed, "kept\n"); git(theCore, "add", "-A"); git(theCore, "commit", "-q", "-m", "D"); }
const D = tabbed ? git(theCore, "rev-parse", "HEAD") : null;
// E: the core's tests in a folder of their own, kept to the core by the line its .gitattributes gains (#527)
write(theCore, "tests/one-test.mjs", "a test of the core's\n");
write(theCore, ".gitattributes", `${fs.readFileSync(path.join(theCore, ".gitattributes"), "utf8")}/tests export-ignore\n`);
git(theCore, "add", "-A");
git(theCore, "commit", "-q", "-m", "E");
const E = git(theCore, "rev-parse", "HEAD");
const workflow = git(theCore, "show", `${B}:.github/workflows/core.yml`);

const MANIFEST = (pin = B, more = "") => `# Core manifest\n\nCore: ${CORE} at ${pin}, copied whole under core/ (never edited here).\nFloor: whole. Modules: all.\n\n## Slots\n| Slot | Here |\n| --- | --- |\n| *owner's account* | \`${OWNER}\` |\n${more}`;
const CALLS = (terms = B, core = A) => `name: core\non:\n  pull_request:\njobs:\n  core:\n    uses: ${CORE}/.github/workflows/core.yml@${core}\n  terms:\n    uses: ${CORE}/.github/workflows/personal-terms.yml@${terms}\n    secrets: inherit\n`;
let n = 0;
// The check's verdict on a project whose copy is the core at `at` (B unless said), with the files given in place of the
// usual ones.
// `under` is the folder the copy is written to, and `floor` one a copy of the core's floor/ is written to besides; `then`
// changes the project before its commit.
function check(files = {}, { branch = "main", at = B, without = null, under = "core", floor = null, then = null, base = env, held = { login: "someone", type: "Organization" } } = {}) {
  const dir = path.join(tmp, `project-${++n}`);
  fs.mkdirSync(path.join(dir, under), { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  const archive = (...paths) => execFileSync("git", ["archive", at, ...paths], { cwd: theCore, env, maxBuffer: 1 << 28 });
  execFileSync("tar", ["-x", "-f", "-", "-C", under], { cwd: dir, input: archive() });
  if (floor) { fs.mkdirSync(path.join(dir, floor), { recursive: true }); execFileSync("tar", ["-x", "-f", "-", "-C", floor, "--strip-components=1"], { cwd: dir, input: archive("floor") }); }
  for (const [f, text] of Object.entries({ "core-manifest.md": MANIFEST(), ".github/workflows/core.yml": CALLS(), ...files })) write(dir, f, text);
  if (without) fs.rmSync(path.join(dir, under, without));
  if (then) then(dir);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "a project");
  const github = { event_name: "pull_request", repository: `${held.login}/project`, repository_owner: held.login, event: { repository: { default_branch: branch, private: false, owner: held }, pull_request: { base: { sha: "" } } } };
  const [job] = runWorkflow(workflow, { github, base, temp: tmp, workspace: () => dir, uses: { "actions/checkout": checkoutStandIn(env, tmp) } });
  return { passed: job.passed, out: job.steps.map(s => s.out).join("") };
}
// (each case runs only in its section's part: a case that calls ok() itself stands in a block gated so too)
const passes = (what, ...args) => { if (!inPart(section)) return; const r = check(...args); ok(r.passed, `${what}: passes`, r.out); };
const fails = (what, words, ...args) => { if (!inPart(section)) return; const r = check(...args); ok(!r.passed && r.out.includes(words) && mended(r.out, { from: projectOf() }), `${what}: fails, saying so and its mend`, r.out); };

passes("a project whose copy is the core at its pin, each call pinned where its workflow is the same");
fails("a default branch of another name", "The default branch here is trunk", {}, { branch: "trunk" });
fails("a difference from the floor", "names the floor or the review guidelines", { "core-manifest.md": MANIFEST(B, "\n## Differences\n- `core/floor/security.md`, rule 12: main is pushed to here.\n") });
fails("a difference from the review guidelines, under a heading spelt otherwise", "names the floor or the review guidelines", { "core-manifest.md": MANIFEST(B, "\n### DIFFERENCES\n- the Review Guidelines: none here.\n") });
passes("a difference from a module", { "core-manifest.md": MANIFEST(B, "\n## Differences\n- `core/tasks/roles.md`, \"The builders\": Codex alone builds here, since no other tool is set up.\n") });
passes("a heading inside a fenced block, and the floor named outside the section", { "core-manifest.md": MANIFEST(B, "\n## Differences\n- `core/tasks/roles.md`, \"The builders\": none.\n\n## Notes\nThe floor holds whole.\n\n```\n# Differences\nthe floor\n```\n") });
fails("a manifest without its pin line", "no one \"Core:", { "core-manifest.md": MANIFEST().replace(/^Core: .*\n/m, "") });
fails("a manifest with two", "no one \"Core:", { "core-manifest.md": MANIFEST().replace(/^(Core: .*\n)/m, "$1$1") });
fails("a manifest without the owner's account, an organisation's account holding the repository", "owner's account", { "core-manifest.md": MANIFEST().replace(/^\| \*owner's account\*.*\n/m, "") });
if (inPart(section)) { // (#481: read where the host says a person's account holds it; a row, there, still decides)
  const r = check({ "core-manifest.md": MANIFEST().replace(/^\| \*owner's account\*.*\n/m, "") }, { held: { login: "someone", type: "User" } });
  ok(r.passed && r.out.includes("The owner's account is read: someone"), "a manifest without the owner's account, a person's account holding the repository: passes, saying what it read", r.out);
}
fails("a manifest without the owner's account, a login of no form holding the repository", "owner's account", { "core-manifest.md": MANIFEST().replace(/^\| \*owner's account\*.*\n/m, "") }, { held: { login: "a;b", type: "User" } });
fails("an owner's account row whose lead is spelt otherwise, a person's account holding the repository: never read past", "owner's account", { "core-manifest.md": MANIFEST().replace("| *owner's account* |", "| *owner’s Account* |") }, { held: { login: "someone", type: "User" } });
passes("the one owner's account row of its form beside a row spelt otherwise, as before", { "core-manifest.md": MANIFEST().replace(/^(\| \*owner's account\*.*\n)/m, "$1| *Owner's account* | `x` |\n") }, { held: { login: "someone", type: "User" } });
fails("an owner's account row with more in its first cell, a person's account holding the repository: never read past", "owner's account", { "core-manifest.md": MANIFEST().replace("| *owner's account* |", "| *owner's account* (a team's) |") }, { held: { login: "someone", type: "User" } });
fails("an owner's account that is no login, a person's account holding the repository", "owner's account", { "core-manifest.md": MANIFEST().replace(`\`${OWNER}\``, "`two words`") }, { held: { login: "someone", type: "User" } });
fails("a manifest with the owner's account twice", "owner's account", { "core-manifest.md": MANIFEST().replace(/^(\| \*owner's account\*.*\n)/m, "$1$1") });
fails("an owner's account that is no login", "owner's account", { "core-manifest.md": MANIFEST().replace(`\`${OWNER}\``, "`two words`") });
fails("a pin off the core's main", `the pin ${SIDE} is not a commit of the core's main`, { "core-manifest.md": MANIFEST(SIDE) });
fails("a call pinned where its workflow differs from the core's at the pin", "personal-terms.yml at", { ".github/workflows/core.yml": CALLS(A) });
fails("a call pinned off the core's main", "is not a commit of the core's main", { ".github/workflows/core.yml": CALLS(SIDE) });
fails("a call written in another form", "a call to the core not written", { ".github/workflows/core.yml": CALLS().replace(`core.yml@${A}`, "core.yml@main") });
fails("a call written in other letters, and in another form", "a call to the core not written", { ".github/workflows/core.yml": CALLS().replace(`${CORE}/.github/workflows/core.yml@${A}`, `${CORE.toLowerCase()}/.github/workflows/core.yml@main`) });
fails("a call in a workflow ending .yaml, quoted", `personal-terms.yml: ${SIDE} is not a commit of the core's main`, { ".github/workflows/other.yaml": `on: push\njobs:\n  terms:\n    uses: "${CORE}/.github/workflows/personal-terms.yml@${SIDE}"\n` });
passes("a copy of an older commit of the core's main, each call at it", { "core-manifest.md": MANIFEST(A), ".github/workflows/core.yml": CALLS(A, A) }, { at: A });
fails("a call pinned past the manifest's pin, where its workflow differs from the one at the pin", `personal-terms.yml at ${B} differs`, { "core-manifest.md": MANIFEST(A), ".github/workflows/core.yml": CALLS(B, A) }, { at: A });
passes("a copy of a commit whose report git quotes the name of, the reports left out as the copy leaves them", { "core-manifest.md": MANIFEST(C) }, { at: C });
fails("at that commit, a copy that differs outside the reports", "core/ differs from the core at its pin", { "core-manifest.md": MANIFEST(C), "core/README.md": "edited\n" }, { at: C });
passes("a copy without the owner's words, which the core keeps to itself too (#252)", {}, { then: dir => ok(!fs.existsSync(path.join(dir, "core", "words")), "  (the copy holds no words/)") });
fails("a copy that holds the owner's words all the same", "core/ differs from the core at its pin", { "core/words/items-001.md": "the owner's words\n" });
if (D) {
  passes("a copy of a commit with a top-level name that only ends in a tab and \"reports\", which the copy keeps", { "core-manifest.md": MANIFEST(D) }, { at: D });
  fails("and that copy without it", "core/ differs from the core at its pin", { "core-manifest.md": MANIFEST(D) }, { at: D, without: tabbed });
} else if (inPart("faults")) console.log("note a name holding a tab cannot be made here (Windows), so that case is not tried");
passes("a copy of a commit whose .gitattributes keeps the core's tests to it, without them (#527)", { "core-manifest.md": MANIFEST(E) }, { at: E, then: dir => ok(!fs.existsSync(path.join(dir, "core", "tests")), "  (the copy holds no tests/)") });
fails("at that commit, a copy that holds the core's tests all the same", "core/ differs from the core at its pin", { "core-manifest.md": MANIFEST(E), "core/tests/one-test.mjs": "a test of the core's\n" }, { at: E });
passes("a call in a comment, which is no call", { ".github/workflows/core.yml": `${CALLS()}# once: ${CORE}/.github/workflows/core.yml@main\n` });

// where the copy stands (tasks/repositories.md): the path the manifest's line names, and a core a library carries
section = "places";
const AT = (path, pin = B) => MANIFEST(pin).replace("copied whole under core/", `copied whole under ${path}`);
const CARRIED = (lib, under, floorCopy = "floor-copy/") => MANIFEST().replace(/^Core: .*$/m, `Core: ${CORE}, carried by ${lib} under ${under} (never edited here).${floorCopy ? `\nFloor copy: ${floorCopy}` : ""}`);
const LIBRARY = { "lib/core-manifest.md": MANIFEST(), "AGENTS.md": "# A project\n\n@floor-copy/security.md\n@lib/core/roles/builder.md\n" };
passes("a copy at the path the manifest names", { "core-manifest.md": AT("vendor/the-core/") }, { under: "vendor/the-core" });
fails("a copy elsewhere than the path the manifest names", "vendor/the-core/ is no folder of this commit", { "core-manifest.md": AT("vendor/the-core/") });
fails("a path where an install writes", "where no checkout holds the files", { "core-manifest.md": AT("node_modules/the-core/") }, { under: "node_modules/the-core" });
fails("a path with a segment that climbs out, after a plain one", "has no one \"Core:", { "core-manifest.md": AT("core/../evil/") }, { under: "core" });
fails("a path that climbs out of the repository", "has no one \"Core:", { "core-manifest.md": AT("../core/") });
passes("a core a library carries, its files committed, with the floor's own copy", { "core-manifest.md": CARRIED("lib/", "lib/core/"), ...LIBRARY }, { under: "lib/core", floor: "floor-copy" });
fails("without the floor's own copy, while no tool has passed the staged cases carried and no-floor", "not every agent tool has passed", { "core-manifest.md": CARRIED("lib/", "lib/core/", null), ...LIBRARY }, { under: "lib/core" });
fails("with a floor's copy that differs from the floor at the pin", "floor-copy/ differs from the floor of the core at its pin", { "core-manifest.md": CARRIED("lib/", "lib/core/"), ...LIBRARY, "floor-copy/security.md": "edited\n" }, { under: "lib/core", floor: "floor-copy" });
fails("with a floor's copy that AGENTS.md does not name", "AGENTS.md does not name floor-copy/security.md", { "core-manifest.md": CARRIED("lib/", "lib/core/"), ...LIBRARY, "AGENTS.md": "# A project\n\n@lib/core/floor/security.md\n" }, { under: "lib/core", floor: "floor-copy" });
fails("with a floor's copy named that is not there", "floor-copy/, the floor's own copy core-manifest.md names, is no folder", { "core-manifest.md": CARRIED("lib/", "lib/core/"), ...LIBRARY }, { under: "lib/core" });
fails("a carried core whose path is not the library's", "the library's manifest under lib/core/", { "core-manifest.md": CARRIED("lib/", "lib/other/"), ...LIBRARY }, { under: "lib/core", floor: "floor-copy" });
fails("a carried core whose copy differs from the core at the library's pin", "lib/core/ differs from the core at its pin", { "core-manifest.md": CARRIED("lib/", "lib/core/"), ...LIBRARY, "lib/core/README.md": "edited\n" }, { under: "lib/core", floor: "floor-copy" });
fails("a library that is not in this commit", "the library lib, which core-manifest.md says carries the core, is no folder or submodule", { "core-manifest.md": CARRIED("lib/", "lib/core/") }, { floor: "floor-copy" });
fails("a library whose manifest pins no copy", "lib/core-manifest.md has no one", { "core-manifest.md": CARRIED("lib/", "lib/core/"), "lib/core-manifest.md": "# Core manifest\n" }, { under: "lib/core", floor: "floor-copy" });
if (inPart("places")) {
  // (a submodule: the library's commit pinned here, fetched by the check from the https address .gitmodules gives it,
  // here a library of the test's own reached through a rewrite, and held to the core at the library's pin)
  const libRepo = path.join(tmp, "the-library"), address = "https://example.invalid/the-library";
  fs.mkdirSync(path.join(libRepo, "core"), { recursive: true });
  git(libRepo, "init", "-q", "-b", "main");
  execFileSync("tar", ["-x", "-f", "-", "-C", "core"], { cwd: libRepo, input: execFileSync("git", ["archive", B], { cwd: theCore, env, maxBuffer: 1 << 28 }) });
  write(libRepo, "core-manifest.md", MANIFEST());
  git(libRepo, "add", "-A"); git(libRepo, "commit", "-q", "-m", "the library");
  git(libRepo, "config", "uploadpack.allowAnySHA1InWant", "true");
  const good = git(libRepo, "rev-parse", "HEAD");
  write(libRepo, "core/README.md", "edited\n"); git(libRepo, "commit", "-q", "-am", "an edited copy");
  const edited = git(libRepo, "rev-parse", "HEAD");
  const n = Number(env.GIT_CONFIG_COUNT), reach = { ...env, GIT_CONFIG_COUNT: String(n + 1), [`GIT_CONFIG_KEY_${n}`]: `url.${slash(libRepo)}.insteadOf`, [`GIT_CONFIG_VALUE_${n}`]: address };
  const sub = (sha, url = address) => ({ base: reach, floor: "floor-copy", then: dir => { fs.mkdirSync(path.join(dir, "lib")); write(dir, ".gitmodules", `[submodule "lib"]\n\tpath = lib\n\turl = ${url}\n`); git(dir, "update-index", "--add", "--cacheinfo", `160000,${sha},lib`); } });
  const files = { "core-manifest.md": CARRIED("lib/", "lib/core/"), "AGENTS.md": LIBRARY["AGENTS.md"] };
  passes("a core a submodule carries, its commit fetched with no token and its copy the core at the library's pin, with the floor's own copy", files, sub(good));
  fails("a submodule whose commit holds a copy that differs from the core", "lib/core/ differs from the core at its pin", files, sub(edited));
  fails("a submodule with no https address", "could not be fetched at the commit pinned here", files, sub(good, slash(libRepo)));
  fails("a floor's copy beside a submodule, that differs from the floor at the library's pin", "floor-copy/ differs from the floor", { ...files, "floor-copy/security.md": "edited\n" }, sub(good));
}
if (inPart("places")) {
  // (the staged cases' record on the core's main: a tool counts as passed by its own runs alone)
  const record = tools => ({ runs: tools.map(tool => ({ at: "2026-11-16", tool, cases: { carried: { verdict: "pass" }, "no-floor": { verdict: "pass" } } })) });
  const onMain = (tools, what) => { write(theCore, "reports/staged-cases.json", `${JSON.stringify(record(tools))}\n`); git(theCore, "add", "-A"); git(theCore, "commit", "-q", "-m", what); };
  const all = JSON.parse(fs.readFileSync(path.join(root, "scripts/staged-tools.json"), "utf8")).tools;
  onMain(all.slice(0, 1), "one tool passed");
  fails("a carried core with no floor's copy, where only one tool has passed and the others never ran the cases", `${all[1]} (carried)`, { "core-manifest.md": CARRIED("lib/", "lib/core/", null), ...LIBRARY }, { under: "lib/core" });
  write(theCore, "reports/staged-cases.json", `${JSON.stringify({ runs: record(all).runs.map((r, i) => (i ? r : { ...r, cases: { ...r.cases, carried: { verdict: "pass", wrong: "the session read the floor from a copy the case left" } } })) })}\n`);
  git(theCore, "add", "-A"); git(theCore, "commit", "-q", "-m", "a pass found wrong");
  fails("where one tool's last pass was found wrong, which proves nothing", `${all[0]} (carried)`, { "core-manifest.md": CARRIED("lib/", "lib/core/", null), ...LIBRARY }, { under: "lib/core" });
  onMain(all, "every tool passed");
  passes("and once every tool the core names has passed both, it needs no floor's copy", { "core-manifest.md": CARRIED("lib/", "lib/core/", null), ...LIBRARY }, { under: "lib/core" });
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the copy of the core's check${PART === "all" ? "" : `, the part ${PART}`}`);
process.exitCode = failed ? 1 : 0;
