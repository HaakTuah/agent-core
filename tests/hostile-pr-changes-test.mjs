// Hostile tests of one input the core names under floor rule 5 (floor/topics/input.md): what a pull request changes (the
// paths and content of its files, its commits, a branch from a fork, which is any of these). Each reader is tried with
// what a branch could hold, as each case's shape allows: too long, the wrong type, markup, a file path, a number out of
// range, and nothing at all; each refuses, taking nothing of it as a pass. The readers: pure-sync.mjs and
// comment-only.mjs, run as a merger runs them in a scratch project whose core is reached by a git rewrite (no network);
// select.mjs, run as the tests workflow runs it there, and the shape check's readers on the parser that it reads code
// through, on files at and just past the largest each takes (#844, #862); copy-tree.mjs, on trees made here; and
// pr-description.mjs's reader of what a pull request adds under its manifest's "Differences" (#756), on commits made
// here; reading.mjs's reader of the checkout's rule files (#848), on a checkout made here; and read-total.mjs's cut and
// its conditions (#469), on trees held in memory. Test data is made up. Run
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
import { readCsharp } from "../scripts/shape-csharp.mjs";
import { readPython } from "../scripts/shape-python.mjs";
import { javascriptFunctions } from "../scripts/javascript-functions.mjs";
import { library, regular } from "../scripts/reading.mjs";
import { rules } from "../scripts/rules.mjs";
import { LIMITS, conditions, cuts, total, tree as readTree } from "../scripts/read-total.mjs";
import { LARGEST } from "../scripts/tree-walk.mjs";
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
// (git for Windows stops at a path of 260 characters unless told otherwise, and the case "long-name" holds a file name of 254 characters,
// one short of the longest a name can be (255), which with this folder's own path passes it: the name stays at what the case proves, and git takes long paths here; #1038)
git(p, "config", "core.longpaths", "true");
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
// (a file created goes on to the proof of what the one process writes, #1083, which proves none of these)
ok(r.status === 1 && /NOT PURE[^\n]*\.github\/many\/f0\.yml[:,] /.test(r.out) && !raw(r.out) && r.ms < 5000, `pure-sync: ${MANY} files added beside the copy are each refused, read in ${r.ms} ms`);
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
branch("gh-quoted", () => write(".github/workflows/a.yml", `${WORKFLOW}x: [${Array(48000).fill('"a"').join(",")}]\n`));
r = only();
ok(refused(r, "more than a comment") && r.ms < 5000, `comment-only: a list of 48,000 quoted words added to a workflow is read in ${r.ms} ms and refused (#1313)`);
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
// (dense code of each kind found for each reader at the largest it takes: one long list, braces nested as deep as the
// grammar goes, one call of many arguments, after a chain of casts too, a line of many statements, a tuple of many
// names, and statements C# holds no such thing as, which its grammar recovers from at about 50 s a megabyte; each read
// as the job reads it, the process, its parser's thread and the grammar started, stopped at SECURITY.md's 5 s)
const filled = (head, unit, tail, size) => `${head}${unit.repeat(Math.floor((size - head.length - tail.length) / unit.length))}${tail}`;
const nested = size => { const d = Math.floor((size - 22) / 2); return `class C { void M() ${"{".repeat(d)}${"}".repeat(d)} }\n`; };
const SLOWEST = {
  "src/list.py": size => filled("x = [", "a,", "]\n", size),
  "src/list.js": size => filled("x = [", "a,", "];\n", size),
  "src/nested.cs": nested,
  "src/bare.cs": size => filled("class C { void M() {", "x;", "} }\n", size),
  "src/call.cs": size => filled("class C { void M() { f(", "a,", "a); } }\n", size),
  "src/statements.py": size => filled("", "a;", "a\n", size),
  "src/casts.cs": size => filled(`class C { object x = ${"(A)".repeat(20000)}c; void M() { f(a`, ",a", "); } }\n", size),
  "src/tuple.py": size => filled("def f():\n    x = a", ",a", "\n", size),
};
const largestOf = file => LARGEST[{ ".py": "python", ".js": "javascript", ".cs": "csharp" }[path.extname(file)]];
for (const [file, made] of Object.entries(SLOWEST)) {
  const text = made(largestOf(file));
  branch(`sel-${path.basename(file)}`, () => write(file, text));
  fs.writeFileSync(envFile, "");
  const timed = spawnSync(process.execPath, [path.join(root, "scripts", "select.mjs"), "--env", "RUN"], { cwd: p, env: { ...env, SELECT_BASE: MAIN, GITHUB_ENV: envFile }, encoding: "utf8", maxBuffer: 1 << 28, timeout: 5000 });
  ok(timed.status === 0 && !raw(`${timed.stdout}${timed.stderr}`) && /^RUN=/u.test(said()), `select: ${file} of ${text.length} characters, the largest its reader takes, is read within 5 s and selects`, `${timed.signal ?? ""}${timed.stderr}`);
}
// (the count is no limit of its own: several files each at the largest its reader takes, and one file past it that the
// lexer alone reads, together take the selection past 5 s unless it stops reading and runs the whole suite; #881)
const together = (key, what, files, whole = true) => {
  branch(`sel-${key}`, () => { for (const [file, text] of Object.entries(files)) write(file, text); });
  fs.writeFileSync(envFile, "");
  const from = Date.now(), timed = spawnSync(process.execPath, [path.join(root, "scripts", "select.mjs"), "--env", "RUN"], { cwd: p, env: { ...env, SELECT_BASE: MAIN, GITHUB_ENV: envFile }, encoding: "utf8", maxBuffer: 1 << 28, timeout: 5000 });
  console.log(`     ${key}: ${Date.now() - from} ms`);
  ok(timed.status === 0 && !raw(`${timed.stdout}${timed.stderr}`) && (whole ? said() === "RUN=all\n" : /^RUN=/u.test(said())), `select: ${what} are read within 5 s${whole ? ", and the whole suite runs" : " and select"}`, `${timed.signal ?? ""}${timed.stderr}${said()}`);
};
// (and the linking of each file to the files whose names it holds, which took time in step with the count of files times their
// text, and the search from each test: the answer is the whole suite where the pace is passed, else the tests it selects)
together("many-mid", "2300 files of 1,500 characters, under the limit in characters", Object.fromEntries(Array.from({ length: 2300 }, (_, n) => [`src/f${n}.js`, `export const v = "${" f1.j".repeat(300)}";\n`])), false);
together("one-long", "4000 small files and one of 3.8 million characters", { ...Object.fromEntries(Array.from({ length: 4000 }, (_, n) => [`src/g${n}.js`, `export const v = ${n};\n`])), "src/long.js": `export const v = "${"a ".repeat(1_900_000)}";\n` }, false);
together("tests-naming", "700 test files that each name the 699 others", Object.fromEntries(Array.from({ length: 700 }, (_, n) => [`test/t${n}.js`, `export const v = "${Array.from({ length: 700 }, (_, k) => `t${k}.js`).join(" ")}";\n`])), false);
together("long-name", "a file with a name of 254 characters and one of 3.8 million characters that starts it at every other one", { [`src/${"a,".repeat(125)}b.js`]: "export const v = 1;\n", "src/long.js": `export const v = "${"a,".repeat(1_900_000)}";\n` });
together("csharp-three", "three files of C# at the largest its reader takes", Object.fromEntries([1, 2, 3].map(n => [`src/call${n}.cs`, SLOWEST["src/call.cs"](LARGEST.csharp)])));
together("every-kind", "the densest file of each kind, all at once", Object.fromEntries(Object.entries(SLOWEST).map(([file, made]) => [file, made(largestOf(file))])));
together("js-huge", "one file of JavaScript of 20 million characters", { "src/huge.js": SLOWEST["src/list.js"](20_000_000) });
// (the project's own files, which a pull request leaves as they were, are read too, so a project's size is held as the
// changed files are: one of 6.5 million characters of JavaScript still selects within 5 s, as the selection reads no
// functions; one of 6.9 million of Python, whose imports only its parser reads, answers the whole suite at the whole run's
// budget; and one file of 20 million characters it leaves as it was, which the lexer alone would read for 5 s, answers it
// before any is read; each took past 5 s before, and each answer stands at two times the whole run's budget or more
// either way, for a slower runner; #962)
const large = (key, what, files, change, said1) => {
  git(p, "checkout", "-q", "-B", `sel-${key}-base`, MAIN);
  for (const [file, text] of Object.entries(files)) write(file, text);
  git(p, "add", "-A");
  git(p, "commit", "-q", "-m", key);
  const base = git(p, "rev-parse", "HEAD");
  branch(`sel-${key}`, () => {});
  git(p, "reset", "-q", "--hard", base);
  change();
  git(p, "commit", "-q", "-am", `${key}: the change`);
  fs.writeFileSync(envFile, "");
  const from = Date.now(), timed = spawnSync(process.execPath, [path.join(root, "scripts", "select.mjs"), "--env", "RUN"], { cwd: p, env: { ...env, SELECT_BASE: base, GITHUB_ENV: envFile }, encoding: "utf8", maxBuffer: 1 << 28, timeout: 5000 });
  console.log(`     ${key}: ${Date.now() - from} ms`);
  ok(timed.status === 0 && !raw(`${timed.stdout}${timed.stderr}`) && said() === said1, `select: ${what}, within 5 s`, `${timed.signal ?? ""}${timed.stderr}${said()}`);
};
const jsUnit = (i, j) => `export function f${i}x${j}(a, b) { return a > b ? [a, b].map(x => x * ${j}) : { a, b }; }\n`;
large("own-js", "a project of 300 files of JavaScript, 6.5 million characters, one changed, selects the test that reaches it",
  { ...Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`src/big/f${i}.mjs`, Array.from({ length: 250 }, (_, j) => jsUnit(i, j)).join("")])), "test/big.test.mjs": 'import { f0x0 } from "../src/big/f0.mjs";\nconsole.log(f0x0(1, 2));\n' },
  () => fs.appendFileSync(path.join(p, "src/big/f0.mjs"), "export const more = 1;\n"), "RUN= test/big.test.mjs \n");
