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
// A text longer than LONGEST (yaml-keys.mjs) is never given to the parser, so a base that long lists nothing it held:
// such a file unchanged is noted, and one a pull request changes is judged as new, failing where it is still that long
// and for each breach it shows once cut under it (baseOf() below; #752).
// It fails, too, a call to one of the core's pull-request checks that is skipped on a draft while its pull_request
// trigger leaves out ready_for_review (floor rule 8, a weakened check; #375, #502): its job's if: names the draft, or the
// check skips a draft by itself (the description check, called on its own or by core.yml's `description:`). Once such a
// pull request is marked ready, the call runs on no head, and a ruleset counts the draft's skip as passed. As with a key
// twice, a call the base's same file already held so is noted, each is noted with no base, and the sync's step "16
// November 2026, checks once a pull request is ready" (steps.mjs, which reads it by draftHoles() below) names it.
// And a line break that YAML 1.1 reads and the YAML package does not (U+0085, U+2028, U+2029: #872): a key given twice,
// or a call left without ready_for_review, placed after one is not found by the package's reader, while a YAML 1.1
// reader (YamlDotNet) reads it as a line end, so such a file fails where it is new or changed, and is noted where it is
// unchanged from the base or no base is told, as a key given twice is (foreignBreaks() below), and the sync's step "20
// November 2026, no workflow holds a line break the YAML package does not read" (steps.mjs) names each file with one.
// What stands behind such a break is read as a YAML 1.1 reader reads it, in the file and in the base alike: each of the
// three is read as an LF for the keys and the calls, so a key given twice or a call left without ready_for_review
// behind one is found, noted where the base held it, and told on the line an editor counts (keysTwice() below; #876).
// What it does not chase: a value given as binary (a YAML tag) holds a word no search can see, and a tag can itself be
// spelled in more ways than a search can follow. GitHub's own workflow reader refuses a binary value where a trigger
// belongs, so that is no way to write one; the reviews hold it, as they hold any odd tag in a workflow.
// The rest of rule 2 is held elsewhere: that every action is pinned to a full commit SHA by GitHub's own setting, which
// reads a workflow as GitHub runs it (README.md, "Setting up"); workflow_run, the fewest permissions and untrusted text
// in a script by the reviews, and by CodeQL where the repository has it. The copy of the core (core/) is checked in the
// core, which runs this on itself. Reads only; git, Node's own modules and the YAML package the core installs
// (packages.mjs). It checks the project it lies in, whatever the directory it is started from. Run by the copies workflow
// (.github/workflows/copies.yml).
//
//   node core/scripts/workflows.mjs           from a project's root, as the copies workflow runs it
//   node scripts/workflows.mjs --core         in the core's own repository
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { logged } from "./guards.mjs";
import { started } from "./started.mjs";
import { DEEPEST, LONGEST, pruned, twice } from "./yaml-keys.mjs";
import { loadSync, unreached } from "./packages.mjs";
import { projectAt } from "./core-path.mjs";
import { CORE } from "./core-address.mjs";

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

// The first line break of YAML 1.1 beyond LF, CR and CRLF in a text (U+0085, U+2028, U+2029), the YAML package not
// reading it as one: { line, code, count } with the line as an editor counts it (by LF), the character's code and how
// many there are in all; null where there is none (#872).
export function foreignBreaks(text) {
  let line = 1, first = null, count = 0;
  for (const m of String(text).matchAll(/\n|[\u0085\u2028\u2029]/gu)) {
    if (m[0] === "\n") { line++; continue; }
    count++;
    first ??= { line, code: `U+${m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}` };
  }
  return first && { ...first, count };
}

// A text as a YAML 1.1 reader reads it: each of the three breaks an LF, as { text, line }, with `line` telling a line of
// that text as the line an editor counts, which the three do not end (#876). A text with none is itself.
export function asLF(text) {
  text = String(text);
  if (!/[\u0085\u2028\u2029]/u.test(text)) return { text, line: n => n };
  const at = [0, 1];
  let editor = 1;
  for (const m of text.matchAll(/\r\n?|\n|[\u0085\u2028\u2029]/gu)) { if (!/^[\u0085\u2028\u2029]$/u.test(m[0])) editor++; at.push(editor); }
  return { text: text.replace(/[\u0085\u2028\u2029]/gu, "\n"), line: n => at[n] ?? n };
}

// The keys given twice in a text (yaml-keys.mjs, twice()) read as a YAML 1.1 reader reads its line breaks, each on the line an
// editor counts (#876).
export function keysTwice(text) {
  const { text: folded, line } = asLF(text);
  return twice(folded).map(found => ({ ...found, line: line(found.line), first: found.first === null ? null : line(found.first) }));
}

