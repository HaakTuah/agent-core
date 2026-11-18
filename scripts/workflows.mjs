// The workflow check (floor rule 2, floor/topics/workflows.md), for every project that takes the core, on every PR: it fails a
// workflow (.github/workflows/), or an action of the project's own (an action.yml anywhere in it, or any YAML file
// under .github/actions/), in which the word pull_request_target stands anywhere at all, a comment included. It searches the
// whole text for the word and reads no YAML for it, so no way of writing a key, a comment or a line break hides it; the two
// ways YAML has of spelling a word otherwise are undone first: an escape (\x, \u, \U) is read as what it spells, and
// a word broken over lines by an escaped line break is joined. A file the check cannot read as the project's own
// UTF-8 text fails too: a link (and any link in .github, where a linked folder would hold workflows the check never
// sees), and a file in another encoding, in which the word would stand unseen. A comment or a script that needs to
// speak of the trigger calls it something else.
// It fails, as well, a key given twice in one mapping of such a file (yaml-keys.mjs, beside this file), which GitHub's
// reader refuses, running none of the file's jobs, so that a pull request's check stands waiting with nothing to say
// why (#393). Nothing locks a project (AGENTS.md of the core): with WORKFLOWS_BASE set to the pull request's base (as
// the copies workflow sets it), a key twice that the base already held in the same file is noted and fails nothing;
// with no base, as on a push to main, each is noted; and the sync's step "16 November 2026, no workflow gives a key
// twice" (steps.mjs) names each old one at every sync until it is gone. In the core's own repository (`--core`) each fails.
// It fails, too, a call to one of the core's pull-request checks that is skipped on a draft while its pull_request
// trigger leaves out ready_for_review (floor rule 8, a weakened check; #375, #502): its job's if: names the draft, or the
// check skips a draft by itself (the description check, called on its own or by core.yml's `description:`). Once such a
// pull request is marked ready, the call runs on no head, and a ruleset counts the draft's skip as passed. As with a key
// twice, a call the base's same file already held so is noted, each is noted with no base, and the sync's step "16
// November 2026, checks once a pull request is ready" (steps.mjs, which reads it by draftHoles() below) names it.
// What it does not chase: a value given as binary (a YAML tag) holds a word no search can see, and a tag can itself be
// spelled in more ways than a search can follow. GitHub's own workflow reader refuses a binary value where a trigger
// belongs, so that is no way to write one; the reviews hold it, as they hold any odd tag in a workflow.
// The rest of rule 2 is held elsewhere: that every action is pinned to a full commit SHA by GitHub's own setting, which
// reads a workflow as GitHub runs it (README.md, "Setting up"); workflow_run, the fewest permissions and untrusted text
// in a script by the reviews, and by CodeQL where the repository has it. The copy of the core (core/) is checked in the
// core, which runs this on itself. Reads only; git and Node's own modules. It checks the project it lies in, whatever the
// directory it is started from. Run by the copies workflow (.github/workflows/copies.yml).
//
//   node core/scripts/workflows.mjs           from a project's root, as the copies workflow runs it
//   node scripts/workflows.mjs --core         in the core's own repository
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { logged } from "./guards.mjs";
import { started } from "./started.mjs";
import { twice } from "./yaml-keys.mjs";
import { projectAt } from "./core-path.mjs";
import { CORE } from "./core-address.mjs";
import { parseDocument } from "../third-party/yaml/dist/index.js";

const WORD = "pull_request_target";
const BREAK = "\\r\\n|[\\r\\n\\u0085\\u2028\\u2029]"; // every line break YAML 1.1 or 1.2 knows
// What is undone before the search, and what ends a line: an escaped line break with the blanks after it, an escape
// that spells a character, a line break.
const PIECES = new RegExp(`\\\\(?:${BREAK})[ \\t]*|\\\\(?:x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})|${BREAK}`, "gu");
const spelt = escape => { const code = parseInt(escape.slice(2), 16); return code <= 0x10ffff ? String.fromCodePoint(code) : escape; };

