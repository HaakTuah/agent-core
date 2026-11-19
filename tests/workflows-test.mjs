// Checks the workflow check (scripts/workflows.mjs): the forbidden trigger is found however it is written,
// a key given twice in one mapping is found however the mapping is written (yaml-keys.mjs) and fails only where the
// base did not hold it, and the core's own workflows pass. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/workflows-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { parseYaml } from "../scripts/workflow-run.mjs";
import { lines, readable, reads, repeated, unlinked } from "../scripts/workflows.mjs";
import { twice, uncommented } from "../scripts/yaml-keys.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const fails = text => lines(text).length > 0;

ok(!fails("on: [pull_request, push]\non:\n  pull_request:\n  workflow_run:\n    workflows: [build]\n") && !fails("") && !fails("pull_request\n_target\npull_request target\n"), "the other triggers pass, and so does the word in two halves that nothing joins");
ok(fails("on:\n  pull_request_target:\n") && fails("on: pull_request_target\n") && fails("on: [push, pull_request_target] # the labeller\n"), "the trigger fails as a key, as a value and in a list with a comment after it");
ok(fails(`on: { "pull_request_target": {} }\n`) && fails("on:\n  'pull_request_target':\n") && fails("on:\n  ? pull_request_target\n  : {}\n") && fails("x: &t pull_request_target\non: *t\n"), "quoted, in braces, written the long way or behind an alias");
ok(fails(`on: ["pull_request\\x5ftarget"]\n`) && fails(`on: ["pull_request\\u005Ftarget"]\n`) && fails(`on: ["pull_request\\U0000005ftarget"]\n`) && fails(`on: ["\\x70ull_request_target"]\n`), "a name spelled with a YAML escape is read as what it spells");
ok(fails(`on: ["pull_request_\\\n      target"]\n`) && fails(`on: ["pull_\\\n  request_\\\r\n\ttarget"]\n`) && fails(`on: ["pull_request\\x5f\\\n   target"]\n`), "a name broken over two or three lines by an escaped line break is joined, with an escape in it too");
ok(["\r", "\r\n", "\u0085", "\u2028", "\u2029"].every(br => fails(`# ci${br}on: pull_request_target${br}`) && fails(`on: ["pull_request_\\${br}  target"]${br}`)), "every line break YAML knows is one, also when it is escaped");
ok(fails("# never pull_request_target\n") && fails("      - run: echo pull_request_target\n"), "the word in a comment or in a script's text fails too: the check reads no YAML, so it cannot tell them apart");
ok(!fails("      - run: |\n          node a.mjs \\\n            --target x\n") && !fails(`      - run: echo "\\U99999999 \\xZZ \\u12"\n`), "a script's own line that goes on to the next, and an escape that spells nothing, are no finding");
ok(lines("a\nb\non: pull_request_target\n").join() === "3" && lines(`a\non: ["pull_request_\\\n  target"]\nb\non: pull_request_target\n`).join() === "3,5" && lines("pull_request_target pull_request_target\n").join() === "1", "a finding names its line, a joined word the line it ends on, and a line is named once");

ok(fails("on: { push: { branches: ['x\n  #'] }, pull_request_target: {} }\n") && fails("on:\n\u00a0# a comment\u0085  pull_request_target:\n"), "a line that only looks like a comment hides nothing");
const utf16 = Buffer.from("\ufeffon: pull_request_target\n", "utf16le").toString("utf8"), utf16be = Buffer.from("on: pull_request_target\n", "utf16le").swap16().toString("utf8");
ok(!readable(utf16) && !readable(utf16be) && !readable(Buffer.from([0x6f, 0x6e, 0x3a, 0xff, 0xfe]).toString("utf8")) && !fails(utf16), "a file in another encoding, or with bytes that are no text, is not readable (and the word in it is not found, which is why)");
ok(readable("on: push\n") && readable("\ufeffon: push # \u00e6\u00f8\u00e5 \u2713\n") && readable(""), "UTF-8 text is, with a byte order mark and letters beyond ASCII too");
const files = [".github/workflows/a.yml", ".github/workflows/b.yaml", ".github/actions/setup/action.yml", ".github/actions/setup/steps.yml", "tools/act/action.yaml", "action.yml",
  ".github/workflows/c.YML", ".github/dependabot.yml", ".github/ISSUE_TEMPLATE/config.yml", "core/.github/workflows/a.yml", "core/tools/action.yml", "tools/node_modules/a/action.yml", "docs/a.yml", "docs/reaction.yml"];
