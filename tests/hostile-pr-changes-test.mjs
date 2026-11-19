// Hostile tests of one input the core names under floor rule 5 (floor/topics/input.md): what a pull request changes (the
// paths and content of its files, its commits, a branch from a fork, which is any of these). Each reader is tried with
// what a branch could hold, as each case's shape allows: too long, the wrong type, markup, a file path, a number out of
// range, and nothing at all; each refuses, taking nothing of it as a pass. The readers: pure-sync.mjs and
// comment-only.mjs, run as a merger runs them in a scratch project whose core is reached by a git rewrite (no network);
// select.mjs, run as the tests workflow runs it there; copy-tree.mjs, on trees made here; and pr-description.mjs's reader of
// what a pull request adds under its manifest's "Differences" (#756), on commits made here. Test data is made up. Run
// by the core's tests workflow (.github/workflows/tests.yml). Git and Node's own modules.
//
//   node tests/hostile-pr-changes-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CORE } from "../scripts/core-address.mjs";
import { coreIsFolder, entries } from "../scripts/copy-tree.mjs";
import { MANIFEST_MAX, UNREADABLE, differencesAdded, reasonsMend } from "../scripts/pr-description.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir, scratchEnv, root } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };

const tmp = scratchDir("hostile-pr-changes-");
const theCore = path.join(tmp, "the-core"), origin = path.join(tmp, "origin.git"), p = path.join(tmp, "project");
const env = scratchEnv(theCore, tmp);
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }).trim();
// (whether this system's files can be named with a line's end or a control character: Windows's cannot)
const NAMES = process.platform !== "win32";
// (how many files a pull request adds at most, in the cases of many: each is written and committed, which on Windows is slow)
const MANY = 1000;
const write = (f, text) => { fs.mkdirSync(path.dirname(path.join(p, f)), { recursive: true }); fs.writeFileSync(path.join(p, f), text); };
const run = (script, args = [], more = {}) => {
  const started = Date.now(), r = spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], { cwd: p, env: { ...env, ...more }, encoding: "utf8", maxBuffer: 1 << 28 });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, ms: Date.now() - started };
};
const raw = out => /\n\s+at |TypeError|ReferenceError|RangeError/u.test(out);
const lines = out => out.split("\n");

// ---- a core of two files, and a project that holds its copy, pinned, following the core's main ----
fs.mkdirSync(path.join(theCore, "scripts"), { recursive: true });
fs.writeFileSync(path.join(theCore, "README.md"), "a core for the test\n");
fs.writeFileSync(path.join(theCore, "scripts/x.mjs"), "export const x = 1;\n");
git(tmp, "init", "-q", "-b", "main", theCore);
git(theCore, "add", "-A");
git(theCore, "commit", "-q", "-m", "the core");
const PIN = git(theCore, "rev-parse", "HEAD");
git(tmp, "init", "-q", "--bare", "-b", "main", origin);
git(tmp, "init", "-q", "-b", "main", p);
git(p, "remote", "add", "origin", origin);
fs.cpSync(theCore, path.join(p, "core"), { recursive: true, filter: s => path.basename(s) !== ".git" });
const MANIFEST = `# Core manifest\n\nCore: ${CORE} at ${PIN}, copied whole under core/\n\n| Slot | Here |\n| --- | --- |\n| *follows* | \`main\` |\n`;
write("core-manifest.md", MANIFEST);
const WORKFLOW = "on: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - name: say\n        run: echo hi\n";
write(".github/workflows/a.yml", WORKFLOW);
write("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src/"], tests: ["test/"] }));
write("src/a.mjs", "export const a = 1;\n");
write("test/a.test.mjs", 'import { a } from "../src/a.mjs";\nconsole.log(a);\n');
git(p, "add", "-A");
git(p, "commit", "-q", "-m", "main");
git(p, "push", "-q", "origin", "main");
const MAIN = git(p, "rev-parse", "HEAD");
// A branch off main with `change` made and committed, checked out in the project.
const branch = (name, change) => {
  git(p, "checkout", "-q", "-B", name, MAIN);
  change();
  git(p, "add", "-A");
  git(p, "commit", "-q", "--allow-empty", "-m", name);
};
const link = (to, f) => { fs.mkdirSync(path.dirname(path.join(p, f)), { recursive: true }); fs.symlinkSync(to, path.join(p, f)); };
const outside = path.join(tmp, "outside");
fs.mkdirSync(outside);
fs.writeFileSync(path.join(outside, "secret.txt"), "not the project's\n");

