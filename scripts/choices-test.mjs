// Tests of the records of the choices that are hard to undo (choices.mjs): where a project keeps them, what a record
// holds, when their pass is due, a sign written in a measure, and the scheduled look's readers of them. git and Node's
// own modules.
//
//   node scripts/choices-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DAYS, KIT, LISTED, MEASURES, MOST, TITLE, TRIPPED, due, look, parse, records, report, signs, tripped, trippedBody, where } from "./choices.mjs";
import { DUE } from "./look.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const here = path.dirname(fileURLToPath(import.meta.url));

// ---- where they are ----
ok(where("") === KIT && where(null) === KIT, "with no slot named, the records are the starter kit's file");
ok(where("| *choice records* | `docs/design.md` |") === "docs/design.md", "a manifest's row names them");
ok(where("the *choice records*: `CHOICES.md`; the *report*: the PR's description") === "CHOICES.md", "the core's AGENTS.md names them in its slots");
ok(where("| *choice records* | `../elsewhere.md` |") === null && where("| *choice records* | `/etc/x` |") === null && where("| *choice records* | `a/../../b` |") === null,
  "a name that leads out of the project is no path the records are read from");
ok(where(fs.readFileSync(path.join(here, "..", "AGENTS.md"), "utf8")) === "CHOICES.md", "the core names its own records");

// ---- what a record holds ----
const at = day => `${day}T12:00:00Z`;
const file = day => `# Choices that are hard to undo\n\nRead whole: ${day}\n\n## Choice: one language\n\n- Chosen for: x.\n- Reopens it: a test takes over a minute.\n\n## Choice: where data is kept\r\n\r\n- Chosen for: y.\r\n\r\n## Notes\n\nReopens it: not this record's.\n`;
const found = parse(file("2026-11-15"));
ok(found.records.length === 2 && found.records[0].name === "one language" && found.records[0].sign && !found.records[1].sign,
  "each record is found by its heading, with whether it names its sign; a line under another heading is not its sign", JSON.stringify(found));
ok(found.read === "2026-11-15" && found.open === 0, "the day of the last pass is read from its line");
ok(parse("## Choice: a\nReopens it:\n").records[0].sign === false, "an empty sign names none");
ok(parse("Read whole: FILL IN: today\n## Choice: a\nReopens it: FILL IN: the sign\n").open === 2 && parse("Read whole: soon\n").read === null && parse("Read whole: 2026-13-45\n").read === null,
  "a line still to fill in is counted, and a day that is no day is none");
ok(parse("## Choice: a\u0007b\n").records[0].name === "a b" && parse("## Choice: a\u202eb\u200bc\n").records[0].name === "a b c", "a name is printed with no control characters, nor any that reorder or hide text");
const kitText = fs.readFileSync(path.join(here, "..", "setup", "template", "choices.md.tmpl"), "utf8");
ok(parse(kitText).records.length === 0 && parse(kitText).open > 0 && due(parse(kitText), at("2030-01-01")) === null,
  "the starter kit's file, its record still to fill in, holds no record yet, so no pass is due in a new project");

// ---- when the pass is due ----
ok(due(parse("Read whole: 2020-01-01\n"), at("2026-11-15")) === null, "with no record, no pass is due");
ok(due(found, at("2027-05-15")) === null, `${DAYS - 1} days after the last pass, it is not due`);
ok(/2026-11-15, 182 days before 2027-05-16/.test(due(found, at("2027-05-16")) ?? ""), "182 days after the last pass, it is due, and says why");
ok(/holds no day/.test(due(parse("## Choice: a\n"), at("2026-11-15")) ?? ""), "records whose pass has no day are due");