// The files, each { file, text }, that hold such a break, as { fails, notes } (as repeated() gives them): `before` gives
// a file's text on the base, or is null where there is no base, when each is a note; a file the same as the base's is
// noted, one changed or new fails, since a count cannot show a change made nothing worse (#752).
export function foreignBroken(files, before) {
  const fails = [], notes = [];
  for (const { file, text } of files) {
    const found = foreignBreaks(text);
    if (!found) continue;
    const old = !before || before(file) === text;
    (old ? notes : fails).push(`${old ? "note" : "FAIL"} ${file}:${found.line}: the file holds the line break ${found.code}${found.count > 1 ? ` and ${found.count - 1} more` : ""}, which YAML 1.1 reads as a line end and the YAML package does not, so a reader of one kind sees the file otherwise than a reader of the other${old && before ? ", as on the base" : ""}. Mend: replace each with an ordinary line feed, or, inside a double-quoted string, with the escape of its own code (\\u0085, \\u2028 or \\u2029)`);
  }
  return { fails, notes };
}

// The files the check reads, of those git tracks.
export const reads = files => files.filter(f => !f.startsWith("core/") && !f.split("/").includes("node_modules") &&
  (/^\.github\/(workflows\/[^/]+|actions\/.+)\.ya?ml$/iu.test(f) || /(^|\/)action\.ya?ml$/iu.test(f)));
// What may be no link, of those git tracks: what the check reads, and .github itself with everything in it.
export const unlinked = files => { const read = new Set(reads(files)); return files.filter(f => read.has(f) || /^\.github(\/|$)/iu.test(f)); };

// What a file past the depth or the length read is said to hold unseen, and its mend.
const NOT_READ = [ // (by `size`: 0 for a part nested too deep, 1 for a text too long)
  { said: `the file nests its lists or mappings more than ${DEEPEST} deep, past what this check reads, so a key given twice in that part would go unseen`, mend: "nest it no deeper than a workflow needs, a few levels" },
  { said: `the file is longer than ${LONGEST} characters, past what this check reads, so a key given twice in it would go unseen`, mend: `cut the file to under ${LONGEST} characters, the steps it repeats moved to a script or a workflow of their own` },
];

// What the base's own entry is counted as: a key by its name, a part not read by its reason, so that a file nested too
// deep on the base does not hold the entry of one that has grown too long (#752).
const heldAs = ({ key, size }) => (key === null ? (size ? 1 : 0) : `k:${key}`);

// A file's text on the base, for what the base held (#752): `read`, the text the readers take, where the base's text is
// within the length read ("" where the base holds no such file); `same` where the base's text is past the length read
// and the file's is that text unchanged. A text past the length read is never given to the parser, and no count of its
// words can show that a change to it made nothing worse, so its breaches cannot be listed: a file unchanged from such a
// base is only noted, and a file changed from it is judged as one the base did not hold, each breach it shows failing,
// and the file itself where it is still past the length, the mend being to cut it under the length and mend what it
// then shows, in that pull request.
const baseOf = (before, file, text) => {
  const was = before ? before(file) ?? "" : null, long = was !== null && was.length > LONGEST;
  return { read: was === null || long ? null : was, same: long && was === text };
};