// (a path with "..", or an absolute one, cannot be carried: git keeps no such path in a tree, its index refusing it,
// so of the file paths a branch can hold only links leading out, and names with a line's end or control characters,
// are tried)

// ---- pure-sync.mjs: what a sync branch carries ----
const pure = () => run("pure-sync.mjs");
const notPure = (r, why) => r.status === 1 && r.out.includes("not a pure sync") && (!why || r.out.includes(why)) && !raw(r.out);

branch("big", () => write("core/big.txt", "x".repeat(8 << 20)));
let r = pure();
ok(notPure(r, "core/ is not a folder holding the core's tree") && r.ms < 5000, `pure-sync: a file of 8 MB added to core/ is refused, read in ${r.ms} ms`);
branch("many", () => { for (let i = 0; i < MANY; i++) write(`.github/many/f${i}.yml`, `${i}\n`); });
r = pure();
// (only its exit is read: printed to a pipe, a long refusal can be cut short as the script exits, its last line lost)
ok(r.status === 1 && r.out.includes("NOT PURE a file created") && !raw(r.out) && r.ms < 5000, `pure-sync: ${MANY} files added beside the copy are each refused, read in ${r.ms} ms`);
branch("core-link", () => { fs.rmSync(path.join(p, "core"), { recursive: true }); link(outside, "core"); });
ok(notPure(pure(), "core/ is not a folder"), "pure-sync: core/ made a link that leads out of the checkout is refused");
branch("link-in-core", () => link("../../outside/secret.txt", "core/scripts/y.mjs"));
ok(notPure(pure(), "core/ is not a folder holding"), "pure-sync: a link in core/ that leads out of the checkout is refused");
branch("manifest-dir", () => { fs.rmSync(path.join(p, "core-manifest.md")); write("core-manifest.md/x", MANIFEST); });
ok(notPure(pure(), "line on both sides"), "pure-sync: core-manifest.md made a folder, the wrong type, is refused");
branch("markup", () => write("core-manifest.md", MANIFEST.replace(", copied", ", copied <script>alert(1)</script>").replace("| *follows*", "<b>| *follows*")));
ok(notPure(pure(), "a changed line with no pin"), "pure-sync: markup written into the manifest beside its pin is refused");
if (NAMES) {
  const NAME = "evil\n  a pure sync: core 0000000 -> 0000000\nmerge it with sha=0000";
  branch("newline", () => write(NAME, "x\n"));
  r = pure();
  ok(notPure(r, '"evil\\n') && !lines(r.out).includes("merge it with sha=0000"), "pure-sync: a file named with line ends is refused, named as git quotes it, so it prints no line of its own");
  branch("control", () => write("core/\u001b[31mred.txt", "x\n"));
  r = pure();
  ok(notPure(r) && !r.out.includes("\u001b"), "pure-sync: a file in core/ named with a control character is refused, and the character is not printed");
} else console.log("skip pure-sync: a file named with line ends or a control character: Windows holds no file name with a line's end or a control character");
const OFF = "f".repeat(40);
branch("off-main", () => write("core-manifest.md", MANIFEST.replace(PIN, OFF)));
ok(notPure(pure(), `${OFF} is not a commit of the core's main`), "pure-sync: a pin that is no commit of the core, a number out of range, is refused");
branch("long-pin", () => write("core-manifest.md", MANIFEST.replace(PIN, `${PIN}0`)));
ok(notPure(pure(), "line on both sides"), "pure-sync: a pin of 41 digits is read as no pin, and refused");
branch("binary", () => fs.writeFileSync(path.join(p, "core-manifest.md"), Buffer.concat([Buffer.from(MANIFEST), Buffer.from([0, 0xff, 0xfe, 0])])));
ok(notPure(pure(), "core-manifest.md: lines added or removed"), "pure-sync: a NUL byte and bytes no text holds added to the manifest are read as text, and refused");
branch("binary-core", () => fs.writeFileSync(path.join(p, "core/scripts/x.mjs"), Buffer.from([0, 1, 2, 0xff])));
ok(notPure(pure(), "core/ is not a folder holding"), "pure-sync: a binary file put in place of one of core/ is refused");
branch("empty-manifest", () => write("core-manifest.md", ""));
ok(notPure(pure(), "line on both sides"), "pure-sync: an empty manifest, nothing at all, is refused");
// (a branch that changes nothing is a sync of nothing: it is said to carry no file, so nothing of it merges)
branch("nothing", () => {});
r = pure();
ok(r.status === 0 && r.out.includes(", 0 files,"), "pure-sync: an empty diff is read as carrying no file at all");