// ---- the look's reader ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "choices-"));
const project = (name, files) => {
  const dir = path.join(tmp, name);
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
ok(DUE.includes(look), "the scheduled look reads it");
const none = look({ manifest: "", at: at("2027-06-01"), root: project("none", {}) });
ok(none.title === TITLE && none.body === null && !none.unread, "with no records file, nothing is due, so an issue the look keeps for it closes");
const kit = project("kit", { "docs/choices.md": file("2026-11-15") });
ok(look({ manifest: "", at: at("2027-01-01"), root: kit }).body === null, "records read less than half a year ago: nothing due");
const body = look({ manifest: "", at: at("2027-06-01"), root: kit }).body ?? "";
ok(/`docs\/choices\.md` holds 2 records/.test(body) && /1 of them name no sign/.test(body) && /`node core\/scripts\/choices\.mjs`/.test(body) && /core\/modules\/choices\.md/.test(body) && /needs-owner/.test(body),
  "once due in a project, its issue names the file, the records, those with no sign, the rule and the script", body);
const named = project("named", { "design.md": file("2026-01-01") });
ok(/`design\.md` holds 2/.test(look({ manifest: "| *choice records* | `design.md` |", at: at("2027-06-01"), root: named }).body ?? ""), "the file the manifest names is read");
const core = project("core", { "AGENTS.md": "the *choice records*: `CHOICES.md`;", "CHOICES.md": file("2026-01-01") });
const ofCore = look({ manifest: null, at: at("2027-06-01"), root: core }).body ?? "";
ok(/`CHOICES\.md`/.test(ofCore) && /`node scripts\/choices\.mjs`/.test(ofCore) && /`modules\/choices\.md`/.test(ofCore), "in the core, its AGENTS.md names the file and the paths are the core's own", ofCore);
const linked = project("linked", { "real.md": file("2020-01-01") });
fs.mkdirSync(path.join(linked, "docs"), { recursive: true });
let link = true;
try { fs.symlinkSync(path.join(linked, "real.md"), path.join(linked, "docs", "choices.md")); } catch { link = false; }
if (link) {
  const r = look({ manifest: "", at: at("2027-06-01"), root: linked });
  ok(r.body === null && /no regular file/.test(r.unread ?? ""), "a link is not followed: the look leaves its issue as it stands", JSON.stringify(r));
  const folder = project("folder", { "elsewhere/choices.md": file("2020-01-01") });
  fs.symlinkSync(path.join(folder, "elsewhere"), path.join(folder, "docs"));
  const f = look({ manifest: "", at: at("2027-06-01"), root: folder });
  ok(f.body === null && /a link stands on its way/.test(f.unread ?? ""), "nor is a link at a folder on the file's way", JSON.stringify(f));
} else console.log("note no link can be made here, so a link's case is not run");
const outside = look({ manifest: "| *choice records* | `../kit/docs/choices.md` |", at: at("2027-06-01"), root: kit });
ok(outside.body === null && /no plain path/.test(outside.unread ?? ""), "a name outside the project is not read");
ok(records("", path.join(tmp, "none")).text === null, "a missing file reads as none, not as unread");
const large = project("large", { "docs/choices.md": `${file("2020-01-01")}${"x".repeat(MOST)}` });
ok(/past \d+ bytes/.test(records("", large).unread ?? ""), "a file past the most it reads is not read");

// ---- the script ----
const run = dir => spawnSync(process.execPath, [path.join(here, "choices.mjs")], { cwd: dir, encoding: "utf8" });
let r = run(kit);
ok(r.status === 0 && /`docs\/choices\.md`: 2 records, read whole on 2026-11-15/.test(r.stdout) && /- where data is kept: names no sign/.test(r.stdout), "it lists the records from a project's root", r.stdout + r.stderr);
fs.writeFileSync(path.join(kit, "core-manifest.md"), "| *choice records* | `../x.md` |\n");
r = run(kit);
ok(r.status === 1 && /Mend: name a regular file inside the project/.test(r.stderr), "where the records cannot be read, it fails and says the mend", r.stderr);
r = run(path.join(here, ".."));
ok(r.status === 0 && /`CHOICES\.md`: \d+ records, read whole on \d{4}-\d\d-\d\d/.test(r.stdout) && !/names no sign/.test(r.stdout), "the core's own records each name their sign and the day of their pass", r.stdout + r.stderr);

// ---- a sign written in a measure ----
const lines = parse("## Choice: a\n- Reopens it: past 150 files.\n- Trips when: `files > 150`, `cycles>=1`, `constructor > 1`, `rm -rf /`, `files > 1e9`\n## Choice: b\nTrips when: when it feels slow\n## Choice: c\n").records;
ok(JSON.stringify(lines[0].conditions) === JSON.stringify([{ measure: "files", op: ">", limit: 150 }, { measure: "cycles", op: ">=", limit: 1 }])
  && JSON.stringify(lines[0].unknown) === JSON.stringify(["constructor > 1", "rm -rf /", "files > 1e9"]),
  "a line \"Trips when:\" gives each condition in backticks that names a measure, an operator and a number; anything else is only quoted back, never run", JSON.stringify(lines[0]));
ok(lines[1].conditions.length === 0 && lines[1].unknown.join() === "when it feels slow" && lines[2].conditions.length === 0 && lines[2].unknown.length === 0,
  "a line with no condition in backticks is quoted back as naming none, and a record with no such line names none");
const reads = { listed: 4, read: 200, found: { read: { files: 151, functions: 150, imports: 50, unnamed: 0 }, entries: new Map([["cycle: a.js -> b.js", true], ["function: a.js#f", {}]]) } };
ok(JSON.stringify(Object.fromEntries(Object.entries(MEASURES).map(([k, [, of]]) => [k, of(reads)]))) === JSON.stringify({ files: 151, functions: 150, imports: 50, listed: 4, debt: 2, cycles: 1, unnamed: 0 }),
  "each measure is read from what the shape check reads");
ok(JSON.stringify(tripped(parse("## Choice: a\nTrips when: `files > 150`, `files > 151`, `debt <= 2`\n"), reads).map(c => `${c.measure}${c.op}${c.limit}=${c.value}`)) === JSON.stringify(["files>150=151", "debt<=2=2"]),
  "a condition trips where the number read holds it, and only then");
const measuredProject = fs.mkdtempSync(path.join(os.tmpdir(), "choices-measured-"));
const g = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: measuredProject, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const putIn = (f, t) => { fs.mkdirSync(path.dirname(path.join(measuredProject, f)), { recursive: true }); fs.writeFileSync(path.join(measuredProject, f), t); };
const sign = cond => `Read whole: 2026-11-15\n\n## Choice: one \`folder\` @someone\n\n- Reopens it: the folder grows.\n- Trips when: ${cond}\n`;
g("init", "-q", "-b", "main");
putIn("src/a.js", "import { b } from \"./b.js\";\nexport const a = () => b;\n");
putIn("src/b.js", "export const b = 1;\n");
putIn("docs/choices.md", sign("`files > 1`, `unknown > 2`"));
const pendingSigns = signs({ manifest: "", root: measuredProject });
ok(pendingSigns.title === TRIPPED && pendingSigns.body === null && /no config here/.test(pendingSigns.unread ?? ""), "with no config of the shape check, a measure cannot be read: the look leaves its issue as it stands", JSON.stringify(pendingSigns));
putIn("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src"] }));
spawnSync(process.execPath, [path.join(here, "shape.mjs"), "checks/shape.json", "--first"], { cwd: measuredProject, encoding: "utf8" });
g("add", "-A"); g("commit", "-q", "-m", "a project");
const trip = signs({ manifest: "", root: measuredProject });
ok(/`docs\/choices\.md`/.test(trip.body ?? "") && /- `one 'folder' @someone`: `files > 1`, and it reads 2 files of code the shape check reads\./.test(trip.body) && /`unknown > 2`/.test(trip.body)
  && /needs-owner in place of queued/.test(trip.body) && /`core\/modules\/choices\.md`/.test(trip.body) && /`node core\/scripts\/choices\.mjs`/.test(trip.body) && trip.owner === undefined,
  "where a condition holds, the look keeps an issue naming the choice in a code span, the condition, the number read, what names no measure, and what its session does; its labels are the session's to change", trip.body);
