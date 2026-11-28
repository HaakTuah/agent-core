// Hostile tests of one input the core names under floor rule 5 (floor/topics/input.md): a project's configs of the core's
// checks (checks/copies.json, shape.json, sizes.json, licences.json), its core-manifest.md and its SECURITY.md's rule 5.
// Each reader is tried, as each case's shape allows, with too long, the wrong type, markup, a path that leaves the
// project, a number out of range, and nothing at all; each fails with its mend or reads the input as not there, and
// reads and writes nothing outside the project. The readers: copies.mjs and reading-size.mjs, run from a scratch
// project's copy of the core; shape.mjs's parseConfig and where; size.mjs's capsOf, answered and --raise;
// manifest-reads.mjs's notes; step-checks-modules.mjs's step of the modules and rewritten; core-owned.mjs's stubs;
// licences.mjs's loadConfig; steps.mjs's notDone with the step for rule 5's inputs;
// read-nothing.mjs's readNothing (#459); and
// sync.mjs and look.mjs, run from the copy, on a manifest that is a link out of the project. Test
// data is made up. Run by the core's tests workflow (.github/workflows/tests.yml). Git and Node's own modules.
//
//   node tests/hostile-configs-test.mjs
import { execFileSync, spawnSync } from "../scripts/check-runs.mjs";
import fs from "node:fs";
import path from "node:path";
import { BEGIN, END, converged, stubOf } from "../scripts/core-owned.mjs";
import { loadConfig } from "../scripts/licences.mjs";
import { notes, projectNotes } from "../scripts/manifest-reads.mjs";
import { rewritten } from "../scripts/step-checks-modules.mjs";
import modules from "../scripts/steps/160-the-modules-a-project-takes.mjs";
import { mended } from "../scripts/mend.mjs";
import { OWNER, scratchDir, root } from "../scripts/scratch-core.mjs";
import { parseConfig, survey, where, KIT } from "../scripts/shape.mjs";
import { answered, capsOf, whoseOf } from "../scripts/size.mjs";
// (the size check counts an answer from the repository's owner, "someone" here, with no right read)
const owner = whoseOf("someone", []), me = { login: "someone", type: "User" };
import { STEPS, notDone } from "../scripts/steps.mjs";
import { readNothing } from "../scripts/read-nothing.mjs";
import { ownFiles } from "../scripts/own-files.mjs";
import { parserLeftOut } from "../scripts/packages.mjs";
import { shapeFaults } from "../scripts/schemas.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };

