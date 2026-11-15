// Tests of the records of the choices that are hard to undo (choices.mjs): where a project keeps them, what a record
// holds, when their pass is due, and the scheduled look's reader of it. Node's own modules only.
//
//   node scripts/choices-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DAYS, KIT, MOST, TITLE, due, look, parse, records, where } from "./choices.mjs";
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
ok(parse("## Choice: a\u0007b\n").records[0].name === "a b", "a name is printed with no control characters");
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

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
