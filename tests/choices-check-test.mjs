// Tests of the records' check a pull request runs (choices-check.mjs, with the script choices.mjs that runs it; #912): a
// record the change adds without the lines it is argued on, or without what the core cannot read in a choice of stack,
// fails; one that stood is listed, never failed; and what is read at the base, links included. git and Node's own
// modules.
//
//   node tests/choices-check-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LINK, argued, atCommit, baseRecords, checkOf } from "../scripts/choices-check.mjs";
import { ARGUED, UNREAD, parse } from "../scripts/choices-records.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const here = fileURLToPath(new URL("../scripts", import.meta.url)); // (the scripts this tests, beside the folder tests/)

// (whether a link can be made here, as on a system that holds none)
let link = true;
{ const d = scratchDir("choices-linkable-"); try { fs.symlinkSync("target", path.join(d, "link")); } catch { link = false; } fs.rmSync(d, { recursive: true, force: true }); }

// ---- argued on its lines (#515) ----
const full = "## Choice: full\n- Looked for: none found, in the registry and the web.\n- **The blind pick:** the same.\nThe judgment: it stands.\n- Reopens it: x.\n";
const half = "## Choice: half\n- The blind pick: another.\n- Looked for:\n- Reopens it: x.\n";
ok(parse(full).records[0].lacks.length === 0 && parse(half).records[0].lacks.join() === "Looked for:,The judgment:" && parse("## Choice: n\n").records[0].lacks.join() === ARGUED.join(),
  "a record is read for each line it is argued on, as a list item, bold or plain, and an empty line is none", JSON.stringify(parse(half).records));
const longHead = `## Choice: ${"the project's foundations, ".repeat(5)}judged again as if written today\n- The suggestion: #3\n`;
ok(parse(longHead).records[0].today && parse(longHead).records[0].name.length <= 120 && !parse("## Choice: judged again as if written today, not\n").records[0].today,
  "a heading past the printed length is still read whole for its ending, and one that does not end so is not");
