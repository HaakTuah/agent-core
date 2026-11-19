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
import { TEMPLATES } from "../scripts/init.mjs";
import { holds, parseYaml } from "../scripts/workflow-run.mjs";
import { draftHoles, lines, readable, reads, repeated, unlinked, unreadied } from "../scripts/workflows.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { LONGEST, twice, uncommented } from "../scripts/yaml-keys.mjs";

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
const hostile = Date.now(), many = dup(`a: {\n${" b: 1,\n".repeat(30000)}}\n`).split(",").length;
ok(many === 29999 && dup(`x${" ".repeat(100000)}y\n${"a".repeat(100000)}: 1\n`) === "" && Date.now() - hostile < 5000, `thirty thousand keys twice in one value, and a line of a hundred thousand blanks or letters, read in a few seconds at most (${Date.now() - hostile} ms)`);
const nest = k => `x: ${"[".repeat(k)}{a: 1, a: 2}${"]".repeat(k)}\ny: 1\ny: 2\n`, deep = Date.now();
ok(["? ", "[", "{", "- ", "? - "].every(form => dup(`${form.repeat(12500)}\n`) === "null@1<null" && dup(`${form.repeat(12500)}\n`) === "null@1<null") && dup(nest(125)) === "a@1<1,y@3<2" && dup(nest(126)) === "y@3<2,null@1<null" && Date.now() - deep < 5000,
  `a list or mapping nested past 128 deep, a document counted as one, is read as an empty value, the rest of the text read still and the cut said so, and twelve thousand marks of any nesting, read twice, stop nothing (#610; ${Date.now() - deep} ms)`);
// (block nesting some thousands deep, closed by a line at a lower indent, which the package's parser cannot close: the
// text is said to be read only in part, whether the parser gives out first, naming line 1, or the depth mark cuts it,
// naming the cut's line (cutAt), so the case holds wherever a Node's stack ends; and the check fails it with its mend, never
// passing it as holding no key)
let indented = "x:\n"; for (let i = 1; i < 600; i++) indented += `${" ".repeat(i)}k:\n`;
const past = [`on: push\non: pull_request\nx:\n  ${"? ".repeat(2500)}a\nz: 1\n`, `on: push\non: pull_request\nx:\n  ${"- ".repeat(5000)}a\nz: 1\n`, `on: a\non: b\n${indented}z: 1\n`];
// (where a Node's stack lets the parser read as far as the mark, the doubled "on" is found too: only the lines on depth
// are counted)
const cutAt = [4, 4, 130], unreadDeep = repeated(past.map((text, i) => ({ file: `deep${i}.yml`, text })), () => null);
const nested = unreadDeep.fails.filter(l => l.includes(": the file nests "));
ok(past.every((t, i) => [1, cutAt[i]].some(n => dup(t).endsWith(`null@${n}<null`))) && nested.length === 3 && nested.every((l, i) => [1, cutAt[i]].some(n => l.startsWith(`FAIL deep${i}.yml:${n}: `))) && nested.every(l => /^FAIL deep\d\.yml:\d+: the file nests its lists or mappings more than 128 deep, past what this check reads/.test(l)) && mended(unreadDeep.fails.join("\n")),
  "a text nested some thousands deep in block form, past what the parser can close, is read as unread, and the check fails it with its mend (#610)", unreadDeep.fails.join("\n"));
// (a text past the length read is not given to the parser: it is said unread, naming line 1, and fails with its mend: #752)
const huge = repeated([{ file: "huge.yml", text: `a: ${"[".repeat(LONGEST + 1)}\n` }], () => null).fails;
ok(huge.length === 1 && huge[0].startsWith("FAIL huge.yml:1: the file is longer than 262144 characters") && mended(huge[0]) && twice(Array.from({ length: 10000 }, (_, i) => `k${i}: 1\n`).join("")).length === 0 && twice(`a: ${"[".repeat(LONGEST - 10)}\n`).every(k => !k.size) && draftHoles(`on: pull_request\n# ${"x".repeat(LONGEST)}\n`).length === 0,
  "a text longer than the length read is said unread with its mend and never given to the parser, and one just under it still is", huge.join("\n"));