ok(reads(files).join() === files.slice(0, 7).join(), "it reads the project's own workflows and its actions wherever they lie, whatever the case of the ending, and neither the core's copy nor an installed package's");
ok(unlinked([".github", ".GitHub/workflows", ".github/workflows", ".github/dependabot.yml", "tools/act/action.yaml", "tools/act", "docs/a.yml", ".githubs", "core/.github/workflows/a.yml"]).join() === ".github,.GitHub/workflows,.github/workflows,.github/dependabot.yml,tools/act/action.yaml", "what may be no link: what it reads, and .github itself with everything in it (a linked folder is one entry to git)");

// ---- a key given twice in one mapping, which GitHub refuses (#393) ----
const dup = text => twice(text).map(f => `${f.key}@${f.line}<${f.first}`).join();
ok(dup("jobs:\n  a:\n    steps:\n      - name: x\n        if: a\n        if: b\n      - name: y\n        if: c\n") === "if@6<5", "a step's if: given twice is found, by its line and the first's, and the next step's own is not");
ok(dup("on: push\nname: a\non: pull_request\n") === "on@3<1" && dup("a:\n  x: 1\nb:\n  x: 2\n  y: 3\n  x: 4\n") === "x@6<4", "at the top too, and a mapping is one key's value alone: one under another key starts afresh");
ok(dup("steps:\n- name: x\n  run: y\n- name: x\n  run: y\n") === "" && dup("steps:\n  - name: x\n  - name: x\n    if: a\n") === "" && dup("- - a: 1\n  - a: 2\n") === "", "each item of a list is a mapping of its own, written at its key's indent or past it, in a list in a list too");
ok(dup("- a: 1\n  b:\n  - c: 1\n  - c: 2\n  a: 3\n") === "a@5<1", "a list at its key's own indent is that key's value, and the mapping goes on after it");
ok(dup("-\n  a: 1\n  a: 2\n-\n  a: 3\n") === "a@3<2" && dup("x:\n-\ny: 1\nx: 2\n") === "x@4<1", "and an item whose mapping starts on the line after its dash, which ends at a line no further in");
ok(dup("\"if\": a\n'if': b\nif: c\n") === "if@2<1,if@3<1" && dup(`"a\\x62": 1\nab: 2\n'it''s': 3\n"it's": 4\n`) === "ab@2<1,it's@4<3" && dup(`"\\U0010FFFF": 1\n"\\U0010ffff": 2\n"\\U00110000": 3\n"\\U00110001": 4\n`) === "\u{10ffff}@2<1" && dup("a': 1\na': 2\nb\": 1\nb\": 2\n") === "a'@2<1,b\"@4<3", "a key is read as YAML spells it, quoted or plain, with an escape too (one past the last character none), and a plain one may end in a quote");
ok(dup("run: |\n  if: 1\n  if: 2\nx: >-\n  a: 1\n\n  a: 2\n- |\n  a: 1\n  a: 1\n") === "" && dup("a: \"b: 1\n  b: 2\"\nc: x\n  c: y\n") === "", "the lines a value runs on are passed over: a block scalar's, a quoted one's and a plain one's");
ok(dup("a: 1 # a: 2\n# a: 3\nb: '#x' # c\nb: \"#y\"\n") === "b@4<3" && dup("a: 1\r\nb:\r\n  c: 1\r\n  c: 2\r\n") === "c@4<3" && dup("a: 1\rb: 2\ra: 3\r") === "a@3<1" && dup("\ufeffon: a\nx: 1\non: b\n") === "on@3<1", "a comment hides no key and holds none, and every line break and a byte order mark are read as GitHub reads them");
ok(dup("a: &x\n  b: 1\n  b: 2\nc: *x\nc: !!str y\n") === "b@3<2,c@5<4" && dup("---\na: 1\n---\na: 2\n") === "", "a value that is only an anchor or a tag holds the mapping below it, and each document is its own");
ok(dup("on: { push: {}, \"push\": {} }\n") === "push@1<1" && dup("on: {\n  push: {branches: [a, b]},\n  push: {} }\nx: 1\nx: 2\n") === "push@3<2,x@5<4" && dup("- {a: 1, b: [{a: 1, a: 2}], a: 2}\n") === "a@1<1,a@1<1", "in a flow mapping too, on one line or on several, and one in a list or inside another");
ok(dup("a: {b: 1, c: {b: 2}}\nd: [a, a, {e: 1}, {e: 2}]\nf: {'g': 1, h: 'g', i}\n") === "" && dup("a: {x, x}\nb: {: 1, : 2}\n") === "x@1<1,@2<2", "while what lies in two mappings, a list's items and a value are none, and a key with no value or no name is one");
ok(dup(`a: {'it''s': 1, "it's": 2, "q\\"": 3, 'q"': 4}\nb: {x:y: 1, x:y: 2, z: [c, d], z: {e}}\nc: {a:`) === "it's@1<1,q\"@1<1,x:y@2<2,z@2<2" && dup("{a:, a:") === "a@1<1", "a flow key quoted either way, with a colon in it, or holding a list or a mapping, and one at the text's end");
ok(dup("a: {\n b: 1,\n\n # c: 1\n c: 2, b: 3,\n c: 4 }\n") === "b@5<2,c@6<5" && dup(`a: ${"[".repeat(20000)}\nb: 1\nb: 2\n`) === "b@3<2,null@1<null" && dup(`a: [${"{b: 1, b: 2}, ".repeat(3)}]\n`) === "b@1<1,b@1<1,b@1<1", "a blank line or a comment in a flow value keeps its lines counted, and a value nested past any mark throws nothing, the rest of the file read still and the part not read said so");
const hostile = Date.now(), many = dup(`a: {\n${" b: 1,\n".repeat(40000)}}\n`).split(",").length;
ok(many === 39999 && dup(`x${" ".repeat(100000)}y\n${"a".repeat(100000)}: 1\n`) === "" && Date.now() - hostile < 5000, `forty thousand keys twice in one value, and a line of a hundred thousand blanks or letters, read in a few seconds at most (${Date.now() - hostile} ms)`);
const nest = k => `x: ${"[".repeat(k)}{a: 1, a: 2}${"]".repeat(k)}\ny: 1\ny: 2\n`, deep = Date.now();
ok(["? ", "[", "{", "- ", "? - "].every(form => dup(`${form.repeat(12500)}\n`) === "null@1<null" && dup(`${form.repeat(12500)}\n`) === "null@1<null") && dup(nest(125)) === "a@1<1,y@3<2" && dup(nest(126)) === "y@3<2,null@1<null" && Date.now() - deep < 5000,
  `a list or mapping nested past 128 deep, a document counted as one, is read as an empty value, the rest of the text read still and the cut said so, and twelve thousand marks of any nesting, read twice, stop nothing (#610; ${Date.now() - deep} ms)`);