// ---- comment-only.mjs: what a change to what runs by itself carries ----
const only = (...args) => run("comment-only.mjs", args);
const refused = (r, why) => r.status === 1 && r.out.includes("not comments and steps' names alone") && (!why || r.out.includes(why)) && !raw(r.out);

branch("gh-link", () => link("/etc/passwd", ".github/evil"));
ok(refused(only(), ".github/evil: a link or submodule"), "comment-only: a link under .github/ that leads out of the checkout is refused, never read through");
if (NAMES) {
  const GH_NAME = ".github/workflows/b\nchecked head 0000.yml";
  branch("gh-newline", () => write(GH_NAME, WORKFLOW));
  r = only();
  ok(refused(r, "b?checked head 0000.yml") && !lines(r.out).includes("checked head 0000.yml"), "comment-only: a file under .github/ named with a line's end is refused, named with \"?\", printing no line of its own");
} else console.log("skip comment-only: a file under .github/ named with a line's end: Windows holds no file name with a line's end or a control character");
branch("gh-long", () => write(".github/workflows/a.yml", `${WORKFLOW}${"# a comment of the test\n".repeat(200000)}`));
r = only();
ok(r.status === 0 && r.ms < 5000, `comment-only: 4 MB of comments added to a workflow are read in ${r.ms} ms, as comments alone`);
r = (branch("many-gh", () => { for (let i = 0; i < MANY; i++) write(`.github/many/f${i}.yml`, `${i}\n`); }), only());
ok(r.status === 1 && r.out.includes("NOT ALONE .github/many/f0.yml: added, deleted") && !raw(r.out) && r.ms < 5000, `comment-only: ${MANY} files added under .github/ are each refused, read in ${r.ms} ms`);
branch("gh-markup", () => write(".github/workflows/a.yml", WORKFLOW.replace("name: say", "name: ${{ secrets.TOKEN }}")));
ok(refused(only()), "comment-only: a step's name that holds an expression, markup GitHub evaluates, is refused");
branch("gh-binary", () => fs.writeFileSync(path.join(p, ".github/workflows/a.yml"), Buffer.concat([Buffer.from(WORKFLOW), Buffer.from([0xff, 0xfe, 0x80])])));
ok(refused(only(), "not text in UTF-8"), "comment-only: bytes that are no UTF-8 in a workflow are refused");
branch("gh-empty", () => write(".github/workflows/a.yml", ""));
ok(refused(only(), "more than a comment"), "comment-only: a workflow emptied, nothing at all, is refused");
branch("gh-dir", () => { fs.rmSync(path.join(p, ".github/workflows/a.yml")); write(".github/workflows/a.yml/x.yml", WORKFLOW); });
ok(refused(only(), "added, deleted"), "comment-only: a workflow made a folder, the wrong type, is refused");
if (process.platform !== "win32") {
  branch("gh-mode", () => fs.chmodSync(path.join(p, ".github/workflows/a.yml"), 0o755));
  ok(refused(only(), "its mode or kind changed"), "comment-only: a workflow's mode changed is refused");
} else console.log("skip comment-only: a workflow's mode changed: Windows keeps no mode for git to read");
branch("gh-nothing", () => {});
r = only();
ok(r.status === 0 && r.out.includes("nothing changed in .github/") && !r.out.includes("comments and steps' names alone in"), "comment-only: an empty diff is read as no file proven");
for (const [what, arg] of [["names no commit", "no-such-commit"], ["is a path", "../../etc/passwd"], ["is an option", "--output=x"], ["is all noughts", "0".repeat(40)]]) {
  r = only(arg);
  ok(r.status === 1 && r.out.includes("is no commit before the head") && !raw(r.out), `comment-only: an argument that ${what} is refused in its own words, no stack of git's`);
}
// (a refusal past what a pipe holds at once, printed whole before its script exits: whole-output.mjs, which pure-sync.mjs,
// comment-only.mjs and copies.mjs import first)
{
  const last = "FAIL: the last line. Mend: none, a test's", script = path.join(tmp, "long-refusal.mjs");
  fs.writeFileSync(script, `import ${JSON.stringify(new URL("../scripts/whole-output.mjs", import.meta.url).href)};\nfor (let i = 0; i < 20000; i++) console.error("x".repeat(99));\nconsole.error(${JSON.stringify(last)});\nprocess.exit(1);\n`);
  const cut = spawnSync(process.execPath, [script], { encoding: "utf8", maxBuffer: 1 << 28 });
  ok(cut.status === 1 && cut.stderr.length === 20000 * 100 + last.length + 1 && cut.stderr.trimEnd().endsWith(last), "two megabytes printed through a pipe before process.exit reach it whole, its last line, the mend, included");
  ok([..."pure-sync.mjs comment-only.mjs copies.mjs".split(" ")].every(f => /^import "\.\/whole-output\.mjs";$/mu.test(fs.readFileSync(path.join(root, "scripts", f), "utf8"))), "pure-sync.mjs, comment-only.mjs and copies.mjs each import whole-output.mjs");
}