// The lines of one file's text on which the word stands, each as its number, once escapes are read as what they spell
// and words broken over lines are joined (a joined word counts for the line it ends on).
export function lines(text) {
  const out = [], starts = [[0, 1]]; // starts: where in the undone text each line of the file begins
  let length = 0, line = 1, i = 0;
  const add = piece => { out.push(piece); length += piece.length; };
  for (const m of text.matchAll(PIECES)) {
    add(text.slice(i, m.index));
    const piece = m[0];
    if (piece[0] !== "\\") add("\n");
    else if ("xuU".includes(piece[1])) add(spelt(piece));
    if (piece[0] !== "\\" || !"xuU".includes(piece[1])) starts.push([length, ++line]);
    i = m.index + piece.length;
  }
  add(text.slice(i));
  const undone = out.join(""), found = [];
  let s = 0;
  for (let at = undone.indexOf(WORD); at >= 0; at = undone.indexOf(WORD, at + 1)) {
    const end = at + WORD.length - 1;
    while (s + 1 < starts.length && starts[s + 1][0] <= end) s++;
    if (found.at(-1) !== starts[s][1]) found.push(starts[s][1]);
  }
  return found;
}

// Whether the text is one the search can trust: UTF-8 with no character that marks another encoding or bytes that are
// no text (a workflow in UTF-16 reads as letters with a zero byte between them, and the word is not found).
export const readable = text => !/[\0\ufffd]/u.test(text);

// The files the check reads, of those git tracks.
export const reads = files => files.filter(f => !f.startsWith("core/") && !f.split("/").includes("node_modules") &&
  (/^\.github\/(workflows\/[^/]+|actions\/.+)\.ya?ml$/iu.test(f) || /(^|\/)action\.ya?ml$/iu.test(f)));
// What may be no link, of those git tracks: what the check reads, and .github itself with everything in it.
export const unlinked = files => { const read = new Set(reads(files)); return files.filter(f => read.has(f) || /^\.github(\/|$)/iu.test(f)); };

// The keys given twice (yaml-keys.mjs) in files, each { file, text }, as { fails, notes }, each a line with its mend.
// `before` gives a file's text on the base (null where it held none), or is null where there is no base to read
// against: then each is a note. Of each key in each file, as many as the base held twice are noted, and the rest fail.
export function repeated(files, before) {
  const fails = [], notes = [];
  for (const { file, text } of files) {
    const held = new Map();
    for (const { key } of before ? twice(before(file) ?? "") : []) held.set(key, (held.get(key) ?? 0) + 1);
    for (const { line, key, first } of twice(text)) {
      const old = !before || held.get(key) > 0;
      held.set(key, (held.get(key) ?? 0) - 1);
      (old ? notes : fails).push(`${old ? "note" : "FAIL"} ${file}:${line}: the key ${JSON.stringify(key)} is given twice in one mapping (first on line ${first}), so GitHub refuses the whole file and runs none of its jobs${old ? (before ? ", as it did on the base" : "") : ""}. Mend: keep one of the two keys, with what both said in it (two if: conditions joined by &&, two env: mappings as one)`);
    }
  }
  return { fails, notes };
}

// The core's pull-request checks whose call may be skipped on a draft, and the two that skip a draft by themselves.
const CHECKS = /\/\.github\/workflows\/(core|copies|personal-terms|signatures|nuget|pr-description)\.yml@/i;
// The types a workflow's pull_request trigger lists, GitHub's own where it lists none or names the event alone (`on:
// pull_request`, `on: [push, pull_request]`), as []; null where it has no such trigger.
const typesOf = on => typeof on === "string" || Array.isArray(on) ? ([].concat(on).includes("pull_request") ? [] : null)
  : on && typeof on === "object" && "pull_request" in on ? [].concat(on.pull_request?.types ?? []).map(String) : null;
// A workflow's text read as YAML by the package the core carries (as yaml-keys.mjs reads it; flow mappings and every
// form GitHub reads), every scalar as text; null where it is no YAML, which GitHub's own reader refuses all the same.
function yamlOf(text) {
  try {
    const doc = parseDocument(String(text).replace(/^\ufeff/u, ""), { schema: "failsafe", uniqueKeys: false, prettyErrors: false });
    return doc.errors.length ? null : doc.toJS({ maxAliasCount: 100 });
  } catch { return null; }
}