const emptyBold = parse("## Choice: e\n- **Looked for:**\n- **The blind pick:**  \n- **The judgment:** *none found*\n- **The suggestion:** #4\n").records[0];
ok(emptyBold.lacks.join() === "Looked for:,The blind pick:" && emptyBold.suggestion === "#4", "a bold label with nothing after it is no line, and one with content is, its content opening with an asterisk too", JSON.stringify(emptyBold));
ok(parse("## Choice: q\nSee: The judgment: elsewhere.\n## Choice: r\nThe judgment: x\n").records[0].lacks.includes("The judgment:"), "a line is read only where it opens so, and under its own record");
const old = `## Choice: old\n- Reopens it: x.\n\n${full}`;
const both = argued(`${old}\n${half}`, old);
ok(both.failed.map(r => r.name).join() === "half" && both.listed.map(r => r.name).join() === "old", "a record the change adds that lacks a line fails; one that stood before is listed, never failed", JSON.stringify(both));
const made = "## Choice: made\n- Stood before: chosen at the start, in 2025.\n- Reopens it: x.\n";
ok(argued(`${old}\n${made}`, old).failed.length === 0 && argued(`${old}\n${made}`, old).listed.map(r => r.name).join() === "old,made", "a record of a choice already made is listed, never failed");
ok(argued(`${old}\n${half}`, null).failed.length === 2 && argued(full, null).failed.length === 0, "where the base held no records, each record is the change's own");
// the check from the command line, on a project's history
const hist = scratchDir("choices-argued-");
const h = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: hist, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const put = text => { fs.mkdirSync(path.join(hist, "docs"), { recursive: true }); fs.writeFileSync(path.join(hist, "docs/choices.md"), text); h("add", "-A"); h("commit", "-q", "-m", "records"); return h("rev-parse", "HEAD").trim(); };
h("init", "-q", "-b", "main");
fs.writeFileSync(path.join(hist, "README.md"), "# p\n"); h("add", "-A"); h("commit", "-q", "-m", "start");
const empty = h("rev-parse", "HEAD").trim();
const base = put(old);
const check = (b, cwd = hist) => { const r = spawnSync(process.execPath, [path.join(here, "choices.mjs")], { cwd, encoding: "utf8", env: { ...process.env, CHOICES_BASE: b } }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
let c = check(base);
ok(c.status === 0 && /listed, not failed: "old"/.test(c.out) && !/FAIL/.test(c.out), "the records as they stood pass, an old one lacking its lines listed", c.out);
put(`${old}\n${half}`);
c = check(base);
ok(c.status === 1 && /FAIL: `docs\/choices\.md`: the record "half", which this change adds, is argued on no line that opens "Looked for:", "The judgment:"/.test(c.out) && mended(c.out), "a record a change adds without its lines fails, saying its mend", c.out);
c = check(empty);
ok(c.status === 1 && (c.out.match(/^FAIL/gm) ?? []).length === 2, "a base with no records file: each record lacking a line is the change's own", c.out);
c = check("");
ok(c.status === 0 && /No base to compare with/.test(c.out) && /listed, not failed: "half"/.test(c.out), "with no base, as on a push to main, nothing fails and each is listed", c.out);
c = check("no-such-commit");
ok(c.status === 0 && /no-such-commit is no commit here/.test(c.out), "a base that is no commit here fails nothing of this check's (the copies part fails the base itself)", c.out);
ok(atCommit(base, "docs/choices.md", hist) === old && atCommit(empty, "docs/choices.md", hist) === null && atCommit("nowhere", "docs/choices.md", hist) === undefined && atCommit("--output=x", "docs/choices.md", hist) === undefined,
  "a file is read at a commit, as none where the commit lacks it, and as nothing where there is no such commit");
ok(checkOf({ file: "docs/choices.md", unread: "a link" }, base, hist)[1] === true && mended(checkOf({ file: "docs/choices.md", unread: "a link" }, base, hist)[0].join("\n"))
  && checkOf({ file: "docs/choices.md", unread: "a link" }, empty, hist)[1] === false && checkOf({ file: "docs/choices.md", text: null }, base, hist)[1] === false,
  "records the change makes unreadable fail, saying the mend; ones unreadable at the base as well, or none at all, fail nothing");
// records moved with the slot that names them, in one change: the base's records are read where the base's rules put them
fs.writeFileSync(path.join(hist, "core-manifest.md"), "| *choice records* | `docs/choices.md` |\n"); h("add", "-A"); h("commit", "-q", "-m", "a manifest");
const slotted = h("rev-parse", "HEAD").trim();
fs.renameSync(path.join(hist, "docs/choices.md"), path.join(hist, "records.md"));
fs.writeFileSync(path.join(hist, "core-manifest.md"), "| *choice records* | `records.md` |\n");
c = check(slotted);
ok(c.status === 0 && /listed, not failed: "old"/.test(c.out) && /listed, not failed: "half"/.test(c.out) && !/FAIL/.test(c.out), "records moved to the path the change names are read at the base where the base named them, and stay listed", c.out);
ok(baseRecords(slotted, hist) === `${old}\n${half}` && baseRecords(empty, hist) === null && baseRecords("nowhere", hist) === undefined, "the base's records are its own slot's, none where it held none, and nothing where there is no such commit");
// a records file that was a link at the base stays unread there, so nothing in it fails
fs.writeFileSync(path.join(hist, "target.md"), half); fs.rmSync(path.join(hist, "records.md")); fs.symlinkSync("target.md", path.join(hist, "records.md"));
h("add", "-A"); h("commit", "-q", "-m", "a link"); const linkedAt = h("rev-parse", "HEAD").trim();
ok(atCommit(linkedAt, "records.md", hist) === LINK && atCommit(linkedAt, "target.md", hist) === half && baseRecords(linkedAt, hist) === LINK, "a file that is a link at a commit is not read there, and reads as a link, apart from no commit, and a file is read (#541)");
const madeFile = checkOf({ file: "records.md", text: half }, linkedAt, hist);
ok(checkOf({ file: "records.md", unread: "a link" }, linkedAt, hist)[1] === false && madeFile[1] === false && /^The base held the records as a link, which is not read, so no record/.test(madeFile[0][0]) && !/no commit here/.test(madeFile[0].join("\n")) && /listed, not failed: "half"/.test(madeFile[0].join("\n")),
  "records that were a link at the base fail nothing, still a link or made a file, each listed, and the line says the base held a link", madeFile[0].join("\n"));
// the manifest a link at the base: where it put the records is not read, so they read as a link too
fs.renameSync(path.join(hist, "core-manifest.md"), path.join(hist, "manifest-target.md")); fs.symlinkSync("manifest-target.md", path.join(hist, "core-manifest.md"));
h("add", "-A"); h("commit", "-q", "-m", "a linked manifest"); const manifestLinked = h("rev-parse", "HEAD").trim();
ok(baseRecords(manifestLinked, hist) === LINK && /^The base held the records as a link/.test(checkOf({ file: "records.md", text: half }, manifestLinked, hist)[0][0]), "and so do records named by a manifest that was a link at the base");
fs.rmSync(hist, { recursive: true, force: true });
// the two cases a link must not reach (#541's review): an AGENTS.md that is a link, where no manifest names the records,
// still has them read at the kit's path, so an unargued record the change adds fails; and records under a folder that
// was a link at the base read as a link, so the records that stood there are listed, not failed
const repo = (files, links = {}) => {
  const dir = scratchDir("choices-link-");
  const g = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  g("init", "-q", "-b", "main");
  for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
  for (const [f, to] of Object.entries(links)) fs.symlinkSync(to, path.join(dir, f));
  g("add", "-A"); g("commit", "-q", "-m", "base");
  return { dir, at: g("rev-parse", "HEAD").trim() };
};
if (link) {
  const agents = repo({ "CLAUDE.md": "# rules\n", "docs/choices.md": old }, { "AGENTS.md": "CLAUDE.md" });
  const added = checkOf({ file: "docs/choices.md", text: `${old}\n${half}` }, agents.at, agents.dir);
  ok(baseRecords(agents.at, agents.dir) === old && added[1] === true && /FAIL: `docs\/choices\.md`: the record "half", which this change adds/.test(added[0].join("\n")),
    "an AGENTS.md that is a link at the base, with no manifest, leaves the records read at the kit's path, and an unargued record the change adds fails", added[0].join("\n"));
  const folder = repo({ "real/choices.md": old }, { docs: "real" });
  const moved = checkOf({ file: "docs/choices.md", text: old }, folder.at, folder.dir);
  ok(atCommit(folder.at, "docs/choices.md", folder.dir) === LINK && moved[1] === false && /^The base held the records as a link/.test(moved[0][0]) && /listed, not failed: "old"/.test(moved[0].join("\n")),
    "records under a folder that was a link at the base read as a link, and those that stood there are listed, not failed", moved[0].join("\n"));
  for (const r of [agents, folder]) fs.rmSync(r.dir, { recursive: true, force: true });
}

{
  // (in a history of its own, so the cases above keep theirs)
  const hist2 = scratchDir("choices-stack-");
  const h2 = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: hist2, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const put2 = text => { fs.mkdirSync(path.join(hist2, "docs"), { recursive: true }); fs.writeFileSync(path.join(hist2, "docs/choices.md"), text); h2("add", "-A"); h2("commit", "-q", "-m", "records"); return h2("rev-parse", "HEAD").trim(); };
  h2("init", "-q", "-b", "main");
  const base2 = put2(old);
  const check2 = b => check(b, hist2);
  // (a stack's record the change adds closes with what the core cannot read in it, each gap's issue named, or "none";
  // one that stood is no task; #486)
  const stack = full.replace(/^## Choice: [^\n]*/mu, "## Choice: the project's stack, Rust and Bevy");
  const fails = (text, why) => { put2(text); const r = check2(base2); ok(r.status === 1 && new RegExp(`a choice of stack this change adds, does not close with a line that opens "${UNREAD}" and names an issue or says "none"`).test(r.out) && mended(r.out), why, r.out); };
  const passes = (text, why) => { put2(text); const r = check2(base2); ok(r.status === 0, why, r.out); };
  fails(`${old}\n${stack}`, "a stack's record a change adds without what the core cannot read in it fails, saying its mend");
  fails(`${old}\n${stack}\n- ${UNREAD} the shape check and the copies check read no Rust yet.\n`, "and so does one whose line names no issue for its gaps");
  fails(`${old}\n${stack}\n- ${UNREAD} none.\n\nA last paragraph.\n`, "and one whose line is not its last");
  passes(`${old}\n${stack}\n- ${UNREAD} the shape check and the copies check read no Rust yet: ${CORE}#900, ${CORE}#901.\n`, "with its line naming each gap's issue, it passes");
  passes(`${old}\n${stack}\n- **${UNREAD}** https://github.com/${CORE}/issues/900\n`, "and so with an issue's address");
  passes(`${old}\n${stack}\n- ${UNREAD} "none".\n`, "and with \"none\" where the core reads the stack whole");
  const stood = `${old}\n${stack}`, stoodAt = put2(stood);
  put2(`${stood}\n`);
  ok(check2(stoodAt).status === 0 && argued(stood, stood).gapless.length === 0, "a stack's record that stood before is never failed for the line");
  ok(argued(`${old}\n${full}`, old).gapless.length === 0, "a record of another choice is asked nothing of the line");
  const recorded = `## Choice: the project's stack\n\nStood before: 2020-01-01\n`;
  ok(argued(recorded, "").gapless.length === 1, "a stack's record of a choice already made, as a first audit writes it, is asked the line all the same");
  fails(`${old}\n${recorded}`, "and the check fails it without the line, saying its mend");
  passes(`${old}\n${recorded}- ${UNREAD} none.\n`, "and passes it with the line");
  fs.rmSync(hist2, { recursive: true, force: true });
}

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
