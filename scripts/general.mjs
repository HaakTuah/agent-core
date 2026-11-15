// The core's rules fit any project ("Rules are written for any project" in AGENTS.md): fails the floor or a module that
// uses a word true only for some of the projects that take the core, such as one that assumes a game, its players or a
// live site. The words, with what to say instead, are its config's (scripts/general.json), which also names the files
// a word may stand in; a word a project finds untrue for it joins that list. One word is no part of the list: the login
// of the account the core is under (core-address.mjs), which the rules name only as the *owner's account*.
// A word may also name folders ("added") whose dated records it reads only where a change adds a line, against the
// commit --base names: there the owner is never "he" or "his" in new text, while older records stay as they were
// (core archive 201). A line quoted with ">", the owner's own words as the archive keeps them, is not read. Without
// --base those folders are not read, and it says so.
// The config's second list, "phrases", is the phrases a rule may not use ("A rule is written to one pattern" in
// AGENTS.md; core archive 214): read in the files and folders it names, it reports each one that stands there and fails
// one in a line a change adds against --base, a line moved word for word and one quoted with ">" aside. A phrase in
// code marks (`clean`) is named, not used, and is not read. Without --base it only reports, and says so.
// This repository only, run by size.yml with the base. Reads only; git and Node's own modules.
//
//   node scripts/general.mjs scripts/general.json [--base <commit>]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { OWNER } from "./core-address.mjs";

const args = process.argv.slice(2);
const at = args.indexOf("--base");
const baseRev = at >= 0 ? args[at + 1] : null;
// (a commit, never an option: git is asked whether it is one, and it stands after --end-of-options)
if (at >= 0 && (!/^[\w^~./][\w^~./-]*$/.test(baseRev ?? "") || (() => { try { execFileSync("git", ["rev-parse", "--verify", "--quiet", "--end-of-options", `${baseRev}^{commit}`], { stdio: "ignore" }); return false; } catch { return true; } })())) { console.log("--base needs a commit"); process.exit(1); }
const config = JSON.parse(fs.readFileSync(args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--base") ?? "scripts/general.json", "utf8"));
const account = { pattern: OWNER.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&"), say: "the *owner's account*, or the repository's own address" };
const words = [...config.words, account].map(w => ({ re: new RegExp(w.pattern, "iu"), say: w.say }));
const exempt = new Set(config.exempt);
if (!config.words.length) { console.log("the list of words is empty: the check would pass anything"); process.exit(1); }
const files = config.paths
  .flatMap(dir => fs.readdirSync(dir).filter(f => f.endsWith(".md")).map(f => path.posix.join(dir, f)))
  .filter(f => !exempt.has(f))
  .sort();
if (!files.length) { console.log("no file of the floor or the modules was read: the check would pass anything"); process.exit(1); }

// The lines a change adds under the given files and folders, against the base: each line a hunk of git's own diff
// adds, counted by the hunk's own header (so no added line is taken for a file's), by its file and line number; one the
// same diff takes away elsewhere word for word is left out, a record moved and not written anew (each line taken away
// excuses one line added, so a second copy of a moved line is read as new).
function addedLines(where) {
  const diff = execFileSync("git", ["diff", "--no-renames", "--no-ext-diff", "--no-textconv", "--text", "--no-color", "-U0", "--end-of-options", baseRev, "HEAD", "--", ...where], { encoding: "utf8", maxBuffer: 1 << 28 });
  const added = [], removed = new Map();
  let file = "", line = 0, plus = 0, minus = 0;
  for (const l of diff.split("\n")) {
    if (plus || minus) {
      if (l.startsWith("+") && plus) { added.push({ file, line: line++, text: l.slice(1) }); plus--; }
      else if (l.startsWith("-") && minus) { removed.set(l.slice(1), (removed.get(l.slice(1)) ?? 0) + 1); minus--; }
      continue;
    }
    const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (hunk) { minus = hunk[1] === undefined ? 1 : Number(hunk[1]); line = Number(hunk[2]); plus = hunk[3] === undefined ? 1 : Number(hunk[3]); continue; }
    if (l.startsWith("+++ ")) file = l.slice(4).replace(/^b\//, "");
  }
  return added.filter(a => { if (!removed.get(a.text)) return true; removed.set(a.text, removed.get(a.text) - 1); return false; });
}
const quoted = text => /^\s*>/.test(text);

let found = 0;
for (const file of files) {
  fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    for (const { re, say } of words) {
      const hit = line.match(re);
      if (hit) { found++; console.log(`${file}:${i + 1}: "${hit[0]}" fits only some projects; say ${say}`); }
    }
  });
}
console.log(`${files.length} files of the floor and the modules read for ${words.length} words: ${found} found`);

for (const w of config.words.filter(w => w.added?.length)) {
  if (!baseRev) { console.log(`no --base given: the lines added under ${w.added.join(", ")} were not read`); continue; }
  const re = new RegExp(w.pattern, "iu");
  const added = addedLines(w.added);
  for (const a of added) {
    const hit = quoted(a.text) ? null : a.text.match(re);
    if (hit) { found++; console.log(`${a.file}:${a.line}: "${hit[0]}" in a line this change adds; say ${w.say}`); }
  }
  console.log(`${added.length} lines added under ${w.added.join(", ")} since ${baseRev} read for "${w.pattern}"`);
}

// the phrases a rule may not use: each that stands reported, each in a line this change adds failed
const { paths: phrasePaths = [], list: phraseList = [] } = config.phrases ?? {};
if (!phraseList.length) { console.log("the list of phrases a rule may not use is empty: the check would pass anything"); process.exit(1); }
const phrases = phraseList.map(p => ({ re: new RegExp(p.pattern, "iu"), say: p.say }));
const used = text => quoted(text) ? [] : phrases.map(p => ({ ...p, hit: text.replace(/`[^`]*`/gu, "").match(p.re) })).filter(p => p.hit);
const absent = phrasePaths.filter(p => !fs.existsSync(p));
if (absent.length) { console.log(`the phrases' files and folders are not there: ${absent.join(", ")}`); process.exit(1); }
const ruleFiles = phrasePaths.flatMap(p => fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter(f => f.endsWith(".md")).map(f => path.posix.join(p, f)) : [p]).sort();
if (!ruleFiles.length) { console.log("no rule file was read for the phrases: the check would pass anything"); process.exit(1); }
const fresh = new Set();
let failedPhrases = 0, reported = 0;
if (baseRev) {
  for (const a of addedLines(phrasePaths)) {
    fresh.add(`${a.file}:${a.line}`);
    for (const { hit, say } of used(a.text)) { failedPhrases++; console.log(`${a.file}:${a.line}: "${hit[0]}" in a rule this change writes; ${say} (AGENTS.md, "A rule is written to one pattern")`); }
  }
} else console.log("no --base given: the phrases are only reported, none failed");
for (const file of ruleFiles) {
  fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (fresh.has(`${file}:${i + 1}`)) return;
    for (const { hit, say } of used(line)) { reported++; console.log(`${file}:${i + 1}: "${hit[0]}" reported, standing before this change; ${say} (the audit brings it to the pattern, #259)`); }
  });
}
console.log(`${ruleFiles.length} rule files read for ${phrases.length} phrases a rule may not use: ${failedPhrases} in what this change writes, ${reported} standing`);
found += failedPhrases;
process.exit(found ? 1 : 0);