// (a file nested too deep on the base does not hold the entry of one that has grown too long: that one is new, and fails)
const grown = repeated([{ file: "grown.yml", text: `a: ${"x".repeat(LONGEST)}\n` }], () => `on: push\nx: ${"[".repeat(200)}1${"]".repeat(200)}\n`);
ok(grown.fails.length === 1 && grown.notes.length === 0 && /grown\.yml:1: the file is longer/u.test(grown.fails[0]) && mended(grown.fails[0]),
  "a file past the length read, over a base nested too deep, fails, and is not noted as held on the base", grown.fails.join("\n"));
// (nor does a key spelt like a reason, which a base may give twice, hold the entry of one grown too long)
const spelt = repeated([{ file: "spelt.yml", text: `a: ${"x".repeat(LONGEST)}\n` }], () => 'on: push\n"\\0long": 1\n"\\0long": 2\n');
ok(spelt.fails.length === 1 && spelt.notes.length === 0, "a key spelt like a reason, given twice on the base, holds no part not read of the head", spelt.fails.join("\n"));
// (a file past the length read that a pull request changes fails, so a call left without ready_for_review is not let through
// by its length; one unchanged on the base, and one with no base, are only noted by repeated(): #752)
const longText = changed => `on: pull_request\n# ${"x".repeat(LONGEST)}${changed}\n`, longFiles = text => [{ file: "long.yml", text }];
const longChanged = unreadied(longFiles(longText("a")), () => longText("b")), longSame = unreadied(longFiles(longText("a")), () => longText("a")), longAdded = unreadied(longFiles(longText("a")), () => null);
ok(longChanged.fails.length === 1 && mended(longChanged.fails[0]) && longSame.fails.length === 0 && longAdded.fails.length === 1 && unreadied(longFiles(longText("a")), null).fails.length === 0,
  "a file past the length read that a pull request changes or adds fails with its mend; one unchanged, or read with no base, does not", [...longChanged.fails, ...longAdded.fails].join("\n"));
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

// a call skipped on a draft whose trigger leaves out ready_for_review (#502): by its if:, or by a check that skips a draft
// itself (the description check, or core.yml's description:); the full trigger, another's workflow and a call that
// never skips a draft pass
const call = (on, uses, extra = "") => `on:\n${on}\njobs:\n  check:\n    uses: ${CORE}/.github/workflows/${uses}@${"a".repeat(40)}\n${extra}`;
const NOT_DRAFT = "    if: ${{ !github.event.pull_request.draft }}\n";
const TYPES = "  pull_request:\n    types: [opened, synchronize]\n", FULL = "  pull_request:\n    types: [opened, reopened, synchronize, ready_for_review]\n";
ok(draftHoles(call(TYPES, "copies.yml", NOT_DRAFT)).join() === "check" && draftHoles(call("  pull_request:\n", "personal-terms.yml", NOT_DRAFT)).length === 1
  && draftHoles(call(TYPES, "pr-description.yml")).length === 1 && draftHoles(call(TYPES, "core.yml", "    with:\n      description: true\n")).length === 1,
  "a call skipped on a draft, by its if: or by a check that skips one itself, whose trigger leaves out ready_for_review is found");
ok(!draftHoles(call(FULL, "copies.yml", NOT_DRAFT)).length && !draftHoles(call(TYPES, "copies.yml")).length && !draftHoles(call(TYPES, "core.yml", "    with:\n      copies: c.json\n")).length
  && !draftHoles(call(TYPES, "copies.yml", NOT_DRAFT).replace(CORE, "someone/else")).length && !draftHoles("on: push\njobs: {}\n").length && !draftHoles("on: [unclosed\n  - :").length
  && draftHoles(`on: {pull_request: {types: [opened, synchronize]}}\njobs: {check: {uses: "${CORE}/.github/workflows/pr-description.yml@${"a".repeat(40)}"}}\n`).length === 1,
  "the full trigger, a call that never skips a draft, another's workflow, no pull_request trigger and text not read as YAML pass; a workflow in YAML's flow form is read");