// (block nesting some thousands deep, closed by a line at a lower indent, which the package's parser cannot close: the
// text is said to be read only in part, whether the parser gives out first, naming line 1, or the depth mark cuts it,
// naming the cut's line, so the case holds wherever a Node's stack ends; and the check fails it with its mend, never
// passing it as holding no key)
let indented = "x:\n"; for (let i = 1; i < 2500; i++) indented += `${" ".repeat(i)}k:\n`;
const past = [`on: push\non: pull_request\nx:\n  ${"? ".repeat(2500)}a\nz: 1\n`, `on: push\non: pull_request\nx:\n  ${"- ".repeat(5000)}a\nz: 1\n`, `on: a\non: b\n${indented}z: 1\n`];
const unreadDeep = repeated(past.map((text, i) => ({ file: `deep${i}.yml`, text })), () => null);
ok(past.every(t => /(?:^|,)null@\d+<null$/u.test(dup(t))) && unreadDeep.fails.length === 3 && unreadDeep.fails.every(l => /^FAIL deep\d\.yml:\d+: the file nests its lists or mappings more than 128 deep, past what this check reads/.test(l)) && mended(unreadDeep.fails.join("\n")),
  "a text nested some thousands deep in block form, past what the parser can close, is read as unread, and the check fails it with its mend (#610)", unreadDeep.fails.join("\n"));