const pyUnit = j => `def f${j}(a, b=None):\n    if a > b:\n        return [x * ${j} for x in range(a)]\n    return {"a": a, "b": b}\n\n`;
large("own-py", "a project of 600 files of Python, 6.9 million characters, one changed, past what can be read in time, runs the whole suite",
  Object.fromEntries(Array.from({ length: 600 }, (_, i) => [`src/py/m${i}.py`, `import os\n\n${Array.from({ length: 110 }, (_, j) => pyUnit(j)).join("")}`])),
  () => fs.appendFileSync(path.join(p, "src/py/m0.py"), "MORE = 1\n"), "RUN=all\n");
large("own-huge", "a file of JavaScript of 20 million characters the pull request leaves as it was, past what one read may take, runs the whole suite",
  { "src/vendor.js": SLOWEST["src/list.js"](20_000_000) }, () => fs.appendFileSync(path.join(p, "src/a.mjs"), "export const more = 1;\n"), "RUN=all\n");
branch("sel-after-large", () => {});
// (one character more and the reader gives its grammar nothing: no functions told, so the shape check counts it lost)
const past = { "src/list.py": t => readPython(t).functions, "src/list.js": t => javascriptFunctions("src/list.js", t), "src/nested.cs": t => readCsharp(t).functions };
for (const [file, functions] of Object.entries(past)) {
  const text = SLOWEST[file](largestOf(file) + 2);
  ok(text.length > largestOf(file) && functions(text) === null, `${file} of ${text.length} characters, past the largest its reader takes, has no functions told`);
}
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
  // a link: made one to a file that holds a new difference, then only that file changed; both are unreadable, never
  // read as the link's target path, which holds no "Differences"
  g("rm", "-q", "--cached", "core-manifest.md"); put(manifest("None.")); commit();
  fs.mkdirSync(path.join(d, "docs")); fs.writeFileSync(path.join(d, "docs", "m.md"), manifest("- a difference behind a link"));
  put(null); fs.symlinkSync("docs/m.md", path.join(d, "core-manifest.md")); commit();
  const linked = differencesAdded(d);
  ok(linked === UNREADABLE && mended(`FAIL ${reasonsMend("", linked)}`) && /a link/u.test(reasonsMend("", linked)), "pr-description: core-manifest.md made a link is unreadable and fails with its mend, naming a link");
  fs.writeFileSync(path.join(d, "docs", "m.md"), manifest("- a difference behind a link", "- another, only the target changed")); commit();
  ok(differencesAdded(d) === UNREADABLE, "pr-description: a link whose target alone changes is unreadable");
  g("rm", "-q", "core-manifest.md"); fs.rmSync(path.join(d, "docs"), { recursive: true }); put(manifest("None.")); commit();
  // run from a folder below the checkout's root: the manifest at the root is still read
  put(manifest("- a difference read from below the root")); fs.mkdirSync(path.join(d, "sub")); fs.writeFileSync(path.join(d, "sub", "x"), "x\n"); commit();
  ok(differencesAdded(path.join(d, "sub")).join() === "- a difference read from below the root", "pr-description: run from a folder below the root, the root's manifest is read, never taken for absent");
  fs.rmSync(path.join(d, "sub"), { recursive: true }); put(manifest("None.")); commit();
  // markup: a difference that holds a runner's command and control characters is read as one line added, and quoted
  // in the mend with none of them able to open a line
  put(manifest("- ::error::x\u0085\u2028::warning::y\u001b[2J")); commit();
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