const holes = unreadied([{ file: "a.yml", text: call(TYPES, "copies.yml", NOT_DRAFT) }, { file: "b.yml", text: call(TYPES, "pr-description.yml") }], f => (f === "a.yml" ? call(TYPES, "copies.yml", NOT_DRAFT) : call(FULL, "pr-description.yml")));
ok(holes.notes.length === 1 && /^note a\.yml: .*as on the base\. Mend: add ready_for_review/.test(holes.notes[0]) && holes.fails.length === 1 && /^FAIL b\.yml: its job "check"/.test(holes.fails[0]) && mended(holes.fails[0])
  && unreadied([{ file: "b.yml", text: call(TYPES, "pr-description.yml") }], null).fails.length === 0,
  "a call the base already held so is noted, a new one fails with its mend, and with no base each is noted", JSON.stringify(holes));

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
  // (where the job's install could not reach the registry, the keys given twice and the calls a draft skips did not run,
  // said so, and the package's absence fails nothing; every other failure still fails, so no pull request turns the check
  // green by making the install fail: #654, point 4)
  fs.writeFileSync(path.join(tmp, ".github/workflows/d.yml"), "on:\n  pull_request_target:\n");
  fs.writeFileSync(path.join(tmp, ".github/workflows/e.yml"), call(TYPES, "copies.yml", NOT_DRAFT));
  execFileSync("git", ["add", ".github/workflows/d.yml", ".github/workflows/e.yml"], { cwd: tmp, stdio: "ignore" });
  fs.rmSync(path.join(tmp, "core/.packages/node_modules"), { recursive: true, force: true });
  const u = keyRun([], { CORE_PACKAGES_UNREACHED: "1" }), uOut = u.stdout + u.stderr;
  ok(u.status === 1 && /^::warning::The check for a key given twice did not run, nor the one for a call a draft skips/m.test(uOut) && /d\.yml:2: pull_request_target/.test(uOut) && !/e\.yml|is not installed/.test(uOut) && mended(uOut), `where the install could not reach the registry, the keys given twice and the calls a draft skips did not run, said as a warning, and a forbidden trigger still fails${u.status === 1 ? "" : `:\n${uOut}`}`);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
// ---- a pull request's run gives way to a newer one, and nothing else is cancelled (#388) ----
// Each job of the core's that a pull request starts, its own or one a project calls, is in a group of the workflow and
// the pull request, cancelled once a newer run starts for it; a run on main, a schedule or a start by hand is a group of
// its own (its run id), and never cancelled. Left out, each for its reason: the security-review check, whose runs go one
// at a time in order so the last has read the newest comments, the release, the preview's queue and the deletion of
// merged branches, which no pull request starts and which never cancel, the scheduled ones, and the core's tests, read
// below for their own groups (#733).
const KEY = "${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.pull_request.number) || github.run_id }}";
const CANCEL = "${{ github.event_name == 'pull_request' }}";
const APART = new Set(["security-review.yml", "own-security-review.yml", "release.yml", "preview.yml", "delete-merged-branches.yml", "look.yml", "own-look.yml", "core-moved.yml", "versions.yml", "tests.yml"]);
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

// ---- the security-review job's condition, for each kind of event it is started by (#593, point 8) ----
const REPO = "someone/project";
const runs = ({ event = "pull_request", pr = {}, comment = {}, issue = {}, actor = "someone", priv = false, inputs = {} } = {}) => holds(groups["security-review.yml"].jobs.report.if, {
  github: { event_name: event, repository: REPO, actor, event: { repository: { private: priv },
    ...(event === "pull_request" ? { pull_request: { draft: false, head: { repo: { full_name: REPO } }, ...pr } }
      : { issue: { pull_request: { url: "x" }, state: "open", ...issue }, comment: { user: { login: "someone" }, author_association: "OWNER", body: "Security review: none", ...comment } }) } },
  inputs: { advisory: true, private: false, reviewers: "", root: "core", ...inputs } }, { failed: false });