const lower = `on: push\n${Array.from({ length: 37 }, (_, i) => `k${i}: 1\n`).join("")}z: ${"[".repeat(200)}${"]".repeat(200)}\n`;
const lowerFails = repeated([{ file: "lower.yml", text: lower }], () => null).fails;
ok(dup(lower) === "null@39<null" && lowerFails.length === 1 && lowerFails[0].startsWith("FAIL lower.yml:39: the file nests") && mended(lowerFails[0]),
  "a part cut past 128 deep is named on its own line, not line 1, so the session is sent where the deep part is", lowerFails.join("\n"));
ok(dup("env: &defaults { FOO: one, FOO: two }\nx:\n- !t [ {c: 1, c: 2} ]\n") === "FOO@1<1,c@3<3" && dup("a: {x: &y {b: 1, b: 2}, z: !t 1, z: 2}\n") === "b@1<1,z@1<1" && dup("a: {!t b: 1, &c b: 2}\n") === "b@1<1" && dup("env: { A: 'it''s # text', A: two }\n") === "A@1<1",
  "a flow value behind an anchor or a tag is read, a node in it behind one too, and a doubled quote inside single quotes ends neither the quote nor the line");
ok(dup("matrix: { include: [{ os: ubuntu-latest, }], os: [windows-latest] }\n") === "" && dup("jobs: { build: { runs-on: x, }, build: { runs-on: y } }\n") === "build@1<1", "a blank between a last comma and the bracket that closes a flow value closes it there");
ok(uncommented("a: 'x # y' # z") === "a: 'x # y'" && uncommented(`a: "x \\" # y" # z`) === `a: "x \\" # y"` && uncommented("a: b#c") === "a: b#c" && uncommented("a: b# c") === "a: b# c" && uncommented("a: 'b\\' # c") === "a: 'b\\'" && uncommented("# all") === "" && uncommented("a: it's # x") === "a: it's", "a comment starts at a # after a blank, outside quotes, and a quote inside a word opens none");
const was = "on: push\non: pull_request\nx: 1\n", now = "on: push\non: pull_request\nx: 1\nx: 2\nx: 3\n";
const base = repeated([{ file: "a.yml", text: now }, { file: "b.yml", text: was }], f => (f === "a.yml" ? `${was}x: 2\n` : null));
ok(base.notes.length === 2 && base.fails.length === 2 && base.notes.every(l => /^note a\.yml:[24]: .*as it did on the base\. Mend: /.test(l)) && /^FAIL a\.yml:5: /.test(base.fails[0]) && /^FAIL b\.yml:2: the key "on" is given twice in one mapping \(first on line 1\), so GitHub refuses the whole file and runs none of its jobs\. Mend: keep one of the two keys/.test(base.fails[1]) && mended(base.fails.join("\n")),
  "against a base, as many of a key as the file held twice there are noted, and the rest fail, each with its mend; a file the base lacked fails whole");
const none = repeated([{ file: "a.yml", text: now }], null), fresh = repeated([{ file: "a.yml", text: now }], () => null);
ok(none.fails.length === 0 && none.notes.length === 3 && !none.notes[0].includes("base") && fresh.fails.length === 3 && fresh.notes.length === 0, "with no base each is noted and none fails, and where nothing stood before (the core's own) each fails");

