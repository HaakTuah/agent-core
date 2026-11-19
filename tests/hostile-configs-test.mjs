// Hostile tests of one input the core names under floor rule 5 (floor/topics/input.md): a project's configs of the core's
// checks (checks/copies.json, shape.json, sizes.json, licences.json), its core-manifest.md and its SECURITY.md's rule 5.
// Each reader is tried, as each case's shape allows, with too long, the wrong type, markup, a path that leaves the
// project, a number out of range, and nothing at all; each fails with its mend or reads the input as not there, and
// reads and writes nothing outside the project. The readers: copies.mjs and reading-size.mjs, run from a scratch
// project's copy of the core; shape.mjs's parseConfig and where; size.mjs's capsOf, answered and --raise;
// manifest-reads.mjs's notes; licences.mjs's loadConfig; steps.mjs's notDone with the step for rule 5's inputs. Test
// data is made up. Run by the core's tests workflow (.github/workflows/tests.yml). Git and Node's own modules.
//
//   node tests/hostile-configs-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../scripts/licences.mjs";
import { notes } from "../scripts/manifest-reads.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir, root } from "../scripts/scratch-core.mjs";
import { parseConfig, where, KIT } from "../scripts/shape.mjs";
import { answered, capsOf } from "../scripts/size.mjs";
import { STEPS, notDone } from "../scripts/steps.mjs";
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
  const started = Date.now(), r = spawnSync(process.execPath, [path.join(p, "core/scripts", script), ...args], { cwd: p, encoding: "utf8", maxBuffer: 1 << 28 });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, ms: Date.now() - started };
};
const raw = out => /\n\s+at |TypeError|ReferenceError|RangeError/u.test(out);
const fails = r => r.status === 1 && mended(r.out) && !raw(r.out);
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
r = sizes(marks({ read: Object.fromEntries(Array.from({ length: BIG }, (_, i) => [`f${i}.md`, 5])) }));
ok(fails(r) && r.ms < 5000, `reading-size.mjs: refuses with its mend ${BIG} files read that are not there, in ${r.ms} ms`);

// ---- shape.mjs: parseConfig, and where() the manifest names the config ----
const shape = c => thrown(() => parseConfig(typeof c === "string" ? c : JSON.stringify(c), KIT));
const SHAPE = { baseline: "checks/shape-baseline.json", code: ["src/"] };
for (const [c, what] of [["null", "null"], ["[]", "a list"], ["5", "a number"], ['"x"', "a string"], [{ ...SHAPE, code: "src/" }, "code that is no list"], [{ ...SHAPE, systems: [] }, "systems that is a list"],
  [{ ...SHAPE, select: { proof: "x" } }, "select.proof that is no list"]]) ok(mended(shape(c)), `shape.mjs: parseConfig refuses with its mend a config of the wrong type: ${what}`);
ok(mended(shape("")) && mended(shape("{}")), "shape.mjs: parseConfig refuses with its mend an empty config, and one with no baseline");
for (const b of ["../x.json", "/etc/x.json", "C:\\x.json", "a/../../x.json", "<b>x</b>.json"]) ok(mended(shape({ ...SHAPE, baseline: b })), `shape.mjs: parseConfig refuses with its mend a baseline at ${b}`);
ok(mended(shape({ ...SHAPE, aliases: { "@/": "../src/" } })) && mended(shape({ ...SHAPE, systems: { a: { paths: ["/etc/"] } } })), "shape.mjs: parseConfig refuses with its mend an alias or a system's path that leaves the project");
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
ok([null, 5, "Leanness check: yes", {}, [null, 5, "x", [{ author_association: "OWNER", body: 5 }], { author_association: "NONE", body: "Leanness check: yes" }]].every(c => !answered(c)),
  "size.mjs: answered reads no answer from comments of the wrong type, nor one by a writer GitHub does not name");
[said, ms] = timed(() => answered(Array.from({ length: BIG }, () => ({ author_association: "OWNER", body: `<b>${"x".repeat(100)}` }))));
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
// (a number has no place in the manifest's lines this reader reads: no case of one out of range applies)

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

// ---- nothing written outside the project ----
ok(fs.readdirSync(outside).join() === "tests,x" && fs.readdirSync(tmp).sort().join() === "outside,project,size-base.mjs,comments.json".split(",").sort().join(), "nothing was written outside the project");

process.exit(failed ? 1 : 0);