// The jobs of a workflow (its YAML read, `yaml`, or its text) that call one of the core's pull-request checks skipped on a
// draft while the trigger never starts it once the pull request is marked ready: [] where none, or where the text is
// no YAML (GitHub's own reader then refuses it).
export function draftHoles(yaml) {
  if (typeof yaml === "string") yaml = yamlOf(yaml);
  const types = typesOf(yaml?.on);
  if (types === null || types.includes("ready_for_review")) return [];
  const prefix = `${CORE}/`.toLowerCase();
  return Object.entries(yaml.jobs ?? {}).filter(([, job]) => {
    const uses = typeof job?.uses === "string" ? job.uses.toLowerCase() : "";
    if (!uses.startsWith(prefix) || !CHECKS.test(uses)) return false;
    const skips = /\bpull_request\.draft\b/.test(String(job.if ?? ""));
    const itself = /\/pr-description\.yml@/.test(uses) || (/\/core\.yml@/.test(uses) && ![undefined, null, false, "false", ""].includes(job.with?.description));
    return skips || itself;
  }).map(([name]) => name);
}

// The calls draftHoles() finds in files, each { file, text }, as { fails, notes } (as repeated() gives them): `before`
// gives a file's text on the base, or is null where there is no base, when each is a note.
export function unreadied(files, before) {
  const fails = [], notes = [];
  for (const { file, text } of files) {
    const held = new Set(before ? draftHoles(before(file) ?? "") : []);
    for (const job of draftHoles(text)) {
      const old = !before || held.has(job);
      (old ? notes : fails).push(`${old ? "note" : "FAIL"} ${file}: its job ${JSON.stringify(job)} calls one of the core's checks that is skipped on a draft, and its pull_request trigger leaves out ready_for_review, so once a pull request is marked ready the check runs on no head and the draft's skip reads as passed${old && before ? ", as on the base" : ""}. Mend: add ready_for_review to the types: under pull_request: (where it lists none, types: [opened, reopened, synchronize, ready_for_review])`);
    }
  }
  return { fails, notes };
}

if (started(import.meta.url)) {
  const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
  process.chdir(fileURLToPath(new URL(".", import.meta.url)));
  process.chdir(projectAt(process.cwd()).root || git(["rev-parse", "--show-toplevel"]).trim()); // (a carried core's project too: core-path.mjs)
  const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean), files = reads(tracked);
  const core = process.argv.includes("--core"), base = core ? "" : process.env.WORKFLOWS_BASE ?? "";
  const show = file => { try { return git(["show", `${base}:${file}`]); } catch { return null; } };
  const links = new Set(unlinked(tracked).filter(f => fs.lstatSync(f, { throwIfNoEntry: false })?.isSymbolicLink()));
  let failed = links.size;
  const texts = [];
  for (const file of links) console.log(`FAIL ${logged(file)}: a link, not a file, and the check reads the project's own text only. Mend: put the file itself there in place of the link`);
  for (const file of files) {
    if (links.has(file)) continue;
    const text = fs.readFileSync(file, "utf8"), found = lines(text);
    texts.push({ file, text });
    if (!readable(text)) { failed++; console.log(`FAIL ${logged(file)}: not UTF-8 text, so it cannot be searched. Mend: save it as UTF-8`); }
    failed += found.length;
    for (const line of found.slice(0, 5)) console.log(`FAIL ${logged(file)}:${line}: ${WORD} runs a pull request with the repository's own token and secrets. Mend: take the word out, in a comment too, and trigger the workflow on pull_request, which runs one without them`);
    if (found.length > 5) console.log(`FAIL ${logged(file)}: and on ${found.length - 5} more lines. Mend: take the word out of each, as above`);
  }
  const against = core ? () => null : base ? show : null, keys = repeated(texts, against), ready = unreadied(texts, against);
  for (const line of [...keys.notes, ...ready.notes, ...keys.fails, ...ready.fails]) console.log(logged(line));
  failed += keys.fails.length + ready.fails.length;
  keys.notes.push(...ready.notes);
  console.log(`${failed ? "FAIL" : "ok  "} ${files.length} workflows and actions of the project's own read: ${failed} failing${keys.notes.length ? `, ${keys.notes.length} noted` : ""}${failed ? ". Mend: mend each line above as it says" : ""}`);
  process.exit(failed ? 1 : 0);
}