const core = fileURLToPath(new URL("..", import.meta.url));
const own = fs.readdirSync(`${core}.github/workflows`).filter(f => /\.ya?ml$/u.test(f));
ok(own.length > 0 && own.every(f => !fails(fs.readFileSync(`${core}.github/workflows/${f}`, "utf8"))), "the core's own workflows pass");

// run on a scratch project: each failure says its mend
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "workflows-test-"));
try {
  fs.mkdirSync(path.join(tmp, "core/scripts"), { recursive: true });
  for (const f of ["workflows.mjs", "guards.mjs", "started.mjs", "yaml-keys.mjs", "packages.mjs", "core-path.mjs", "core-address.mjs"]) fs.copyFileSync(fileURLToPath(new URL(f, new URL("../scripts/", import.meta.url))), path.join(tmp, "core/scripts", f));
  // (the install with the lock file it is read against)
  fs.cpSync(fileURLToPath(new URL("../.packages", import.meta.url)), path.join(tmp, "core/.packages"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "core/.gitignore"), "/.packages/node_modules/\n"); // (as the copy holds it)
  fs.mkdirSync(path.join(tmp, ".github/workflows"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".github/workflows/a.yml"), `on:\n${"  pull_request_target:\n".repeat(7)}`);
  fs.writeFileSync(path.join(tmp, ".github/workflows/b.yml"), Buffer.from("on: push\n", "utf16le"));
  for (const args of [["init", "-q"], ["add", "-A"]]) execFileSync("git", args, { cwd: tmp, stdio: "ignore" });
  const r = spawnSync(process.execPath, [path.join(tmp, "core/scripts/workflows.mjs")], { cwd: tmp, encoding: "utf8" });
  const out = r.stdout + r.stderr;
  const good = r.status === 1 && /a\.yml:2: pull_request_target .*\. Mend: take the word out/.test(out) && /and on 2 more lines\. Mend:/.test(out) && /b\.yml: not UTF-8 text.*Mend: save it as UTF-8/.test(out) && mended(out);
  ok(good, `run, it fails each, by file and line, and each failure says its mend${good ? "" : `:\n${out}`}`);
  // (a key twice: a.yml's push stood twice on the base, and stands once now; the step's if: in c.yml is new)
  fs.writeFileSync(path.join(tmp, ".github/workflows/a.yml"), "on:\n  push:\n  push:\n  push:\n");
  for (const args of [["rm", "-q", "--cached", ".github/workflows/b.yml"], ["add", ".github/workflows/a.yml"], ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", "base"]]) execFileSync("git", args, { cwd: tmp, stdio: "ignore" });
  fs.writeFileSync(path.join(tmp, ".github/workflows/a.yml"), "on:\n  push:\n  push:\n");
  fs.writeFileSync(path.join(tmp, ".github/workflows/c.yml"), "on: push\njobs:\n  a:\n    steps:\n      - run: x\n        if: a\n        if: b\n");
  execFileSync("git", ["add", "-A", ".github/workflows/a.yml", ".github/workflows/c.yml"], { cwd: tmp, stdio: "ignore" });
  const keyRun = (args, env) => spawnSync(process.execPath, [path.join(tmp, "core/scripts/workflows.mjs"), ...args], { cwd: tmp, encoding: "utf8", env: { ...process.env, WORKFLOWS_BASE: "", ...env } });
  const k = keyRun([], { WORKFLOWS_BASE: "HEAD" }), kOut = k.stdout + k.stderr, kGood = k.status === 1 && /^note \.github\/workflows\/a\.yml:3: the key "push" .*as it did on the base/m.test(kOut) && /^FAIL \.github\/workflows\/c\.yml:7: the key "if" .*first on line 6.*Mend: keep one/m.test(kOut) && /1 failing, 1 noted\. Mend:/.test(kOut) && mended(kOut);
  ok(kGood, `run against a base, a key twice the base held is noted and a new one fails, with its mend${kGood ? "" : `:\n${kOut}`}`);
  const kNone = keyRun([]), kCore = keyRun(["--core"], { WORKFLOWS_BASE: "HEAD" });
  ok(kNone.status === 0 && /0 failing, 2 noted$/m.test(kNone.stdout) && kCore.status === 1 && /2 failing\. Mend:/.test(kCore.stdout), "run with no base, each is noted and it passes; in the core's own repository each fails, whatever the base");
  // (where the job's install could not reach the registry, the keys given twice did not run, said so; every other failure
  // still fails, so no pull request turns the check green by making the install fail: #654, point 4)
  fs.writeFileSync(path.join(tmp, ".github/workflows/d.yml"), "on:\n  pull_request_target:\n");
  execFileSync("git", ["add", ".github/workflows/d.yml"], { cwd: tmp, stdio: "ignore" });
  fs.rmSync(path.join(tmp, "core/.packages/node_modules"), { recursive: true, force: true });
  const u = keyRun([], { CORE_PACKAGES_UNREACHED: "1" }), uOut = u.stdout + u.stderr;
  ok(u.status === 1 && /^::warning::The check for a key given twice did not run/m.test(uOut) && /d\.yml:2: pull_request_target/.test(uOut) && mended(uOut), `where the install could not reach the registry, the keys given twice did not run, said as a warning, and a forbidden trigger still fails${u.status === 1 ? "" : `:\n${uOut}`}`);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
// ---- a pull request's run gives way to a newer one, and nothing else is cancelled (#388) ----
// Each job of the core's that a pull request starts, its own or one a project calls, is in a group of the workflow and
// the pull request, cancelled once a newer run starts for it; a run on main, a schedule or a start by hand is a group of
// its own (its run id), and never cancelled. Left out, each for its reason: the security-review check, whose runs go one
// at a time in order so the last has read the newest comments, the release, the preview's queue and the deletion of
// merged branches, which no pull request starts and which never cancel, and the scheduled ones.
const KEY = "${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.pull_request.number) || github.run_id }}";
const CANCEL = "${{ github.event_name == 'pull_request' }}";
const APART = new Set(["security-review.yml", "own-security-review.yml", "release.yml", "preview.yml", "delete-merged-branches.yml", "look.yml", "own-look.yml", "core-moved.yml", "versions.yml"]);
const wfDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".github", "workflows");
const loose = [];
// (a workflow in a form the test's reader does not know, a flow mapping say, is read for its group at the top, by its
// text: the whole run is then one group)
const atTop = text => new RegExp(`^concurrency:\\n  group: .*${KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*\\n  cancel-in-progress: ${CANCEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m").test(text);
for (const file of fs.readdirSync(wfDir).filter(f => f.endsWith(".yml") && !APART.has(f))) {
  const text = fs.readFileSync(path.join(wfDir, file), "utf8");
  let wf;
  try { wf = parseYaml(text); } catch { if (!atTop(text)) loose.push(file); continue; }
  for (const [id, job] of Object.entries(wf.jobs ?? {})) {
    const c = job.concurrency ?? wf.concurrency;
    if (!(c && typeof c.group === "string" && c.group.includes(KEY) && c["cancel-in-progress"] === CANCEL)) loose.push(`${file}/${id}`);
  }
}
ok(!loose.length, `each job a pull request starts gives way to a newer run for the same pull request, and only then${loose.length ? `: not ${loose.join(", ")}` : ""}`);
const groups = Object.fromEntries(["codeql.yml", "signatures.yml", "nuget.yml", "security-review.yml"].map(f => [f, parseYaml(fs.readFileSync(path.join(wfDir, f), "utf8"))]));
ok(Object.values(groups["codeql.yml"].jobs)[0].concurrency.group.includes("${{ matrix.language }}") && groups["signatures.yml"].jobs.signatures.concurrency.group.includes("${{ inputs.directory }}") && groups["nuget.yml"].jobs.nuget.concurrency.group.includes("${{ inputs.config }}"),
  "and jobs of one run that differ (a matrix, a call for each lock folder or config) are groups of their own, so none cancels another");
ok(groups["security-review.yml"].jobs.report.concurrency["cancel-in-progress"] === false, "while the security-review check's runs go one at a time, never cancelled");

process.exit(failed ? 1 : 0);