putIn("docs/choices.md", sign("`files > 2`"));
ok(signs({ manifest: "", root: measuredProject }).body === null && !signs({ manifest: "", root: measuredProject }).unread, "once no condition holds (the sign written anew), the look closes the issue");
putIn("docs/choices.md", sign("`cycles > 0`"));
putIn("src/b.js", "import { a } from \"./a.js\";\nexport const b = 1;\nexport const c = () => a;\n");
ok(/`cycles > 0`, and it reads 2 imports that lie on a cycle/.test(signs({ manifest: "", root: measuredProject }).body ?? ""), "a cycle the code holds now trips a sign that names cycles");
ok(/trips when: cycles > 0 \(2 now: it holds\)/.test(report(records("", measuredProject), at("2026-11-16"), { ...reads, found: { ...reads.found, entries: new Map([["cycle: x", true], ["cycle: y", true]]) } })),
  "the script prints each condition with the number it reads, and whether it holds");
putIn("docs/choices.md", sign("`fiels > 150`"));
const typo = signs({ manifest: "", root: measuredProject });
ok(/names what is no measure the look reads/.test(typo.body ?? "") && /`fiels > 150`/.test(typo.body) && /mended in a pull request/.test(typo.body) && !/fresh record/.test(typo.body),
  "a line \"Trips when:\" that names no measure keeps the issue open the day it stands, with its mend, so a typo is never a sign silently unread", typo.body);