// read-total.mjs (#469): the files a pull request adds to the core's rule folders, read for a cut or a join: a name with
// control characters, too long a file, binary text, a path, nothing at all; none breaks a line printed or runs long
{
  const memory = texts => ({ read: f => texts[f] ?? null, list: folder => Object.keys(texts).filter(f => f.startsWith(`${folder}/`) && !f.slice(folder.length + 1).includes("/") && f.endsWith(".md")).sort(), size: f => (f in texts ? Buffer.byteLength(texts[f]) : null) });
  const lines = (tag, n) => Array.from({ length: n }, (_, i) => `- A rule of ${tag}, number ${i}, which says what it says at some length.`).join("\n");
  const base = { "floor/security.md": "# F\n", "roles/builder.md": "# B\n\nRead at the start by the role `builder`.\n\n**Reads at its start:** `roles/shared/w.md`.\n", "roles/shared/w.md": "# W\n\nRead at the start of every task.\n", "tasks/s.md": `# S\n\nRead when a screen changes: the kinds \`screen\` and \`polish\`.\n\n${lines("s", 60)}\n` };
  const run = head => { const b = total(memory(base), []), h = total(memory(head), [], b); return conditions(total(memory(base), [], h), h, ""); };
  const odd = "tasks/a\nFAIL: forged\u001b[2J\u2028.md";
  const got = run({ ...base, [odd]: `# A\n\nRead when a screen changes: the kind \`screen\`.\n\n${lines("s", 60)}\n` });
  ok(got.cut && got.failures.length && got.failures.every(f => !/[\u0000-\u001f\u2028]/u.test(f)) && got.failures.every(f => mended(`FAIL: ${f}`)), "read-total: a file named with a line's end, an escape or a separator is printed with them written out, each failure saying its mend");
  let slow = Date.now();
  const huge = run({ ...base, "tasks/huge.md": `# H\n\nRead when a screen changes: the kind \`screen\`.\n\n${"- a line of a file far too long to be a rule, said again and again.\n".repeat(80000)}` });
  ok(!huge.cut && Date.now() - slow < 5000, "read-total: a file of five megabytes of new text is no cut, read in no time");
  const binary = run({ ...base, "tasks/bin.md": Buffer.from(Array.from({ length: 65536 }, (_, i) => i % 256)).toString("latin1") });
  ok(!binary.cut && !binary.failures.length, "read-total: a file of binary text is no cut, and fails nothing");
  ok(!run({ ...base, "tasks/../../etc.md": base["tasks/s.md"] }).failures.some(f => /[\u0000-\u001f]/u.test(f)), "read-total: a path that climbs out of its folder is a name, printed as it is, and opens nothing");
  ok(!run(base).cut && !run({}).failures.some(f => !mended(`FAIL: ${f}`)) && JSON.stringify(cuts(total(memory({}), []), total(memory({}), []))) === JSON.stringify({ added: [], gone: [] }), "read-total: nothing at all is no cut, and each failure on an empty tree says its mend");
}