// The keys given twice (yaml-keys.mjs) in files, each { file, text }, as { fails, notes }, each a line with its mend.
// `before` gives a file's text on the base (null where it held none), or is null where there is no base to read
// against: then each is a note. Of each key in each file, as many as the base held twice are noted, and the rest fail.
export function repeated(files, before) {
  const fails = [], notes = [];
  for (const { file, text } of files) {
    const held = new Map(), base = baseOf(before, file, text);
    for (const found of base.read === null ? [] : keysTwice(base.read)) held.set(heldAs(found), (held.get(heldAs(found)) ?? 0) + 1);
    for (const { line, key, first, size } of keysTwice(text)) {
      const id = heldAs({ key, size }), old = !before || base.same || held.get(id) > 0;
      held.set(id, (held.get(id) ?? 0) - 1);
      const was = old ? (before ? ", as it did on the base" : "") : "";
      (old ? notes : fails).push(key === null
        ? `${old ? "note" : "FAIL"} ${file}:${line}: ${NOT_READ[+Boolean(size)].said}${was}. Mend: ${NOT_READ[+Boolean(size)].mend}`
        : `${old ? "note" : "FAIL"} ${file}:${line}: the key ${JSON.stringify(key)} is given twice in one mapping (first on line ${first}), so GitHub refuses the whole file and runs none of its jobs${was}. Mend: keep one of the two keys, with what both said in it (two if: conditions joined by &&, two env: mappings as one)`);
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
// A workflow's text read as YAML by the package the core installs (as yaml-keys.mjs reads it, its tokens pruned past
// DEEPEST alike; flow mappings and every form GitHub reads), every scalar as text; null where it is no YAML, which
// GitHub's own reader refuses all the same. A pair whose key is a list or a mapping is left out before the read, since
// `toJS` writes such a key out as text, which takes ever longer the deeper it nests (a few hundred `? ` marks ran for
// minutes: #837), and the keys read here are plain words.
function yamlOf(text) {
  const { Composer, Parser, isScalar, visit } = loadSync("yaml");
  try {
    const composer = new Composer({ schema: "failsafe", uniqueKeys: false, prettyErrors: false }), docs = [];
    for (const token of new Parser().parse(String(text).replace(/^\ufeff/u, ""))) {
      const one = [token];
      pruned(one);
      docs.push(...composer.next(one[0]));
    }
    docs.push(...composer.end());
    if (docs.length !== 1 || docs[0].errors.length) return null;
    visit(docs[0], { Pair: (_, pair) => (isScalar(pair.key) ? undefined : visit.REMOVE) });
    return docs[0].toJS({ maxAliasCount: 100 });
  } catch { return null; }
}

// The jobs of a workflow (its YAML read, `yaml`, or its text) that call one of the core's pull-request checks skipped on a
// draft while the trigger never starts it once the pull request is marked ready: [] where none, or where the text is
// no YAML (GitHub's own reader then refuses it).
export function draftHoles(yaml) {
  if (typeof yaml === "string") yaml = yaml.length > LONGEST ? null : yamlOf(asLF(yaml).text); // (a text past the length read is not given to the parser: #752; its breaks as a YAML 1.1 reader reads them: #876)
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
    // (a text past the length read cannot be read for this: one that differs from the base fails, since a call may have
    // lost ready_for_review behind the length; one unchanged, or read with no base, is noted by repeated(): #752)
    const base = baseOf(before, file, text);
    if (text.length > LONGEST) {
      if (before && !base.same) fails.push(`FAIL ${file}: the file is longer than ${LONGEST} characters and differs from the base, so this check cannot tell whether a call of one of the core's checks that is skipped on a draft has ready_for_review among its types. Mend: cut the file to under ${LONGEST} characters, the steps it repeats moved to a script or a workflow of their own, and mend what this check then says of it`);
      continue;
    }
    const held = new Set(base.read === null ? [] : draftHoles(base.read));
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
  // (both texts with their line ends as "\n": git may convert them on checkout, so the working tree's file and the base's
  // blob of one text must read as equal and as one length, #752)
  const plain = text => text.replace(/\r\n?/gu, "\n");
  const show = file => { try { return plain(git(["show", `${base}:${file}`])); } catch { return null; } };
  const links = new Set(unlinked(tracked).filter(f => fs.lstatSync(f, { throwIfNoEntry: false })?.isSymbolicLink()));
  let failed = links.size;
  const texts = [];
  for (const file of links) console.log(`FAIL ${logged(file)}: a link, not a file, and the check reads the project's own text only. Mend: put the file itself there in place of the link`);
  for (const file of files) {
    if (links.has(file)) continue;
    const raw = fs.readFileSync(file, "utf8"), found = lines(raw);
    const text = plain(raw);
    texts.push({ file, text });
    if (!readable(text)) { failed++; console.log(`FAIL ${logged(file)}: not UTF-8 text, so it cannot be searched. Mend: save it as UTF-8`); }
    failed += found.length;
    for (const line of found.slice(0, 5)) console.log(`FAIL ${logged(file)}:${line}: ${WORD} runs a pull request with the repository's own token and secrets. Mend: take the word out, in a comment too, and trigger the workflow on pull_request, which runs one without them`);
    if (found.length > 5) console.log(`FAIL ${logged(file)}: and on ${found.length - 5} more lines. Mend: take the word out of each, as above`);
  }
  // (where the job's install could not reach the registry, in a project's pull request, the keys given twice and the
  // calls a draft skips, which the YAML package reads, did not run, said as a warning; every failure above still fails:
  // #654, point 4)
  const skipped = unreached("yaml");
  if (skipped) console.log("::warning::The check for a key given twice did not run, nor the one for a call a draft skips: the package yaml could not be installed, the registry not answering. Mend: run this job again before the pull request merges; if it fails again, file it as a fault");
  const against = core ? () => null : base ? show : null;
  const keys = skipped ? { fails: [], notes: [] } : repeated(texts, against), ready = skipped ? { fails: [], notes: [] } : unreadied(texts, against);
  const odd = foreignBroken(texts, against); // (no package is read for it, so it runs where the install did not)
  for (const line of [...keys.notes, ...ready.notes, ...odd.notes, ...keys.fails, ...ready.fails, ...odd.fails]) console.log(logged(line));
  failed += keys.fails.length + ready.fails.length + odd.fails.length;
  keys.notes.push(...ready.notes, ...odd.notes);
  console.log(`${failed ? "FAIL" : "ok  "} ${files.length} workflows and actions of the project's own read: ${failed} failing${keys.notes.length ? `, ${keys.notes.length} noted` : ""}${failed ? ". Mend: mend each line above as it says" : ""}`);
  process.exit(failed ? 1 : 0);
}
