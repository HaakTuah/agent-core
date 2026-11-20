// Tests of the records that stand in a folder, a file each (choices.mjs; #870): how they are read at the head and at the
// base, and the form the core's own hold. git and Node's own modules.
//
//   node tests/choices-folder-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LINK, MOST, PART, POINTER, baseRecords, checkOf, folderFaults, look, parse, records, wholeOf } from "../scripts/choices.mjs";
import { mended } from "../scripts/mend.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const here = fileURLToPath(new URL("../scripts", import.meta.url)); // (the scripts this tests, beside the folder tests/)
const at = day => `${day}T12:00:00Z`;
let link = true;
{ const t = fs.mkdtempSync(path.join(os.tmpdir(), "choices-ln-")); try { fs.writeFileSync(path.join(t, "a"), ""); fs.symlinkSync("a", path.join(t, "b")); } catch { link = false; } fs.rmSync(t, { recursive: true, force: true }); }

// ---- records that stand in a folder, a file each (#870) ----
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "choices-folder-"));
  const g = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const write = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
  const pointer = "Its records stand in `choices/`, a file each, read in the order of their names.";
  const rec = (name, lines = true) => `## Choice: ${name}\n\n- Reopens it: a test takes over a minute.\n${lines ? "- Looked for: z.\n- The blind pick: y.\n- The judgment: x.\n" : ""}`;
  const head = "# Choices\n\nRead whole: 2026-11-15\n\n";
  const rules = "the *choice records*: `CHOICES.md`;";
  const whole = `${head}${rec("a")}\n${rec("b")}\n${rec("c", false)}`;
  write("CHOICES.md", `${head}${pointer}\n`);
  write("choices/020-b.md", rec("b")); write("choices/010-a.md", rec("a")); write("choices/030-c.md", rec("c", false).replace(/\n/gu, "\r\n")); write("choices/040-note.txt", "## Choice: no\n");
  ok(POINTER.test(pointer) && !POINTER.test(`${pointer} `) && !POINTER.test("Its records stand in `../x/`, a file each, read in the order of their names.") && !POINTER.test("Its records stand in `/x/`, a file each, read in the order of their names."),
    "the line that names the folder is read exactly, and only for a plain path inside the project");
  ok(wholeOf(`${head}${pointer}\n`, () => ["x", "y"]) === `${head}x\n\ny\n` && wholeOf("no pointer\n", () => ["x"]) === "no pointer\n", "a line that names a folder is replaced by its records, a blank line between");
  const got = records(rules, dir);
  ok(got.text.replace(/\r/gu, "") === whole, "the records are read in the order of the files' names, a file of another kind left out", JSON.stringify(got));
  ok(parse(got.text).records.map(r => r.name).join() === "a,b,c" && parse(got.text).read === "2026-11-15", "and parsed as the one text they make");
  ok(/`CHOICES\.md` holds 3 records/.test(look({ manifest: null, at: at("2027-06-01"), root: (write("AGENTS.md", rules), dir) }).body ?? ""), "the scheduled look reads them");
  // the form that holds them
  ok(folderFaults("CHOICES.md", dir).length === 1 && /040-note\.txt` is no file of a record/.test(folderFaults("CHOICES.md", dir)[0]), "a file of the folder that is no record's, though never read as one, fails");
  fs.rmSync(path.join(dir, "choices/040-note.txt"));
  ok(folderFaults("CHOICES.md", dir).length === 0, "a file that names the folder, holding no record itself, over files named NNN-<name>.md each of a record, has no fault");
  write("CHOICES.md", `${head}${pointer}\n\n${rec("d")}`);
  const inPlace = folderFaults("CHOICES.md", dir).join("\n");
  ok(/holds the record "d" itself/.test(inPlace) && mended(inPlace), "a record written in the file itself fails, saying where it goes");
  write("CHOICES.md", `${head}${pointer}\n`); write("choices/050-two.md", `${rec("e")}\n${rec("f")}`); write("choices/Notes.md", "x\n"); fs.mkdirSync(path.join(dir, "choices/sub"));
  const faults = folderFaults("CHOICES.md", dir);
  ok(faults.length === 3 && faults.every(f => mended(f)) && /Notes\.md` is no file of a record named/.test(faults.join()) && /sub` is no file/.test(faults.join()) && /050-two\.md` holds 2 records/.test(faults.join()),
    "a file of a folder not named so, a folder inside it and a file of two records each fail, saying the mend", faults.join("\n"));
  write("choices/060-big.md", `${rec("g")}${"x".repeat(MOST)}\n`);
  ok(/060-big\.md` takes/.test(folderFaults("CHOICES.md", dir).join()) && mended(folderFaults("CHOICES.md", dir).join("\n")), "a file of the folder past the size the readers read fails, saying the mend");
  fs.rmSync(path.join(dir, "choices/060-big.md"));
  if (link) {
    fs.renameSync(path.join(dir, "choices"), path.join(dir, "choices-real")); fs.symlinkSync("choices-real", path.join(dir, "choices"));
    ok(/is no folder here/.test(folderFaults("CHOICES.md", dir).join()), "a folder that is a link is no folder of the records, and is not read");
    fs.rmSync(path.join(dir, "choices")); fs.renameSync(path.join(dir, "choices-real"), path.join(dir, "choices"));
  }
  ok(PART.test("010-a.md") && !PART.test("10-a.md") && !PART.test("010-A.md"), "a part's name is three digits, a dash and a name of lower case");
  write("CHOICES.md", `${head}${pointer.replace("choices", "elsewhere")}\n`);
  ok(mended(folderFaults("CHOICES.md", dir).join("\n")) && folderFaults("CHOICES.md", dir).length === 1, "a folder the file names that is not there fails, saying the mend");
  write("CHOICES.md", whole);
  ok(folderFaults("CHOICES.md", dir).length === 0, "a records file that names no folder, as a project's stands, is asked nothing");
  fs.rmSync(path.join(dir, "choices/050-two.md")); fs.rmSync(path.join(dir, "choices/Notes.md")); fs.rmSync(path.join(dir, "choices/sub"), { recursive: true });
  // a folder named twice is one folder, an overflow is said once, and a folder that cannot be listed is worded as that (#992)
  write("CHOICES.md", `${head}${pointer}\n\n${pointer}\n`); write("choices/060-half.md", `${rec("g")}${"x".repeat(Math.floor(MOST * 0.6))}\n`);
  ok(folderFaults("CHOICES.md", dir).length === 0, "a folder two lines of the file name is counted once against the size the readers read", folderFaults("CHOICES.md", dir).join("\n"));
  write("CHOICES.md", `${head}${pointer}\n`); fs.rmSync(path.join(dir, "choices/060-half.md"));
  write("choices/060-big.md", `${rec("g")}${"x".repeat(MOST)}\n`); write("choices/070-big.md", `${rec("h")}${"x".repeat(MOST)}\n`);
  ok(folderFaults("CHOICES.md", dir).length === 1 && /060-big\.md` takes/.test(folderFaults("CHOICES.md", dir)[0]), "a size past what the readers read is one fault, not one for each later file");
  fs.rmSync(path.join(dir, "choices/060-big.md")); fs.rmSync(path.join(dir, "choices/070-big.md"));
  const listDir = fs.readdirSync;
  fs.readdirSync = (p, ...rest) => { if (String(p).endsWith("choices")) throw Object.assign(new Error("EACCES"), { code: "EACCES" }); return listDir(p, ...rest); };
  const unlisted = (() => { try { return folderFaults("CHOICES.md", dir); } finally { fs.readdirSync = listDir; } })();
  ok(unlisted.length === 1 && /cannot be listed/.test(unlisted[0]) && !/is no folder here/.test(unlisted[0]) && !/make the folder/.test(unlisted[0]) && mended(unlisted[0]), "a folder that is there and cannot be listed is said so, with its own mend", unlisted.join("\n"));
  // the folder at the base: a change that moves the records into it reads what stood in the file, and one that adds to it is checked as an addition
  g("init", "-q", "-b", "main"); write("CHOICES.md", whole); fs.rmSync(path.join(dir, "choices"), { recursive: true }); write("AGENTS.md", rules); g("add", "-A"); g("commit", "-q", "-m", "whole");
  const whole0 = g("rev-parse", "HEAD").trim();
  write("CHOICES.md", `${head}${pointer}\n`); write("choices/010-a.md", rec("a")); write("choices/020-b.md", rec("b")); write("choices/030-c.md", rec("c", false)); g("add", "-A"); g("commit", "-q", "-m", "split");
  const split0 = g("rev-parse", "HEAD").trim();
  const text0 = baseRecords(split0, dir);
  ok(text0 === `${head}${rec("a").replace(/\n$/u, "")}\n\n${rec("b").replace(/\n$/u, "")}\n\n${rec("c", false).replace(/\n$/u, "")}\n` && parse(text0).records.length === 3 && baseRecords(whole0, dir) === whole, "the base's records are read with its folder in their place, and a base that held them whole as they stood");
  ok(JSON.stringify(parse(records(rules, dir).text)) === JSON.stringify(parse(baseRecords(whole0, dir))), "records read whole before the split and from the folder after parse alike");
  const addedAt = (name, text) => { write(`choices/${name}`, text); const r = checkOf(records(rules, dir), split0, dir); fs.rmSync(path.join(dir, `choices/${name}`)); return r; };
  let r = addedAt("040-d.md", rec("d", false));
  ok(r[1] === true && /the record "d", which this change adds, is argued on no line/.test(r[0].join("\n")) && mended(r[0].join("\n")) && /listed, not failed: "c"/.test(r[0].join("\n")), "a record file a change adds without its lines fails, saying the mend, and one that stood is listed", r[0].join("\n"));
  ok(addedAt("040-d.md", rec("d"))[1] === false && checkOf(records(rules, dir), whole0, dir)[1] === false, "one argued in full passes, and so do the records moved into the folder from the file they stood in");
  // the command, as the copies check runs it, on the base as it stood
  const cmd = spawnSync(process.execPath, [path.join(here, "choices.mjs")], { cwd: dir, encoding: "utf8", env: { ...process.env, CHOICES_BASE: whole0 } });
  ok(cmd.status === 0 && /3 records|listed, not failed: "c"/.test(cmd.stdout), "the command reads the folder at the head and the file at the base", cmd.stdout + cmd.stderr);
  // the folder gone while its line stays, a second line naming the same folder, a base too large to read: each safe
  fs.renameSync(path.join(dir, "choices"), path.join(dir, "choices-away"));
  const gone = records(rules, dir);
  ok(/no plain folder, or could not be read/.test(gone.unread ?? "") && !("text" in gone), "a folder the file names that is not there reads as unreadable, never as no records", JSON.stringify(gone));
  fs.renameSync(path.join(dir, "choices-away"), path.join(dir, "choices"));
  write("CHOICES.md", `${head}${pointer}\n${pointer}\n`);
  ok(parse(records(rules, dir).text).records.map(x => x.name).join() === "a,b,c", "a second line naming the same folder reads its records once");
  write("choices/900-big.md", `${rec("big")}${"x".repeat(MOST)}\n`);
  ok(/is past/.test(records(rules, dir).unread ?? ""), "a folder whose records pass the size limit reads as unreadable");
  fs.rmSync(path.join(dir, "choices/900-big.md"));
  write("CHOICES.md", `${head}${pointer}\n`);
  g("add", "-A"); write("choices/900-big.md", `${rec("big")}${"x".repeat(MOST)}\n`); g("add", "-A"); g("commit", "-q", "-m", "a large record");
  const bigAt = g("rev-parse", "HEAD").trim();
  fs.rmSync(path.join(dir, "choices/900-big.md")); g("add", "-A"); g("commit", "-q", "-m", "without it");
  const dropped = checkOf(records(rules, dir), bigAt, dir);
  ok(baseRecords(bigAt, dir) === LINK && dropped[1] === false && /listed, not failed: "c"/.test(dropped[0].join("\n")), "a base whose records are too large to read lists the records and fails none, as for a link", dropped[0].join("\n"));
  // a folder that was a link at the base is not read there; one that is a link here is unreadable
  if (link) {
    fs.rmSync(path.join(dir, "choices"), { recursive: true }); write("elsewhere/010-a.md", rec("a")); fs.symlinkSync("elsewhere", path.join(dir, "choices")); g("add", "-A"); g("commit", "-q", "-m", "a linked folder");
    ok(baseRecords(g("rev-parse", "HEAD").trim(), dir) === LINK && /no plain folder/.test(records(rules, dir).unread ?? ""), "a folder that is a link is read neither at the base nor here");
  }
  fs.rmSync(dir, { recursive: true, force: true });
}
// the core's own records: the form holds, and the folder is read in the order of its files' names as the file stood before
ok(folderFaults("CHOICES.md", path.join(here, "..")).length === 0 && parse(records(fs.readFileSync(path.join(here, "..", "AGENTS.md"), "utf8"), path.join(here, "..")).text ?? "").records.length > 0,
  `the core's records stand in a file each, none in CHOICES.md itself${folderFaults("CHOICES.md", path.join(here, "..")).map(f => `\n     ${f}`).join("")}`);
console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