// read-total.mjs's reader of the working tree, as the size workflow reads a fork's checkout (#469): a link to a pipe, to
// an endless device or out of the tree, a file past its limit in bytes, and more files or kinds than it reads; each is
// read as no file or refused with its mend, within the 5 s SECURITY.md allows
{
  const dir = path.join(tmp, "read-total"), put = (f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
  put("floor/security.md", "# F\n");
  put("roles/builder.md", "# B\n\nRead at the start by the role `builder`.\n\n**Reads at its start:** `roles/shared/w.md`.\n");
  put("roles/shared/w.md", "# W\n\nRead at the start of every task.\n");
  put("tasks/s.md", "# S\n\nRead when a screen changes: the kind `screen`.\n");
  put("outside.md", "# O\n\nRead when a screen changes: the kind `screen`.\n");
  const link = (to, f) => { try { fs.symlinkSync(to, path.join(dir, f)); return true; } catch { return false; } };
  const linked = [link(path.join(dir, "outside.md"), "tasks/out.md"), link("/dev/zero", "tasks/zero.md"), link(path.join(dir, "roles"), "tasks/folder.md")];
  if (NAMES && spawnSync("mkfifo", [path.join(dir, "tasks/pipe.md")]).status === 0) linked.push(true);
  link(path.join(dir, "roles"), "tools");
  put("tasks/big.md", `# G\n\nRead when a screen changes: the kind \`screen\`.\n\n${"x".repeat(LIMITS.bytes + 10)}\n`);
  let slow = Date.now();
  const t = readTree(null, dir), files = t.list("tasks");
  ok(linked.every(Boolean) ? files.join() === "tasks/big.md,tasks/s.md" && t.read("tasks/zero.md") === null && t.size("tasks/out.md") === null && t.list("tools").length === 0 && Date.now() - slow < 5000 : true,
    "read-total: a link to a pipe, to an endless device, out of the tree or to a folder, and a folder that is a link, are read as no file, in no time");
  ok(t.read("tasks/big.md") === null && t.size("tasks/big.md") > LIMITS.bytes, "read-total: a file past its limit in bytes is counted by its size, its text never read");
  put("tasks/kinds.md", `# K\n\nRead when anything changes: ${Array.from({ length: 40000 }, (_, i) => `the kind \`k${i}\``).join(", ")}.\n`);
  slow = Date.now();
  let thrown = null;
  try { total(readTree(null, dir), []); } catch (e) { thrown = e; }
  ok(thrown && mended(`FAIL: ${thrown.message}`) && Date.now() - slow < 5000, "read-total: a module of under a megabyte naming forty thousand kinds is refused with its mend, within 5 s");
  fs.rmSync(path.join(dir, "tasks/kinds.md"));
  // (a name a role's line gives that climbs out of the tree, or is absolute, opens nothing)
  put("../above.md", `# X\n${"y".repeat(300000)}\n`);
  put("roles/reviewer.md", "# R\n\nRead at its start by the role `reviewer`.\n\n**Reads at its start:** `../above.md`, `/etc/hostname`.\n");
  const named = readTree(null, dir);
  const reviewer = total(named, []).readers.get("the role reviewer, at its start");
  ok(named.read("../above.md") === null && named.size("../above.md") === null && named.size("/etc/hostname") === null && named.read("roles/./w.md") === null && !reviewer.files.some(f => f.includes("..") || f.startsWith("/")),
    "read-total: a name with \"..\", \".\" or an absolute path, given by a role's line, is no file, and nothing outside the tree is read or counted");
  fs.rmSync(path.join(dir, "roles/reviewer.md"));
  // (the worst case within the limits: as many modules, kinds and bytes as it reads, every module naming every kind and
  // sharing a sentence, read on both trees as --compare reads them, within 5 s)
  const rules = (tag, n) => Array.from({ length: n }, (_, i) => `- A rule of ${tag}, number ${i}, which says what it says at some length.`).join("\n");
  const worst = {}, worstHead = {};
  for (const t of [worst, worstHead]) Object.assign(t, { "floor/security.md": "# F\n", "roles/builder.md": "# B\n\nRead at the start by the role `builder`.\n\n**Reads at its start:** `roles/shared/w.md`.\n", "roles/shared/w.md": "# W\n\nRead at the start of every task.\n" });
  const per = Math.floor(LIMITS.all / (LIMITS.files / 2) / 80) - 10;
  for (let i = 0; i < LIMITS.files / 2 - 2; i++) { worst[`tasks/g${i}.md`] = `# G\n\nRead when: the kind \`w${i % (LIMITS.kinds - 2)}\`.\n\n- A sentence every file shares, long enough to be read as moved.\n${rules(i, per)}\n`; worstHead[`tasks/a${i}.md`] = worst[`tasks/g${i}.md`].replace("# G", "# A"); }
  const mem = texts => ({ read: f => texts[f] ?? null, list: folder => Object.keys(texts).filter(f => f.startsWith(`${folder}/`) && !f.slice(folder.length + 1).includes("/") && f.endsWith(".md")).sort(), size: f => (f in texts ? Buffer.byteLength(texts[f]) : null) });
  slow = Date.now();
  const w0 = total(mem(worst), []), wh = total(mem(worstHead), [], w0), wb = total(mem(worst), [], wh), wc = conditions(wb, total(mem(worstHead), [], wb), "");
  ok(Date.now() - slow < 5000 && Array.isArray(wc.failures), `read-total: the worst case within the limits (${LIMITS.files} files, ${LIMITS.kinds} kinds, every file sharing a sentence) is read on both trees in ${Date.now() - slow} ms, within 5 s`);
  // (the names a rule file gives, at their limit, read by the builder and reviewer of 30 merged pull requests of 200
  // paths each: a role's start line, a module's path patterns, one kind named again and again; past it, refused)
  const given = Array.from({ length: 30 }, (_, i) => ({ id: `${i}`.padStart(7, "a"), paths: Array.from({ length: 200 }, (_, j) => `src/p${i}/f${j}.js`) }));
  const n = LIMITS.names - 10, start = "# W\n\nRead at the start of every task.\n";
  const roleOf = (role, line) => `# ${role}\n\nRead at the start by the role \`${role}\`.\n\n**Reads at its start:** ${line}.\n`;
  const plain = { "floor/security.md": "# F\n", "roles/shared/w.md": start, "roles/builder.md": roleOf("builder", "`roles/shared/w.md`"), "roles/reviewer.md": roleOf("reviewer", "`roles/shared/w.md`") };
  const giving = k => ({
    start: { ...plain, "roles/builder.md": roleOf("builder", Array.from({ length: k }, (_, i) => `\`roles/shared/x${i}.md\``).join(", ")) },
    paths: { ...plain, "tasks/p.md": `# P\n\nRead when: the paths ${Array.from({ length: k }, (_, i) => `\`src/**/q${i}/*.js\``).join(", ")}.\n` },
    kinds: { ...plain, "tasks/k.md": `# K\n\nRead when: the kinds ${Array.from({ length: k }, () => "`same`").join(", ")}.\n` },
  });
  // (the paths' patterns, tried 3.5 million times on them, are past the steps a tree's tries take, and refused)
  for (const [what, texts] of Object.entries(giving(n))) {
    slow = Date.now();
    thrown = null;
    let c = null;
    try { const a = total(mem(texts), given); c = conditions(a, total(mem(texts), given, a), ""); } catch (e) { thrown = e; }
    const held = what === "paths" ? thrown && /steps the total read gives one tree/.test(thrown.message) && mended(`FAIL: ${thrown.message}`) : c && !c.cut;
    ok(Date.now() - slow < 5000 && held, `read-total: ${n} names of one rule file (${what}), read by 60 readers of merged pull requests, take ${Date.now() - slow} ms, within 5 s${what === "paths" ? ", refused with its mend past the steps a tree's tries take" : ""}`);
  }
  // (a path pattern of many stars side by side that matches no path, which a backtracking matcher takes minutes over)
  const stars = { ...plain, "tasks/s.md": `# S\n\nRead when: the paths ${["*a".repeat(30) + "b", "**/".repeat(30) + "*z*z*z*z*z*z*q", `src/${"*".repeat(200)}x`].map(x => `\`${x}\``).join(", ")}.\n` };
  slow = Date.now();
  const sa = total(mem(stars), given.map(t => ({ ...t, paths: t.paths.map(p => `${p.replace(/\.js$/u, "")}${"a".repeat(150)}.js`) })));
  ok(Date.now() - slow < 5000 && sa.readers.size > 0, `read-total: path patterns of many stars side by side, matching no path, are read by 60 readers in ${Date.now() - slow} ms, within 5 s`);
  // (a head's path patterns that pass the one-pass check on the merged pull requests' paths and fail their walk, more
  // than the steps a tree's tries take (#673): refused with their mend within 5 s, and the base reads the same before
  // and after them, each tree spending a budget of its own)
  const walking = { ...plain, "tasks/b.md": "# B\n\nRead when: the paths `src/*/f1*.js` and `.github/workflows/`.\n" };
  const walked = { ...walking, "tasks/w.md": `# W\n\nRead when: the paths ${Array.from({ length: 280 }, (_, i) => `\`src/*f${i}*.js\``).join(", ")}.\n` };
  slow = Date.now();
  const baseBefore = total(mem(walking), given);
  thrown = null;
  try { total(mem(walked), given, baseBefore); } catch (e) { thrown = e; }
  const baseAfter = total(mem(walking), given), read = t => JSON.stringify([t.sum, [...t.readers]]);
  ok(thrown && /steps the total read gives one tree/.test(thrown.message) && mended(`FAIL: ${thrown.message}`) && Date.now() - slow < 5000, `read-total: a head's path patterns past the steps a tree's tries take are refused with their mend, in ${Date.now() - slow} ms, within 5 s`);
  ok(read(baseBefore) === read(baseAfter) && baseBefore.readers.get(`the builder of ${given[0].id}`).files.includes("tasks/b.md"), "read-total: the base reads the same before and after a head that ran past its budget");
  for (const [what, texts] of Object.entries(giving(40000))) {
    slow = Date.now();
    thrown = null;
    try { total(mem(texts), given); } catch (e) { thrown = e; }
    ok(thrown && /names/.test(thrown.message) && mended(`FAIL: ${thrown.message}`) && Date.now() - slow < 5000, `read-total: forty thousand names of one rule file (${what}) are refused with their mend, within 5 s`);
  }
  // (files each within their limit, past the limit of all their text together, are refused with their mend)
  for (let i = 0; i < 10; i++) put(`tasks/full${i}.md`, `# U\n\nRead when a screen changes: the kind \`screen\`.\n\n${"z".repeat(LIMITS.bytes - 100)}\n`);
  slow = Date.now();
  thrown = null;
  try { total(readTree(null, dir), []); } catch (e) { thrown = e; }
  ok(thrown && /past the \d+ MB/.test(thrown.message) && mended(`FAIL: ${thrown.message}`) && Date.now() - slow < 5000, "read-total: files each within their limit, past the limit of all the text together, are refused with their mend, within 5 s");
  for (let i = 0; i < 10; i++) fs.rmSync(path.join(dir, `tasks/full${i}.md`));
  for (let i = 0; i < 5000; i++) put(`tasks/m${i}.md`, "# M\n\nRead when a screen changes: the kind `screen`.\n");
  slow = Date.now();
  thrown = null;
  try { total(readTree(null, dir), []); } catch (e) { thrown = e; }
  ok(thrown && mended(`FAIL: ${thrown.message}`) && Date.now() - slow < 5000, "read-total: five thousand modules added are refused with their mend, within 5 s");
}

// ---- reading.mjs: the rule files of a checkout, which a fork's branch may make links (#848) ----
// (a link to a pipe never answers, one to a file outside the checkout is not the checkout's: both read as no file, so the
// check ends at once with a failure naming the file whose "when" it cannot read, never waiting on it)
if (process.platform !== "win32") {
  const rd = path.join(tmp, "reading"), outside = path.join(tmp, "outside-reading");
  for (const d of ["roles", "floor/topics", "tasks"]) fs.mkdirSync(path.join(rd, d), { recursive: true });
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(rd, "floor/security.md"), "# The floor\n");
  fs.writeFileSync(path.join(rd, "roles/builder.md"), "# The builder\n\nRead at the start of every task by the role `builder`.\n");
  fs.writeFileSync(path.join(outside, "x.md"), "# Read when a task calls for it.\n");
  const made = spawnSync("mkfifo", [path.join(outside, "pipe")]).status === 0;
  if (made) {
    fs.symlinkSync(path.join(outside, "pipe"), path.join(rd, "tasks/zero.md"));
    fs.symlinkSync(path.join(outside, "x.md"), path.join(rd, "tasks/out.md"));
    fs.symlinkSync(path.join(outside, "pipe"), path.join(rd, "roles/builder-link.md"));
    fs.symlinkSync(path.join(outside, "pipe"), path.join(rd, "core-manifest.md"));
    const started = Date.now(), r = spawnSync(process.execPath, [path.join(root, "scripts", "reading.mjs"), "--check"], { cwd: rd, env, encoding: "utf8", timeout: 5000 });
    const out = `${r.stdout}${r.stderr}`;
    ok(r.error === undefined && r.status !== null && Date.now() - started < 5000, `reading.mjs --check: a rule file that is a link to a pipe, and the manifest too, is read as no file and never waited on, in ${Date.now() - started} ms`);
    ok(!raw(out) && !out.includes("The floor") && /tasks\/zero\.md/u.test(out) && /tasks\/out\.md/u.test(out) && mended(out), "reading.mjs --check: each link is named as a file that says no when it is read, with its mend, and none is read as the file it leads to");
  } else console.log("skip reading.mjs: a rule file that is a link to a pipe: no pipe can be made here");
} else console.log("skip reading.mjs: a rule file that is a link to a pipe: no pipe can be made here (Windows)");

// ---- reading.mjs and rules.mjs: a rule folder that is a link, and a folder and a file link in a rule folder (#848) ----
// (each is refused by name with its mend, a name that holds a line's end shown on one line, and nothing it leads to is
// read, by the reading script's library or the rules' reader; a backslash in a name is a letter here, as the system
// reads it, so the path checked is the path opened)
if (process.platform !== "win32") {
  const rf = path.join(tmp, "reading-folders"), away = path.join(tmp, "away-folders");
  for (const d of ["roles", "floor", "tasks"]) fs.mkdirSync(path.join(rf, d), { recursive: true });
  fs.mkdirSync(away);
  fs.writeFileSync(path.join(rf, "floor/security.md"), "# The floor\n");
  fs.writeFileSync(path.join(rf, "roles/builder.md"), "# The builder\n\nRead at the start of every task by the role `builder`.\n");
  fs.writeFileSync(path.join(away, "x.md"), "# Elsewhere\n\nRead when a task calls for it.\n\n**1. A rule from elsewhere.** Its text.\n");
  fs.symlinkSync(away, path.join(rf, "floor/topics"));
  fs.symlinkSync(away, path.join(rf, "tasks/more"));
  fs.symlinkSync(path.join(away, "x.md"), path.join(rf, "tasks/link.md"));
  fs.symlinkSync(path.join(away, "x.md"), path.join(rf, "floor/more.md"));
  fs.symlinkSync(path.join(away, "x.md"), path.join(rf, "AGENTS.md"));
  fs.symlinkSync(path.join(away, "x.md"), path.join(rf, "tasks/two\nFAIL::##[ lines.md"));
  fs.mkdirSync(path.join(rf, "inbox"));
  fs.writeFileSync(path.join(rf, "inbox/item.md"), "# An item\n");
  fs.symlinkSync(path.join(away, "x.md"), path.join(rf, "inbox\\item.md"));
  const r = spawnSync(process.execPath, [path.join(root, "scripts", "reading.mjs"), "--check"], { cwd: rf, env, encoding: "utf8", timeout: 5000 });
  const out = `${r.stdout}${r.stderr}`;
  const lib = library(rf, ""), fails = out.split("\n").filter(l => l.startsWith("FAIL"));
  ok(r.status === 1 && !raw(out) && ["AGENTS.md", "floor/more.md", "floor/topics", "tasks/more", "tasks/link.md", "tasks/two\\nFAIL: :# #[ lines.md"].every(l => out.includes(`FAIL: ${l.includes("\\") ? `"${l}"` : l} is a symbolic link`)) && fails.length === 6 && mended(out), "reading.mjs --check: a rule folder that is a link, a folder and a file link in a rule folder, one in the floor's folder and the core's AGENTS.md are each refused once with its mend, a name with a line's end on one line", out);
  ok(Object.keys(lib.modules).every(f => !/^floor\/topics\/|^tasks\/(?:more|link|two)/u.test(f)) && lib.links.length === 6, "reading.mjs: the library reads no module through a link, and lists each link it met");
  ok(regular(rf, "inbox/item.md") === "# An item\n" && regular(rf, "inbox\\item.md") === (path.sep === "\\" ? "# An item\n" : null), "reading.mjs: a name with a backslash, a link, is the path checked and the path opened");
  const got = rules(rf, { agents: true });
  ok(!got.some(x => /elsewhere/u.test(`${x.key} ${x.text}`)), "rules.mjs: no rule is read through a folder or a file link in the rule folders");
  // (in a project, the core under core/, a link is named by its path from the project's root, the core's folder once)
  const pj = path.join(tmp, "reading-project");
  for (const d of ["core/roles", "core/floor"]) fs.mkdirSync(path.join(pj, d), { recursive: true });
  fs.writeFileSync(path.join(pj, "core-manifest.md"), "# The core's manifest\n");
  fs.writeFileSync(path.join(pj, "core/floor/security.md"), "# The floor\n");
  fs.writeFileSync(path.join(pj, "core/roles/builder.md"), "# The builder\n\nRead at the start of every task by the role `builder`.\n");
  fs.symlinkSync(path.join(away, "x.md"), path.join(pj, "core/floor/more.md"));
  fs.symlinkSync(path.join(away, "x.md"), path.join(pj, "core/AGENTS.md"));
  const rp = spawnSync(process.execPath, [path.join(root, "scripts", "reading.mjs"), "--check"], { cwd: pj, env, encoding: "utf8", timeout: 5000 });
  const outp = `${rp.stdout}${rp.stderr}`;
  ok(rp.status === 1 && outp.includes("FAIL: core/floor/more.md is a symbolic link") && outp.includes("FAIL: core/AGENTS.md is a symbolic link") && !outp.includes("core/core/") && mended(outp), "reading.mjs --check in a project: each link is named by its path from the project's root, with its mend", outp);
} else console.log("skip reading.mjs and rules.mjs: a link in a rule folder: links are not made here (Windows)");
// ---- reading.mjs: path patterns a fork's branch writes, tried on its changed paths (#673) ----
// (a module of patterns that pass the one-pass check on a long changed path and fail its walk: the reading stops at its
// budget within 5 s, each module a pattern names called, saying why, so the paths call for more reading, never less)
{
  const rp = path.join(tmp, "reading-steps"), put = (f, text) => { fs.mkdirSync(path.dirname(path.join(rp, f)), { recursive: true }); fs.writeFileSync(path.join(rp, f), text); };
  put("floor/security.md", "# The floor\n");
  put("roles/builder.md", "# The builder\n\nRead at the start by the role `builder`.\n\n**Reads at its start:** `tasks/start.md`.\n");
  put("tasks/start.md", "# Start\n\nRead at the start of every task.\n");
  put("tasks/plain.md", "# Plain\n\nRead when the readme changes: the path `README.md`.\n");
  put("tasks/walked.md", `# Walked\n\nRead when: the paths ${Array.from({ length: 50 }, () => `\`x/${"*a".repeat(240)}q\``).join(", ")}.\n`);
  const started = Date.now(), r = spawnSync(process.execPath, [path.join(root, "scripts", "reading.mjs"), "builder", "--path", `x/${"a/".repeat(1000)}aq`, "--path", "README.md"], { cwd: rp, env, encoding: "utf8", timeout: 5000 });
  const out = `${r.stdout}${r.stderr}`;
  ok(r.status === 0 && Date.now() - started < 5000 && /tasks\/walked\.md +the changed paths, past the steps a reading tries them for/u.test(out) && /tasks\/plain\.md/u.test(out),
    `reading.mjs: path patterns past a reading's budget are read in ${Date.now() - started} ms, within 5 s, each module they name called, saying why`);
}

process.exit(failed ? 1 : 0);