// ---- select.mjs: the changed paths, as the tests workflow reads them ----
const envFile = path.join(tmp, "github-env");
const select = (more = {}, ...args) => { fs.writeFileSync(envFile, ""); return run("select.mjs", ["--env", "RUN", ...args], { SELECT_BASE: MAIN, GITHUB_ENV: envFile, ...more }); };
const said = () => fs.readFileSync(envFile, "utf8");
if (NAMES) {
  branch("sel-newline", () => write("test/b\nX=1.test.mjs", 'import "../src/a.mjs";\n'));
  r = select();
  ok(r.status === 0 && said() === "RUN=all\n", "select: a test named with a line's end sets no variable of its own: the whole suite runs");
} else console.log("skip select: a test named with a line's end: Windows holds no file name with a line's end or a control character");
branch("sel-space", () => write("test/b c.test.mjs", 'import "../src/a.mjs";\n'));
ok(select().status === 0 && said() === "RUN=all\n", "select: a test named with a space, which a list of names cannot hold, runs the whole suite");
branch("sel-binary", () => fs.writeFileSync(path.join(p, "src/a.mjs"), Buffer.from([0, 0xff, 0x27, 0x22, 0x60, 10])));
r = select();
ok(r.status === 0 && !raw(r.out) && /^RUN=( test\/a\.test\.mjs |all)\n$/u.test(said()), "select: a binary file in place of code is read without a fault, and selects what reaches it, or all");
branch("sel-many", () => { for (let i = 0; i < MANY; i++) write(`docs/f${i}.md`, `${i}\n`); });
r = select();
ok(r.status === 0 && said() === "RUN=all\n" && r.ms < 5000, `select: ${MANY} changed files that are no code run the whole suite, read in ${r.ms} ms`);
branch("sel-nothing", () => {});
r = select();
ok(r.status === 0 && said() === "RUN=  \n", "select: an empty diff selects no test");
for (const base of ["--output=/tmp/x", "main;touch x", "HEAD~99999"]) {
  r = select({ SELECT_BASE: base });
  ok(r.status === 1 && r.out.includes("Mend:") && said() === "" && !fs.existsSync(path.join(p, "x")), `select: SELECT_BASE ${JSON.stringify(base)} is refused with its mend, and nothing is written`);
}
r = select({}, "--failed", path.join(tmp, "none"));
ok(r.status === 1 && r.out.includes("Mend:") && said() === "", "select: a --failed file that is not there is refused with its mend");

// ---- copy-tree.mjs: the copy's tree, compared entry by entry ----
const gitDir = path.join(p, ".git");
const blob = text => execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: p, env, input: text, encoding: "utf8" }).trim();
const tree = list => execFileSync("git", ["mktree", "-z"], { cwd: p, env, input: list.map(([mode, type, id, name]) => `${mode} ${type} ${id}\t${name}\0`).join(""), encoding: "utf8" }).trim();
const X = blob("x\n");
const twoNames = tree([["100644", "blob", X, "a"], ["100644", "blob", X, "b"]]), oneName = tree([["100644", "blob", X, "a\nb"]]);
ok(entries(oneName, gitDir) !== entries(twoNames, gitDir) && !entries(oneName, gitDir).includes("\ta\nb"), "copy-tree: a name holding a line's end is quoted, never read as two entries");
const asFile = tree([["100644", "blob", blob("../../outside/secret.txt"), "y"]]), asLink = tree([["120000", "blob", blob("../../outside/secret.txt"), "y"]]);
ok(entries(asFile, gitDir) !== entries(asLink, gitDir), "copy-tree: a link that leads out is no file of the same text");
const big = tree(Array.from({ length: 20000 }, (_, i) => ["100644", "blob", X, `f${String(i).padStart(5, "0")}`]));
let t = Date.now();
ok(entries(big, gitDir).split("\n").length === 20000 && Date.now() - t < 5000, `copy-tree: a tree of 20,000 entries is listed in ${Date.now() - t} ms`);
const commitOf = (t2) => git(p, "commit-tree", t2, "-m", "x");
const withCore = entry => commitOf(tree([entry]));
ok(!coreIsFolder(withCore(["120000", "blob", blob(outside), "core"]), gitDir), "copy-tree: core/ as a link is no folder");
ok(!coreIsFolder(withCore(["100644", "blob", X, "core"]), gitDir), "copy-tree: core/ as a file, the wrong type, is no folder");
ok(!coreIsFolder(withCore(["160000", "commit", MAIN, "core"]), gitDir), "copy-tree: core/ as a submodule is no folder");
ok(!coreIsFolder(commitOf(tree([])), gitDir) && entries(tree([]), gitDir) === "", "copy-tree: an empty tree holds no core/ and no entry");
ok(!coreIsFolder("--output=x", gitDir) && !fs.existsSync(path.join(p, "x")), "copy-tree: a commit named as an option is no folder, and writes nothing");