const tmp = scratchDir("hostile-configs-");
const p = path.join(tmp, "project"), outside = path.join(tmp, "outside");
fs.mkdirSync(outside);
const write = (f, text) => { fs.mkdirSync(path.dirname(path.join(p, f)), { recursive: true }); fs.writeFileSync(path.join(p, f), text); };
const gitP = (...args) => execFileSync("git", args, { cwd: p, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const run = (script, ...args) => {
  const started = Date.now(), r = spawnSync(process.execPath, [path.join(p, "core/scripts", script), ...args], { cwd: p, encoding: "utf8", maxBuffer: 1 << 28, timeout: 60000 });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, ms: Date.now() - started };
};
const raw = out => /\n\s+at |TypeError|ReferenceError|RangeError/u.test(out);
const fails = r => r.status === 1 && mended(r.out, { from: p }) && !raw(r.out);
// What a reader that throws says, as a check prints it: "FAIL: " and its words; "" where it took the input.
const thrown = fn => { try { fn(); return ""; } catch (e) { return e instanceof TypeError || e instanceof RangeError ? `raw ${e.stack}` : `FAIL: ${e.message}`; } };
const timed = fn => { const t = Date.now(), v = fn(); return [v, Date.now() - t]; };
const BIG = 50000;

// ---- a project holding a copy of the core's scripts, floor and starter kit, a git repository ----
fs.mkdirSync(p);
gitP("init", "-q", "-b", "main");
for (const part of ["scripts", ".packages", "floor", "setup"]) fs.cpSync(path.join(root, part), path.join(p, "core", part), { recursive: true, filter: parserLeftOut });
write("a.md", "a file of the project's own\n");
gitP("add", "-A");

// ---- copies.mjs: checks/copies.json, and the baseline it names ----
const copies = (text, ...more) => { write("checks/copies.json", text); return run("copies.mjs", "checks/copies.json", ...more); };
const MEND = "copies.mjs: refuses with its mend";
for (const [text, what] of [["null", "null"], ["[]", "a list"], ["5", "a number"], ['"x"', "a string"], ['{"baseline":5,"prose":["a.md"]}', "a baseline that is a number"],
  ['{"baseline":"b.json","code":"a.md"}', "a code that is no list"], ['{"baseline":"b.json","prose":["a.md"],"proseFromSecurity":"yes"}', "proseFromSecurity that is no boolean"],
  ['{"baseline":"b.json","prose":[1e309]}', "a path that is a number out of range"]]) ok(fails(copies(text)), `${MEND} a config of the wrong type: ${what}`);
ok(fails(copies("")), `${MEND} an empty config`);
// (its shape, by its schema: scripts/schemas/copies.json, through schemas.mjs; #530)
{
  const kit = JSON.parse(fs.readFileSync(path.join(root, "setup/template/copies.json.tmpl"), "utf8"));
  const said = [null, [], { baseline: 5 }, { baseline: "b.json", code: "a.md" }, { baseline: "b.json", prose: [""] }, { baseline: "b.json", extra: true }, { baseline: "b.json", proseFromSecurity: "yes" }].map(c => shapeFaults("copies", c, "core/"));
  const many = shapeFaults("copies", { baseline: "b.json", code: Array(5000).fill("") }, "core/");
  ok(many.length === 21 && /holds 4980 more faults than those said\. Mend: \S/u.test(many[20]), `${MEND} its schema: a config of many bad items says the first 20 and a count of the rest`);
  ok(JSON.stringify(shapeFaults("copies", kit, "core/")) === "[]" && said.every(f => f.length && f.every(l => /^the config(?:'s "[^"]+")?\b.* Mend: \S/u.test(l))) && said[5][0].includes('"extra"') && said[0][0].includes("core/setup/template/copies.json.tmpl"),
    `${MEND} its schema: the starter kit's config holds, and each config of the wrong shape fails, naming where, with its mend`);
}
ok(fails(copies('{"baseline":"b.json"}')), `${MEND} a config that names nothing to check`);
ok(fails(run("copies.mjs", "checks/none.json")) && fails(run("copies.mjs")), `${MEND} a config that is not there, or none named`);
for (const spec of ["../outside", "/etc"]) ok(fails(copies(JSON.stringify({ baseline: "b.json", code: [spec] }))), `${MEND} a pathspec ${spec}, which leaves the project, and lists nothing there`);
// (C:\x is, on Linux, a plain name inside the project that matches no file)
write("b.json", JSON.stringify({ windows: { "<script>x": 2 } }));
ok(fails(copies('{"baseline":"b.json","prose":["a.md"]}')), `${MEND} a baseline window named with markup`);
for (const n of [-1, 1.5, 1e309, 1]) {
  write("b.json", `{"windows":{"abcdefabcdef":${n}}}`);
  ok(fails(copies('{"baseline":"b.json","prose":["a.md"]}')), `${MEND} a window counted ${n}, out of range`);
}
let r = copies(JSON.stringify({ baseline: "b.json", prose: ["a.md"], x: "y".repeat(5 << 20) }));
ok(fails(r) && r.ms < 5000, `${MEND} a config of 5 MB, in ${r.ms} ms`);

// ---- reading-size.mjs: checks/sizes.json ----
const sizes = text => { write("checks/sizes.json", text); return run("reading-size.mjs", "checks/sizes.json"); };
const marks = more => JSON.stringify({ each: 20000, read: { "a.md": 20000 }, total: 20000, split: 50000, ...more });
for (const [text, what] of [["null", "null"], ["[]", "a list"], ["5", "a number"], ['"x"', "a string"], [marks({ read: ["a.md"] }), "a read that is a list"], [marks({ skip: [3] }), "a skip of numbers"]])
  ok(fails(sizes(text)), `reading-size.mjs: refuses with its mend a config of the wrong type: ${what}`);
ok(fails(sizes("")) && fails(run("reading-size.mjs", "checks/none.json")) && fails(run("reading-size.mjs")), "reading-size.mjs: refuses with its mend an empty config, one not there, and none named");
for (const n of [-1, 0, 1.5, "1e309", '"20000"']) ok(fails(sizes(marks({ each: "@" }).replace('"@"', n))), `reading-size.mjs: refuses with its mend an "each" of ${n}, out of range`);
fs.writeFileSync(path.join(outside, "x"), "y".repeat(10));
for (const f of ["../outside/x", "/etc/passwd", "C:\\x", "<script>x</script>"]) {
  r = sizes(marks({ read: { [f]: 5 } }));
  ok(fails(r) && r.out.includes("is no tracked file"), `reading-size.mjs: refuses with its mend a file read named ${f}, never counting it`);
}
ok(fails(sizes(marks({ past: { "../outside/x": 1 } }))), "reading-size.mjs: refuses with its mend a file past the split mark named outside the project");
// (a line of "past" as { "mark", "why" } (#469): a mark out of range or missing, a why of the wrong type, each refused;
// a why too long or of markup is text, printed by no failure, and the line is read as any other)
for (const [line, what] of [[{ mark: 0, why: "x" }, "a mark of 0"], [{ mark: -1, why: "x" }, "a mark of -1"], [{ mark: 1.5, why: "x" }, "a mark of 1.5"], [{ why: "x" }, "no mark"],
  [{ mark: "20000", why: "x" }, "a mark as a string"], [{ mark: 1, why: 7 }, "a why of a number"], [{ mark: 1, why: ["x"] }, "a why of a list"], [{ mark: 1, why: null }, "a why of null"], [[1, "x"], "a list"]])
  ok(fails(sizes(marks({ past: { "a.md": line } }))), `reading-size.mjs: refuses with its mend a line of "past" with ${what}`);
for (const why of ["w".repeat(1 << 20), "<script>alert(1)</script>\n::error::forged"]) {
  r = sizes(marks({ past: { "../outside/x": { mark: 1, why } } }));
  ok(fails(r) && !r.out.includes("<script>") && !r.out.includes("::error::forged") && r.out.length < 100000, "reading-size.mjs: a why too long or of markup is read as text and never printed");
}
// (a tracked file that is a link to a pipe, which never ends, or a folder, is refused before it is read: #446. A pipe,
// not a device: where a fault the mutation tool puts in lets it be read, the read waits until the tool stops it, where
// an endless device would fill the machine's memory)
const pipe = at => process.platform !== "win32" && spawnSync("mkfifo", [at]).status === 0;
if (pipe(path.join(outside, "pipe"))) {
  fs.symlinkSync(path.join(outside, "pipe"), path.join(p, "zero.md"));
  fs.symlinkSync(path.join(outside, "x"), path.join(p, "out.md"));
  fs.mkdirSync(path.join(p, "folder.md"));
  fs.writeFileSync(path.join(p, "folder.md/x"), "x\n");
  gitP("add", "zero.md", "out.md", "folder.md/x");
  for (const f of ["zero.md", "out.md", "folder.md"]) {
    r = sizes(marks({ read: { "a.md": 20000, [f]: 5 } }));
    ok(fails(r) && (f === "folder.md" ? r.out.includes("is no tracked file") || r.out.includes("is no regular file") : r.out.includes("is no regular file")) && r.ms < 5000, `reading-size.mjs: refuses with its mend a file read that is ${{ "zero.md": "a link to a pipe", "out.md": "a link to a file outside the project" }[f] ?? "a folder"}, never reading it, in ${r.ms} ms`);
  }
  // (the config is read only where it is a regular file within its bound; of the tracked files, a link is never read
  // to be counted, one to a folder of the project's own among them)
  fs.symlinkSync(path.join(outside, "pipe"), path.join(p, "checks/pipe.json"));
  r = run("reading-size.mjs", "checks/pipe.json");
  ok(fails(r) && r.ms < 5000, `reading-size.mjs: refuses with its mend a config that is a link to a pipe, never reading it, in ${r.ms} ms`);
  fs.rmSync(path.join(p, "checks/pipe.json"));
  // (a config named inside the folder it is run from that is a link leading out of it is refused, never read)
  fs.writeFileSync(path.join(outside, "out.json"), "{}\n");
  fs.symlinkSync(path.join(outside, "out.json"), path.join(p, "checks/out.json"));
  r = run("reading-size.mjs", "checks/out.json");
  ok(fails(r) && r.out.includes("leads out of the project, or nowhere, through the link checks/out.json"), "reading-size.mjs: refuses with its mend a config that is a link leading out of the project, naming the link", r.out);
  r = run("copies.mjs", "checks/out.json");
  ok(fails(r) && r.out.includes("leads out of the project, or nowhere, through the link checks/out.json") && !r.out.includes("as JSON"), "copies.mjs: refuses with its mend a config that is a link leading out of the project, naming the link, not as a fault of its JSON", r.out);
  fs.rmSync(path.join(p, "checks/out.json")); fs.rmSync(path.join(outside, "out.json"));
  // (one that leads nowhere through no link, a `..` after a part that does not stand, names no link; Windows folds it
  // by its spelling, so the case is held where a `..` is read as the system reads it)
  if (process.platform !== "win32") for (const script of ["reading-size.mjs", "copies.mjs"]) {
    r = run(script, "nothere/../x.json");
    ok(fails(r) && r.out.includes("leads out of the project, or nowhere, so it is not read") && !r.out.includes("through the link"), `${script}: refuses with its mend a config that leads nowhere through no link, naming none`, r.out);
  }
  fs.symlinkSync("folder.md", path.join(p, "inner.md"));
  gitP("add", "inner.md");
  r = sizes(marks({ split: 10 }));
  ok(r.status === 0 && !raw(r.out) && /Past 0\.0 KB: a\.md$/mu.test(r.out), "reading-size.mjs: a tracked link, to a folder among them, is not read to be counted", r.out);
  gitP("rm", "-q", "--cached", "inner.md"); fs.rmSync(path.join(p, "inner.md"));
  gitP("rm", "-q", "--cached", "zero.md", "out.md", "folder.md/x");
  fs.rmSync(path.join(p, "zero.md")); fs.rmSync(path.join(p, "out.md")); fs.rmSync(path.join(p, "folder.md"), { recursive: true });
} else console.log("skip reading-size.mjs: a file read that is a link to a pipe: no pipe can be made here (Windows)");
r = sizes(marks({ read: Object.fromEntries(Array.from({ length: BIG }, (_, i) => [`f${i}.md`, 5])) }));
ok(fails(r) && r.ms < 5000, `reading-size.mjs: refuses with its mend ${BIG} files read that are not there, in ${r.ms} ms`);

// ---- shape.mjs: parseConfig, and where() the manifest names the config ----
const shape = c => thrown(() => parseConfig(typeof c === "string" ? c : JSON.stringify(c), KIT));
const SHAPE = { baseline: "checks/shape-baseline.json", code: ["src/"] };
for (const [c, what] of [["null", "null"], ["[]", "a list"], ["5", "a number"], ['"x"', "a string"], [{ ...SHAPE, code: "src/" }, "code that is no list"], [{ ...SHAPE, systems: [] }, "systems that is a list"],
  [{ ...SHAPE, select: { proof: "x" } }, "select.proof that is no list"]]) ok(mended(shape(c)), `shape.mjs: parseConfig refuses with its mend a config of the wrong type: ${what}`);
ok(mended(shape("")) && mended(shape("{}")), "shape.mjs: parseConfig refuses with its mend an empty config, and one with no baseline");
// (the marks of a change a project adds, #458: plain text, so that none can make the check slow, and none too long, too
// many or holding a control character)
for (const [changes, what] of [[["x".repeat(121)], "a mark too long"], [Array.from({ length: 21 }, (_, i) => `Mark${i}:`), "too many marks"], [["Changed:\u0000"], "a control character"], [["Changed:\n"], "a line break"], [[7], "a mark of the wrong type"], ["Changed:", "a mark that is no list"]])
  ok(mended(shape({ ...SHAPE, changes })), `shape.mjs: parseConfig refuses with its mend the marks of a change with ${what}`);
// (a mark's length counted in characters, as the schema counts them: one of 70 characters outside the Basic Multilingual
// Plane, 140 of UTF-16's halves, is kept, and one of 121 refused)
const wide = "\u{1F600}".repeat(70);
ok(parseConfig(JSON.stringify({ ...SHAPE, changes: [wide] }), KIT).changes.some(([name]) => name === JSON.stringify(wide)) && mended(shape({ ...SHAPE, changes: ["\u{1F600}".repeat(121)] })),
  "shape.mjs: a mark of a change is held to 120 characters, never to UTF-16's halves: one the schema takes is kept, one past it refused");
const asText = ["^(a+)+$", "a*a*a*b", "(a|a)*b", "<b>Changed</b>:"];
ok(!shape({ ...SHAPE, changes: asText }), "shape.mjs: parseConfig takes the marks of a change as plain text, a pattern's or markup's characters only text to match");
const slowFor = parseConfig(JSON.stringify({ ...SHAPE, changes: asText }), KIT), t0 = Date.now();
const lines400 = Array.from({ length: 200 }, () => `// ${"a".repeat(400)}!`).join("\n");
const surveyed = survey({ "src/a.js": `${lines400}\n// a line that says (a|a)*b by name\n` }, slowFor);
ok(Date.now() - t0 < 5000 && surveyed.entries.get('change: src/a.js: "(a|a)*b"')?.n.count === 1, "shape.mjs: a project's marks are found as text, in time, whatever a comment holds", `${Date.now() - t0} ms`);
for (const b of ["../x.json", "/etc/x.json", "C:\\x.json", "a/../../x.json", "<b>x</b>.json"]) ok(mended(shape({ ...SHAPE, baseline: b })), `shape.mjs: parseConfig refuses with its mend a baseline at ${b}`);
ok(mended(shape({ ...SHAPE, aliases: { "@/": "../src/" } })) && mended(shape({ ...SHAPE, systems: { a: { paths: ["/etc/"] } } })), "shape.mjs: parseConfig refuses with its mend an alias or a system's path that leaves the project");
// (a pathspec of "code" or "tests" that leaves the project, #924: git would refuse it with its own error and no mend)
for (const key of ["code", "tests"]) for (const spec of ["../outside/", "/etc/", ":(top)../", "src/../../x", ":!../x", ":(exclude)/etc/", ":/../x", "C:\\x", "src\\..\\..\\x", ".."]) ok(mended(shape({ ...SHAPE, [key]: [spec] })), `shape.mjs: parseConfig refuses with its mend a pathspec of "${key}" that leaves the project: ${spec}`);
ok(["src/", "src/../lib/", ":!src/gen/", ":(glob)**/*.test.*", ":/src/", ":(top,exclude)core/", ".", "..foo/"].every(spec => shape({ ...SHAPE, code: [spec], tests: [spec] }) === ""), "shape.mjs: parseConfig takes a pathspec that stays inside the project, magic and a \"..\" that climbs back in included");
ok(mended(shape({ ...SHAPE, systems: { "<script>": { paths: ["src/"] } } })), "shape.mjs: parseConfig refuses with its mend a system named with markup");
for (const [k, v] of [["marks", '{"lines":-1}'], ["marks", '{"depth":1e309}'], ["marks", '{"branches":1.5}'], ["long", "1e309"], ["wait", "-3"], ["suites", '{"x":0}']])
  ok(mended(shape(`{"baseline":"b.json","code":["src/"],"${k}":${v}}`)), `shape.mjs: parseConfig refuses with its mend "${k}" of ${v}, out of range`);
let [said, ms] = timed(() => shape({ ...SHAPE, systems: Object.fromEntries(Array.from({ length: BIG }, (_, i) => [`s${i}`, { paths: [`src/s${i}/`] }])) }));
ok(said === "" && ms < 5000, `shape.mjs: parseConfig reads ${BIG} systems in ${ms} ms`);
[said, ms] = timed(() => shape(`{"baseline":"b.json","code":["src/"],"x":"${"y".repeat(5 << 20)}"}`));
ok(mended(said) && ms < 5000, `shape.mjs: parseConfig refuses with its mend a config of 5 MB, in ${ms} ms`);
const row = at => `| *shape check* | \`${at}\` |`;
ok([null, undefined, 5, {}, "", row("C:\\x.json"), row("<b>.json")].every(m => where(m) === KIT), "shape.mjs: where() reads the kit's config where the manifest is of the wrong type, empty, or names none in plain path");
[said, ms] = timed(() => where(`${row("x").repeat(1)}${"*".repeat(5 << 20)}`));
ok(said === KIT && ms < 5000, `shape.mjs: where() reads a manifest of 5 MB in ${ms} ms`);

// ---- size.mjs: the caps a version of it sets, and a pull request's comments ----
const caps = line => capsOf(`export const CAPS = {\n${line}\n};\n`);
ok(capsOf("export const CAPS = {\n  builder: 28 * 1024,\n};\n")?.builder === 28 * 1024, "size.mjs: capsOf reads a block written as it is");
for (const n of ["-1", "0", "1e309", "NaN", "9999999", "1.5"]) ok(caps(`  builder: ${n} * 1024,`) === null, `size.mjs: capsOf reads no cap of ${n}, out of range`);
ok([null, 5, {}, [], ""].every(t => capsOf(t) === null), "size.mjs: capsOf reads no cap from what is no text, or from nothing");
ok(caps("  <script>: 1 * 1024,") === null && caps('  "../x": 1 * 1024,') === null, "size.mjs: capsOf reads no cap of a role named with markup or a path");
[said, ms] = timed(() => capsOf(`export const CAPS = {\n${"  builder: 1 * 1024,\n".repeat(BIG)}};\n`));
ok(said === null && ms < 5000, `size.mjs: capsOf reads no cap from ${BIG} lines of one role, in ${ms} ms`);
ok([null, 5, "Leanness check: yes", {}, [null, 5, "x", [{ author_association: "OWNER", body: 5, user: me }], { author_association: "NONE", body: "Leanness check: yes", user: me }]].every(c => !answered(c, owner))
  && answered([{ author_association: "OWNER", body: "Leanness check: yes", user: me }], owner),
  "size.mjs: answered reads no answer from comments of the wrong type, nor one by a writer GitHub does not name");
[said, ms] = timed(() => answered(Array.from({ length: BIG }, () => ({ author_association: "OWNER", body: `<b>${"x".repeat(100)}`, user: me })), owner));
ok(said === false && ms < 5000, `size.mjs: answered reads no answer from ${BIG} comments that open with markup, in ${ms} ms`);
const sizeBase = path.join(tmp, "size-base.mjs"), comments = path.join(tmp, "comments.json");
fs.copyFileSync(path.join(root, "scripts/size.mjs"), sizeBase);
for (const [text, what] of [["", "empty"], ["null", "null"], ["{", "no JSON"]]) {
  fs.writeFileSync(comments, text);
  const q = spawnSync(process.execPath, [path.join(root, "scripts/size.mjs"), "--raise", sizeBase, comments], { cwd: tmp, encoding: "utf8" });
  ok(q.status === 1 && mended(`${q.stdout}${q.stderr}`) && !raw(q.stderr), `size.mjs: --raise refuses with its mend comments that are ${what}`);
}

// ---- manifest-reads.mjs: core-manifest.md, against the modules ----
const read = manifest => notes({ manifest, moduleTexts: { "a.md": "Reads the *progress file*." } });
for (const m of [null, undefined, 5, {}, ""]) {
  const n = read(m);
  ok(n.some(l => l.includes("cannot be read")), `manifest-reads.mjs: notes reads a manifest of ${JSON.stringify(m) ?? "undefined"} as taking no module it can tell, and says so`);
}
ok(read("Modules: `../../etc/passwd`, `/etc/x.md`.\n").some(l => l.includes("cannot be read") || l.includes("no module of the core")), "manifest-reads.mjs: notes reads paths on the Modules line as no module, and opens no file");
ok(read("Modules: <img src=x onerror=alert(1)>.\n").some(l => l.includes("cannot be read")), "manifest-reads.mjs: notes reads markup on the Modules line as no module, and only quotes it");
[said, ms] = timed(() => read(`Modules: ${Array.from({ length: BIG }, (_, i) => `\`m${i}.md\``).join(", ")}.\n${"*x ".repeat(1 << 20)}`));
ok(said.length === BIG + 1 && ms < 5000, `manifest-reads.mjs: notes reads a manifest of ${BIG} names and 3 MB in ${ms} ms, each name no module`);
// (a list of names the core moved and modules it keeps, each many times over, read by the step that places every
// module and written by its writer, each within the limit; #1259, point 1)
{
  const many = { manifest: `Modules: ${Array.from({ length: BIG }, (_, i) => i % 2 ? "git" : "cleaning").join(", ")}.\n`, files: [] };
  [said, ms] = timed(() => thrown(() => modules.check(many)));
  ok(!said.startsWith("raw") && ms < 5000, `step-checks-modules.mjs: the step of the modules reads ${BIG} names, half of them moved, in ${ms} ms`);
  [said, ms] = timed(() => thrown(() => rewritten(many, { except: ["done-when.md", "planning.md", "repositories.md"] })));
  ok(!said.startsWith("raw") && ms < 5000, `step-checks-modules.mjs: rewritten writes ${BIG} names, half of them moved, in ${ms} ms`);
}
// (a stub imported in many spellings, read once; a link open for 1 MB: #1272)
{
  const stub = `# Moved: x\n\n${Array.from({ length: 4 * BIG }, (_, i) => `@../t${i}.md`).join("\n")}`, want = `# C\n\n${BEGIN}\n@AGENTS.md\n${END}\n`;
  const rule = `${Array.from({ length: BIG }, (_, i) => `@core/${"./".repeat(i % 50)}modules/${"x/../".repeat(Math.floor(i / 50) % 20)}claude.md`).join("\n")}\n${"@core/modules/claude.md\n".repeat(BIG)}${want}`;
  let reads = 0;
  const seen = new Map(), at = f => stubOf(g => { reads += 1; return g === "core/modules/claude.md" ? stub : null; }, ".", f, seen);
  [said, ms] = timed(() => thrown(() => converged("CLAUDE.md", rule, want, [], () => true, at)));
  ok(!said.startsWith("raw") && reads === 1 && ms < 5000, `core-owned.mjs: ${2 * BIG} imports of a stub of ${4 * BIG} links read in ${ms} ms`);
  for (const open of ["Now in [`x`](", "[`x`]("]) {
    const long = `# Moved: x\n\n${open}${"a".repeat(1 << 20)} holds these rules now\n`;
    [said, ms] = timed(() => thrown(() => stubOf(() => long, ".", "x.md")));
    ok(!said.startsWith("raw") && ms < 5000, `core-owned.mjs: a stub's link "${open}" open for 1 MB read in ${ms} ms`);
  }
}
// (a number has no place in the manifest's lines this reader reads: no case of one out of range applies)
// (a module of the copy that is a link, and a manifest that is one, to a pipe, are read as no module and no text)
if (fs.existsSync(path.join(outside, "pipe"))) {
  const home = path.join(p, "home"), put = (f, t) => { fs.mkdirSync(path.dirname(path.join(home, f)), { recursive: true }); fs.writeFileSync(path.join(home, f), t); };
  for (const d of ["roles/shared", "tasks", "tools"]) put(`${d}/a${d.length}.md`, "# A module\n");
  fs.symlinkSync(path.join(outside, "pipe"), path.join(home, "tasks/linked.md"));
  put("core-manifest.md", "Modules: all.\n");
  [said, ms] = timed(() => thrown(() => ok(!projectNotes(home, home).some(l => l.includes("linked")), "manifest-reads.mjs: a module of the copy that is a link is no module")));
  ok(!said && ms < 5000, `manifest-reads.mjs: the copy's modules read in ${ms} ms, a link among them never opened`);
  fs.rmSync(path.join(home, "core-manifest.md")); fs.symlinkSync(path.join(outside, "pipe"), path.join(home, "core-manifest.md"));
  [said, ms] = timed(() => thrown(() => projectNotes(home, home)));
  ok(!said && ms < 5000, `manifest-reads.mjs: a manifest that is a link to a pipe is read as empty, in ${ms} ms`);
  fs.rmSync(home, { recursive: true, force: true });
}

// ---- sync.mjs and look.mjs: core-manifest.md, read as the steps read it (own-files.mjs; #446) ----
// (a manifest that is a link out of the project, to a file or a device, is no file of the project's own: each refuses
// it before it fetches, asks or writes anything; a link cannot be made on Windows)
if (process.platform !== "win32") {
  const away = path.join(outside, "manifest.md"), was = "Core: the-core at 0000000000000000000000000000000000000000, copied whole under `core/`.\n";
  fs.writeFileSync(away, was);
  for (const [what, to] of [["a file outside the project", away], ...(fs.existsSync(path.join(outside, "pipe")) ? [["a pipe, which never ends", path.join(outside, "pipe")]] : [])]) {
    fs.symlinkSync(to, path.join(p, "core-manifest.md"));
    const synced = run("sync.mjs"), looked = run("look.mjs");
    ok(synced.status === 1 && synced.out.includes("a regular file of the project's own") && !raw(synced.out) && synced.ms < 5000, `sync.mjs: a manifest that is a link to ${what} is refused before anything is fetched`);
    ok(fails(looked) && looked.out.includes("no regular file of the project's own") && looked.ms < 5000, `look.mjs: a manifest that is a link to ${what} is refused with its mend, nothing looked at`);
    // (the checks that read the manifest for where things are read it within its bound, never waiting on it)
    for (const script of ["manifest-reads.mjs", "shape.mjs", "choices.mjs", "dose.mjs"]) {
      const r2 = run(script);
      ok(r2.status !== null && !raw(r2.out) && r2.ms < 5000, `${script}: a manifest that is a link to ${what} is read within a bound, in ${r2.ms} ms`);
    }
    fs.rmSync(path.join(p, "core-manifest.md"));
  }
  ok(fs.readFileSync(away, "utf8") === was, "sync.mjs: the manifest outside, which a link named, is left as it was");
  fs.rmSync(away);
  fs.rmSync(path.join(outside, "pipe"), { force: true });
} else console.log("skip sync.mjs and look.mjs: a manifest that is a link out: Windows makes no link here");

// ---- licences.mjs: loadConfig, checks/licences.json ----
const lic = c => { write("checks/licences.json", typeof c === "string" ? c : JSON.stringify(c)); return thrown(() => loadConfig(path.join(p, "checks/licences.json"))); };
const LIC = { lockfiles: ["package-lock.json"], ships: ["package.json"] };
for (const [c, what] of [["null", "null"], ["[]", "a list"], ["5", "a number"], [{ ...LIC, lockfiles: "x" }, "lockfiles that is no list"], [{ lockfiles: ["x"] }, "no ships"], [{ ...LIC, audit: 5 }, "an audit that is a number"],
  [{ ...LIC, scan: [] }, "a scan that is a list"], [{ ...LIC, lockfiles: [1e309] }, "a lockfile that is a number out of range"]]) ok(mended(lic(c)), `licences.mjs: loadConfig refuses with its mend a config of the wrong type: ${what}`);
ok(mended(lic("")) && mended(thrown(() => loadConfig(path.join(p, "checks/none.json")))) && mended(lic({ ships: [] })), "licences.mjs: loadConfig refuses with its mend an empty config, one not there, and one naming nothing");
for (const at of ["../x", "/etc", "a/../../x"]) ok(mended(lic({ ...LIC, audit: "a.json", scan: { served: [at] } })), `licences.mjs: loadConfig refuses with its mend a scan of ${at}, which leaves the project`);
ok(mended(lic({ ...LIC, data: ["<script>"] })) && mended(lic({ ...LIC, accepted: [{ package: "<b>@1" }] })), "licences.mjs: loadConfig refuses with its mend a package named with markup");
[said, ms] = timed(() => lic({ ...LIC, data: Array.from({ length: BIG }, (_, i) => `pkg-${i}`), fonts: ["x".repeat(5 << 20)] }));
ok(said === "" && ms < 5000, `licences.mjs: loadConfig reads a config of ${BIG} names and 5 MB in ${ms} ms`);

// ---- steps.mjs: SECURITY.md's rule 5, its inputs and their hostile tests ----
const inputs = STEPS.filter(s => s.lead === "16 November 2026, hostile tests for every named input");
const sec = text => { write("SECURITY.md", text); return notDone(p, inputs); };
const rule5 = body => sec(`# Security\n\n4. **Outsiders.** x\n5. **Untrusted input.**\n${body}\n6. **Markup.** x\n`);
const reported = (n, ...words) => n.length === 1 && words.every(w => n[0].mend.includes(w));
ok(inputs.length === 1 && rule5("   None.").length === 0, "steps.mjs: rule 5 that says None reads done (the case each other is tried against)");
fs.mkdirSync(path.join(outside, "tests"));
fs.writeFileSync(path.join(outside, "tests/t.mjs"), "\n");
for (const at of ["../outside/tests/t.mjs", path.join(outside, "tests/t.mjs"), "/etc/passwd", "C:\\x", "./", "."]) ok(reported(rule5(`   - a peer's message: hostile tests: \`${at}\`.`), "a peer's message"), `steps.mjs: an input whose tests are named at ${at}, no file of the project, is reported`);
ok(reported(rule5("   - <script>alert(1)</script>: hostile tests: `<b>`."), "<script>"), "steps.mjs: an input named with markup, its tests too, is reported, its words only quoted");
ok(reported(rule5(""), "as an item of its own") && reported(rule5("   Each message, checked."), "as an item of its own"), "steps.mjs: rule 5 with no item, nothing at all, is reported");
[said, ms] = timed(() => rule5(Array.from({ length: BIG }, (_, i) => `   - input ${i}: hostile tests: \`t${i}.mjs\`.`).join("\n")));
ok(reported(said, "input 49999") && ms < 5000, `steps.mjs: ${BIG} inputs named are each read in ${ms} ms, and reported`);
const unread = n => n.length === 1 && n[0].mend.includes("could not read the project");
ok(unread(sec("")) && unread(sec(Buffer.from([0, 0xff, 0x35, 0x2e, 0]))), "steps.mjs: an empty SECURITY.md, or one of bytes, is reported as not read, never done");
fs.rmSync(path.join(p, "SECURITY.md"));
ok(unread(notDone(p, inputs)), "steps.mjs: a project with no SECURITY.md is reported as not read");
fs.mkdirSync(path.join(p, "SECURITY.md"));
ok(unread(notDone(p, inputs)), "steps.mjs: SECURITY.md that is a folder, the wrong type, is reported as not read");
// (rule 5 is found by its number at a line's start: no number in it is read as a value, so none is out of range)

// ---- read-nothing.mjs: the shape config and the manifest, read for the checks that read nothing (#459) ----
// (a config whose pathspecs leave the project, reach its whole tree or run long, one of the wrong type, and a manifest
// that names a config with markup or a path out: each is read in time as the shape check reads it, a config the check
// cannot read naming no check, a config not there naming it with that why, and no file outside the project listed)
{
  // (read as the steps read the project: its own files alone, through own-files.mjs, listed afresh at each call)
  const shapeAt = "checks/shape.json", readP = f => ownFiles(p).read(f);
  const named = (config, manifest = "") => { if (config === null) fs.rmSync(path.join(p, shapeAt), { force: true }); else { write(shapeAt, typeof config === "string" ? config : JSON.stringify(config)); gitP("add", "-A"); } return readNothing(p, manifest, readP); };
  const shapeSaid = l => l.find(n => n.script === "scripts/shape.mjs");
  for (const [c, what] of [[{ ...SHAPE, code: ["../outside/"] }, "a path that leaves the project"], [{ ...SHAPE, code: [outside] }, "an absolute path outside"], [{ ...SHAPE, code: [":(top)../"] }, "a magic pathspec"],
    [{ ...SHAPE, code: "src/" }, "code that is no list"], ["<b>", "markup"], ["", "nothing at all"]]) {
    let thrownBy = null, said = null;
    try { said = named(c); } catch (e) { thrownBy = e; }
    ok(thrownBy === null && !(shapeSaid(said)?.why ?? "").includes("outside"), `read-nothing.mjs: a shape config with ${what} is read as the check reads it, no file outside the project listed and nothing thrown`);
  }
  [said, ms] = timed(() => named({ ...SHAPE, code: Array.from({ length: BIG }, (_, i) => `src/d${i}/`) }));
  ok(ms < 5000, `read-nothing.mjs: a shape config of ${BIG} pathspecs is read in ${ms} ms`);
  ok(/holds no `checks\/shape\.json`/u.test(shapeSaid(named(null))?.why ?? ""), "read-nothing.mjs: a project with no shape config is said to have none, never to name nothing");
  // (a config outside the project, which would change the verdict were it read: the manifest that names it gets the
  // verdict of no config at all)
  fs.writeFileSync(path.join(outside, "x.json"), JSON.stringify({ ...SHAPE, code: ["."] }));
  // (markup is no path, so the kit's config is read in its place; a path out is read as no config)
  // (and a link in the project to that config, at the file or at a folder on its way, is read as no config too)
  const links = process.platform === "win32" ? [] : [["checks/linked.json", path.join(outside, "x.json")], ["away", outside]];
  for (const [at, to] of links) { fs.symlinkSync(to, path.join(p, at)); gitP("add", "-A"); }
  for (const [m, none] of [["| *shape check* | `<img src=x>.json` |", false], ["| *shape check* | `../outside/x.json` |", true], ...(links.length ? [["| *shape check* | `checks/linked.json` |", true], ["| *shape check* | `away/x.json` |", true]] : [])]) {
    let thrownBy = null, said = null;
    try { said = named(SHAPE, m); } catch (e) { thrownBy = e; }
    ok(thrownBy === null && /holds no `/u.test(shapeSaid(said)?.why ?? "") === none, `read-nothing.mjs: a manifest that names the shape config as ${m.split("`")[1]} is read with nothing thrown and nothing outside read`);
  }
  for (const [at] of links) fs.rmSync(path.join(p, at));
  if (links.length) gitP("add", "-A");
  fs.rmSync(path.join(outside, "x.json"));
  fs.rmSync(path.join(p, shapeAt), { force: true });
  gitP("add", "-A");
}

// ---- nothing written outside the project ----
ok(fs.readdirSync(outside).join() === "tests,x" && fs.readdirSync(tmp).filter(n => n !== OWNER).sort().join() === "outside,project,size-base.mjs,comments.json".split(",").sort().join(), "nothing was written outside the project");

process.exit(failed ? 1 : 0);