putIn("docs/choices.md", sign("`cycles > 0`"));
putIn("checks/shape.json", "{");
ok(signs({ manifest: "", root: measuredProject }).body === null && /the shape check could not be read/.test(signs({ manifest: "", root: measuredProject }).unread ?? ""), "a config that cannot be read leaves the issue as it stands");
putIn("docs/choices.md", "## Choice: a\n- Reopens it: x.\n");
ok(signs({ manifest: "", root: measuredProject }).body === null && !signs({ manifest: "", root: measuredProject }).unread, "records that name no measure are not read against the shape check at all");
putIn("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["lib"] }));
putIn("docs/choices.md", sign("`files > 0`"));
ok(signs({ manifest: "", root: measuredProject }).body === null && /reads no file of code here/.test(signs({ manifest: "", root: measuredProject }).unread ?? ""),
  "where the shape check reads no file of code (a project in another language), a measure is said unread, never a sign that silently cannot trip");
fs.rmSync(measuredProject, { recursive: true, force: true });
const many = parse(Array.from({ length: 5000 }, (_, i) => `## Choice: c${i}\nTrips when: \`files > 1\`, \`nothing > 1\`\n`).join(""));
const long = trippedBody("docs/choices.md", tripped(many, reads), many, "core/");
ok(long.length < 20000 && long.split("\n").filter(l => l.startsWith("- `c")).length === 2 * LISTED && /- and 4970 more: `node core\/scripts\/choices\.mjs` lists them/.test(long),
  "however many a file holds, the issue lists a few of each and counts the rest, far under GitHub's limit on a body", `${long.length}`);
ok(DUE.includes(signs), "the scheduled look reads the signs too");
const ownSigns = signs({ manifest: null, root: path.join(here, "..") });
ok(!ownSigns.unread && ownSigns.body === null && parse(fs.readFileSync(path.join(here, "..", "CHOICES.md"), "utf8")).records.some(rec => rec.conditions.length) && parse(fs.readFileSync(path.join(here, "..", "CHOICES.md"), "utf8")).records.every(rec => !rec.unknown.length),
  "the core's own records name a measure the look reads, and none holds today", JSON.stringify(ownSigns));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