// ---- pr-description.mjs: what a pull request adds under its manifest's "Differences" (#756) ----
{
  const d = path.join(tmp, "differences");
  fs.mkdirSync(d);
  const g = (...args) => git(d, ...args);
  const manifest = (...lines) => `# Core manifest\n\n## Differences\n\n${lines.join("\n")}\n`;
  const put = text => { fs.rmSync(path.join(d, "core-manifest.md"), { recursive: true, force: true }); if (text !== null) fs.writeFileSync(path.join(d, "core-manifest.md"), text); };
  const commit = () => { g("add", "-A"); g("commit", "-q", "--allow-empty", "-m", "x"); };
  g("init", "-q", "-b", "main");
  put(manifest("None.")); commit();
  // too long: a new difference, then padding past what git hands over
  put(`${manifest("- a new difference, with no reasons read")}\n## Slots\n\n${"x".repeat(MANIFEST_MAX + 1024)}\n`); commit();
  const long = differencesAdded(d);
  ok(long === UNREADABLE && mended(`FAIL ${reasonsMend("Reasons read: x", long)}`), "pr-description: a manifest past what git hands over is unreadable and fails with its mend, even beside a line \"Reasons read:\", never read as no difference");
  // the wrong type: a folder, then a submodule, where the manifest stands
  put(null); fs.mkdirSync(path.join(d, "core-manifest.md")); fs.writeFileSync(path.join(d, "core-manifest.md", "x"), "- a difference\n"); commit();
  ok(differencesAdded(d) === UNREADABLE, "pr-description: a folder named core-manifest.md is unreadable");
  fs.rmSync(path.join(d, "core-manifest.md"), { recursive: true, force: true }); g("add", "-A");
  g("update-index", "--add", "--cacheinfo", `160000,${g("rev-parse", "HEAD")},core-manifest.md`); g("commit", "-q", "-m", "x");
  ok(differencesAdded(d) === UNREADABLE, "pr-description: a submodule named core-manifest.md is unreadable");
  // markup: a difference that holds a runner's command and control characters is read as one line added, and quoted
  // in the mend with none of them able to open a line
  g("rm", "-q", "--cached", "core-manifest.md"); put(manifest("- ::error::x\u0085\u2028::warning::y\u001b[2J")); commit();
  const marked = differencesAdded(d), markedMend = reasonsMend("", marked);
  ok(Array.isArray(marked) && marked.length === 1 && mended(`FAIL ${markedMend}`) && !/[\r\n\u0085\u2028\u001b]/u.test(markedMend), "pr-description: markup in a difference is one line added, quoted with no character that ends a line or drives a terminal");
  // nothing at all: an empty manifest, then none, adds no difference; a base it cannot read counts every line as added
  put(""); commit();
  ok(Array.isArray(differencesAdded(d)) && differencesAdded(d).length === 0, "pr-description: an empty manifest adds no difference");
  put(null); commit();
  ok(Array.isArray(differencesAdded(d)) && differencesAdded(d).length === 0, "pr-description: a manifest taken out adds no difference");
  fs.mkdirSync(path.join(d, "core-manifest.md")); fs.writeFileSync(path.join(d, "core-manifest.md", "x"), "x\n"); commit();
  put(manifest("- a difference over an unreadable base")); commit();
  ok(differencesAdded(d).join() === "- a difference over an unreadable base", "pr-description: over a base whose manifest cannot be read, each difference of the head's counts as added");
}

process.exit(failed ? 1 : 0);