ok(runs() && !runs({ pr: { draft: true } }) && !runs({ pr: { head: { repo: { full_name: "outsider/project" } } } }) && !runs({ actor: "dependabot[bot]" }), "on a pull request it runs for one of the repository's own branches that is no draft, and not for a draft, a fork's or Dependabot's (E2, E3, E4)");
const SUMMARY = "<!-- codex-pull-request-review-summary -->\nCodex's summary";
ok(runs({ event: "issue_comment", comment: { user: { login: "chatgpt-codex-connector[bot]" }, author_association: "NONE", body: SUMMARY } }) && !runs({ event: "issue_comment", comment: { user: { login: "someone-else[bot]" }, author_association: "NONE", body: SUMMARY } }), "it runs for Codex's summary, and not for a look-alike from another login (E5)");
const as = (body, author_association, inputs) => runs({ event: "issue_comment", comment: { body, author_association }, inputs });
ok(["Security review: none needed", "**Security review:** none needed"].every(b => ["OWNER", "MEMBER", "COLLABORATOR"].every(a => as(b, a)) && ["CONTRIBUTOR", "NONE"].every(a => !as(b, a))), "it runs for \"Security review:\" and \"**Security review:\" from an owner, a member or a collaborator, and not from a contributor or anyone else (E6)");
ok(!as("Code review: done", "OWNER") && as("Code review: done", "OWNER", { advisory: false }), "it runs for \"Code review:\" only where the check is not advisory (E7)");
ok(!runs({ event: "issue_comment", issue: { pull_request: null } }) && !runs({ event: "issue_comment", issue: { state: "closed" } }), "it runs for no comment on an issue, nor on a closed pull request (E8)");
ok(!runs({ priv: true }) && runs({ priv: true, inputs: { private: true } }) && runs({ priv: true, inputs: { advisory: false } }) && !runs({ event: "issue_comment", priv: true }) && runs({ event: "issue_comment", priv: true, inputs: { advisory: false } }), "in a private repository it runs only where the caller passes private or turns advisory off (E11, R3)");

// ---- the core's own caller: the template's triggers, its scripts at the root, not advisory (E9, E12, R4) ----
const ownReview = parseYaml(fs.readFileSync(path.join(wfDir, "own-security-review.yml"), "utf8"));
// (the template's own {{core}} and {{pin}} filled in, which init.mjs writes when it makes the project)
const kitReview = parseYaml(fs.readFileSync(path.join(core, TEMPLATES, "workflows/security-review.yml.tmpl"), "utf8").replace(/\{\{\w+\}\}/g, "x"));
ok(JSON.stringify(ownReview.on) === JSON.stringify(kitReview.on), `the core's own security-review check is started by what the template's is, and nothing more${JSON.stringify(ownReview.on) === JSON.stringify(kitReview.on) ? "" : `: ${JSON.stringify(ownReview.on)}`}`);
const ownCall = Object.values(ownReview.jobs ?? {});
ok(ownCall.length === 1 && ownCall[0].uses === "./.github/workflows/security-review.yml" && ownCall[0].with?.root === "." && ownCall[0].with?.advisory === false, "and calls the core's workflow with its scripts at the root and advisory turned off");

// ---- when the core's tests run (#733, points 2 to 4 and 6) ----
// A pull request's run starts once it is ready, never on a draft, on Linux alone; main is tested on Linux at its newest
// commit, a run that has started finishing and only a waiting one giving way to the next merge's (#810); Windows once an hour at main's newest commit where it moved, with the
// tests that reach the network on both; both in full on a start by hand, which a release waits on.
{
  const tests = parseYaml(fs.readFileSync(path.join(wfDir, "tests.yml"), "utf8"));
  const release = parseYaml(fs.readFileSync(path.join(wfDir, "release.yml"), "utf8"));
  const DRAFT = "!(github.event_name == 'pull_request' && github.event.pull_request.draft)";
  const MOVED = "(github.event_name != 'schedule' || needs.moved.outputs.run == 'true')";
  const gate = tests.jobs.tests, gateStep = gate.steps.at(-1);
  ok(tests.on.pull_request.types.includes("ready_for_review") && !tests.on.pull_request.types.includes("edited") && ["suites", "upgrade"].every(j => String(tests.jobs[j].if).includes(DRAFT) && String(tests.jobs[j].if).includes(MOVED)),
    "no run on a draft: a pull request's run starts when it is marked ready, and each job of tests skips a draft and an hourly run where main did not move (point 2)");
  ok(!String(gate.if).includes("draft") && String(gate.if) === `\${{ (github.event_name == 'pull_request' && always() || !cancelled()) && ${MOVED} }}` && /github\.event\.pull_request\.draft/.test(gateStep.env.DRAFT) && /if \[ -n "\$DRAFT" \]; then[\s\S]*Mend:[\s\S]*exit 1/.test(gateStep.run),
    "but the gate the ruleset requires runs on a draft and fails there, saying its mend, since a required check whose job is skipped passes; a pull request's runs even where its run is cancelled, so a cancelled head never passes, and a run of main, the hour or a hand cancelled whole leaves it aside, never reading failed (#810)", String(gate.if));
  // (the gate's step run in a shell, as the runner runs it: each of its failures says its mend, its pass none)
  if (process.platform !== "win32") {
    const gateRun = env => spawnSync("bash", ["-e", "-c", gateStep.run], { encoding: "utf8", env: { PATH: process.env.PATH, ...env } });
    const said = r => `${r.stdout}${r.stderr}`.replace(/::error::/g, "FAIL: ").replace(/" \\\n\s*"/g, " ");
    const runs = [gateRun({ DRAFT: "yes", SUITES: "skipped", UPGRADE: "skipped" }), gateRun({ SUITES: "cancelled", UPGRADE: "success" }), gateRun({ SUITES: "success", UPGRADE: "failure" })];
    const passes = gateRun({ SUITES: "success", UPGRADE: "success" });
    ok(runs.every(r => r.status === 1 && mended(said(r))) && passes.status === 0, "the gate fails a draft, a cancelled job and a failed one, each with its mend, and passes where all passed", runs.map(said).join(" | "));
  }
  // (each matrix is set whole for each event: GitHub adds back an entry of `include` that no combination left after
  // `exclude` matches, so the jobs are read from the lists the expression holds: a pull request's and a push's, the
  // hourly run's, and all the others')
  const lists = expr => { const m = /^\$\{\{ fromJSON\(\(github\.event_name == 'pull_request' \|\| github\.event_name == 'push'\) && '(\[[^']*\])' \|\| github\.event_name == 'schedule' && '(\[[^']*\])' \|\| '(\[[^']*\])'\) \}\}$/.exec(String(expr)); return m ? m.slice(1).map(x => JSON.parse(x)) : null; };
  const suites = lists(tests.jobs.suites.strategy.matrix.include), upgrades = lists(tests.jobs.upgrade.strategy.matrix.include);
  const only = (l, os) => l.length > 0 && l.every(x => x.os === os);
  const NETWORK = "suites-network";
  const WINDOWS = ["suites-projects", "suites-sync", "suites-kit", "suites-core", "suites-core-places", "suites-licences", "suites-rest", "suites-tools"];
  const named = l => [...new Set(l.map(x => x.suite))].sort().join();
  ok(suites && Object.keys(tests.jobs.suites.strategy.matrix).join() === "include" && suites.every(l => l.every(x => x.node && x.suite && x.os && x.parts))
    && only(suites[0], "ubuntu-latest") && only(suites[1].filter(x => x.suite !== NETWORK), "windows-latest") && named(suites[1].filter(x => x.suite !== NETWORK)) === [...WINDOWS].sort().join()
    && suites[2].length === suites[0].length + suites[1].length && [".node-version", ".node-least"].every(n => suites[2].filter(x => x.node === n).length === suites[2].length / 2)
    && upgrades && only(upgrades[0], "ubuntu-latest") && only(upgrades[1], "windows-latest") && upgrades[2].length === upgrades[0].length + upgrades[1].length,
    "a pull request's run and a push's are on Linux alone, the hourly run on Windows but for the network's jobs, every job named whole, and a start by hand runs them all, on both Nodes (points 3, 4 and 6)", String(tests.jobs.suites.strategy.matrix.include).slice(0, 300));
  // (the tests that reach the network, in the part of that name: in no pull request's run nor a push's, and once an hour
  // and by hand on both systems and both Nodes; #733, point 9)
  const steps = tests.jobs.suites.steps.filter(s => /contains\(matrix\.parts, 'network'\)/.test(String(s.if))).map(s => s.run).sort();
  const nets = l => l.filter(x => x.parts.split(" ").includes("network"));
  ok(suites && nets(suites[0]).length === 0 && nets(suites[1]).length === 4 && nets(suites[1]).every(x => x.suite === NETWORK && x.parts === "network") && ["ubuntu-latest", "windows-latest"].every(os => [".node-version", ".node-least"].every(n => nets(suites[1]).some(x => x.os === os && x.node === n))) && nets(suites[2]).length === 4
    && steps.join() === ["node tests/init-dotnet-test.mjs", "node tests/nuget-fetch-test.mjs"].join(),
    "the tests that reach the network run in no pull request's run nor a push's, and once an hour and by hand in a job of their own on each system and Node (point 9)", steps.join(", "));
  ok(tests.concurrency.group.includes("format('pr-{0}', github.event.pull_request.number)") && tests.concurrency.group.includes("(github.event_name == 'push' || github.event_name == 'schedule') && format('{0}-main', github.event_name) || github.run_id")
    && tests.concurrency["cancel-in-progress"] === "${{ github.event_name == 'pull_request' }}",
    "a pull request's run gives way to its newer push's; a run on main after a merge, the hourly runs, a start by hand and a call wait their turn and are never cancelled (point 4, as #810 changed it)");
  // (the events whose run cancels the one in progress, read from the expression as written, which must be such terms
  // joined by ||: a run on main that has started finishes, and only a waiting one gives way to a newer merge's; #810)
  const cancelOn = c => /^\$\{\{ github\.event_name == '\w+'(?: \|\| github\.event_name == '\w+')* \}\}$/u.test(String(c)) ? [...String(c).matchAll(/'(\w+)'/gu)].map(m => m[1]) : null;
  ok(cancelOn(tests.concurrency["cancel-in-progress"])?.join() === "pull_request",
    "a push's run on main never cancels the run in progress, nor does any event but a pull request's (#810)", String(tests.concurrency["cancel-in-progress"]));
  ok(tests.on.schedule?.length === 1 && /^\d{1,2} \* \* \* \*$/.test(tests.on.schedule[0].cron) && tests.jobs.moved.if === "${{ github.event_name == 'schedule' }}" && /event == "schedule" or \.event == "workflow_dispatch"/.test(tests.jobs.moved.steps.at(-1).run) && /\(\.id \| tostring\) != env\.GITHUB_RUN_ID/.test(tests.jobs.moved.steps.at(-1).run) && /if any\(\.\[\]; \.status != "completed"\) then "running"/.test(tests.jobs.moved.steps.at(-1).run) && /if gh api --paginate /.test(tests.jobs.moved.steps.at(-1).run) && /jq -rs /.test(tests.jobs.moved.steps.at(-1).run) && /-f branch=main/.test(tests.jobs.moved.steps.at(-1).run) && /sort_by\(\[\.run_started_at \/\/ "", \.id\]\) \| last \| \.conclusion/.test(tests.jobs.moved.steps.at(-1).run) && /if \[ "\$done" = success \]; then echo "run=false"/.test(tests.jobs.moved.steps.at(-1).run),
    "Windows once an hour, at main's newest commit, skipped only where no other full run there, every page of them read, is still going and the newest, by when it last started, passed, so no skipped run hides a failure from the release (point 6)");
  const cut = release.jobs.release.steps.at(-1).run;
  ok("workflow_dispatch" in tests.on && !("workflow_call" in tests.on) && /actions\/runs" -f head_sha="\$GITHUB_SHA" -f branch=main -f event=push /.test(cut) && /gh api --paginate -X GET "repos\/\$GITHUB_REPOSITORY\/actions\/workflows\/tests\.yml\/runs" -f head_sha="\$GITHUB_SHA"/.test(cut) && /jq -s '\{ workflow_runs: \. \}' "\$full\.pages" > "\$full"/.test(cut) && /--runs "\$runs" --full "\$full"/.test(cut),
    "and both in full by hand, which the release waits on: it reads the push's runs and, apart, the tests' runs on its commit, every page, none unfinished and the newest passed, and the tests stay a workflow no project calls (point 6; release.mjs, fullRun)", cut);
  // (#715, point 2: the upgrade test guards only what a release brings, so on Windows, where its job set every pull
  // request's run, it runs in the release workflow alone: daily where the repository is public, before each release)
  const upgradeStep = release.jobs.upgrade?.steps?.find(s => /tests\/upgrade-test\.mjs/.test(s.run ?? ""));
  const testsUpgrade = tests.jobs.upgrade.steps.find(s => /tests\/upgrade-test\.mjs/.test(s.run ?? ""));
  ok(release.on.schedule?.length === 1 && /^\d{1,2} \d{1,2} \* \* \*$/.test(release.on.schedule[0].cron) && "workflow_dispatch" in release.on
    && release.jobs.upgrade["runs-on"] === "windows-latest" && upgradeStep
    && release.jobs.upgrade.if === "${{ github.event_name != 'schedule' || needs.main.outputs.public == 'true' }}"
    && [release.jobs.release.needs].flat().includes("upgrade") && !Object.keys(release.on).some(e => e.startsWith("pull_request"))
    && /^\$\{\{ runner\.os == 'Linux' && (matrix\.part != '[\w ]+' && )?\(env\.RUN == 'all' \|\| contains\(env\.RUN, ' tests\/upgrade-test\.mjs '\)\) \}\}$/.test(String(testsUpgrade?.if)),
    "the upgrade test runs on Windows in the release workflow alone, once a day where minutes are free and before each release, never in a pull request's run (tasks/tests.md, \"A test that guards only what a release brings runs where the release is made\")",
    JSON.stringify({ schedule: release.on.schedule, if: release.jobs.upgrade?.if, tests: testsUpgrade?.if }));
}

// (#802: the copy's check removes the folders it fetched into, so no fetch there may leave git's own upkeep running
// behind the step, which raced that removal on main: each fetch in a step's script, its lines joined where a line ends
// in a backslash and a comment taken off only where the shell reads one, and the checkout of the core into a folder)
{
  const core = parseYaml(fs.readFileSync(path.join(wfDir, "core.yml"), "utf8"));
  const steps = Object.values(core.jobs).flatMap(j => j.steps ?? []);
  const commands = steps.flatMap(s => String(s.run ?? "").replace(/\\\n/g, " ").split("\n").map(l => l.replace(/(^|\s)#.*$/, "")));
  const fetches = commands.flatMap(l => l.split(/\|\||&&|[|;]/)).filter(c => /\bgit\b.*\sfetch\s/.test(c));
  const checkouts = steps.filter(s => String(s.uses ?? "").startsWith("actions/checkout@") && s.with?.path);
  const off = s => s.env?.GIT_CONFIG_COUNT === "1" && s.env?.GIT_CONFIG_KEY_0 === "maintenance.auto" && s.env?.GIT_CONFIG_VALUE_0 === "false";
  ok(fetches.length >= 3 && fetches.every(l => l.includes("--no-auto-maintenance")) && checkouts.length >= 1 && checkouts.every(off),
    "each fetch of the copy's check, and its checkout of the core into a folder, starts no upkeep of git's own, which would race the check's removal of what it fetched (#802)",
    [...fetches.filter(l => !l.includes("--no-auto-maintenance")), ...checkouts.filter(s => !off(s)).map(s => s.with.path)].join(" | "));
}

process.exit(failed ? 1 : 0);
