// Is this pull request's change to what runs by itself only comments and steps' names (floor rule 3)? Such a change
// passes one security review, floor rule 8's, instead of rule 3's two. Its builder runs it from a checkout of the core's
// `main`, never from the pull request's own copy, which the pull request could change, in the pull request's clone with
// its head checked out:
//
//   node <the core's main>/scripts/comment-only.mjs [<a commit already reviewed>]
//
// It reads the head commit, not the working tree, against the merge base with the project's main (fetched), or against
// the commit given, for a later commit reviewed only for what it changes (floor rule 8). It passes only where every file
// it changes under .github/ or .claude/ (any case, at any depth) is a YAML file changed in place, its mode kept, whose
// two versions differ only in YAML comments, blank lines between entries, and the `name` of a job's steps (the first key
// of an item under `jobs.<job>.steps`, holding no `${{`, so nothing is evaluated); comments read by a check (the words
// and personal-terms checks read them too) still meet that check. It reads YAML as GitHub's parser does where it reads
// it at all, and refuses, rather than guess, every line it cannot read for sure: a tab, a carriage return or another
// control character or line break; a value that runs on to the next line (a quoted or plain one, or one in [ ] or { });
// a quote or # inside [ ] or { }; an anchor, alias, tag, explicit key or document marker. A line inside a block scalar
// (`run: |`) is text, a # line too, and changes nothing only where it is unchanged. What it does not hold: that no other
// file the pull request changes runs by itself or with credentials (the cloud setup script, a file of the credentialed
// GitHub calls), which the files it lists as changed outside .github/ and .claude/ let the session check; and the
// security review itself, which still runs. It prints the head it checked, for the "Security review:" comment
// (modules/reviews.md, point 3). Git and Node's own modules only; it changes nothing.
import { execFileSync } from "node:child_process";
import { started } from "./started.mjs";

const RUNS = /(?:^|\/)\.(?:github|claude)\//iu; // what runs by itself, as far as this proof reads it
const YAML = /\.ya?ml$/iu;
// what YAML 1.1 or 1.2 reads as a line break besides \n, a tab, a byte order mark, and every other control character
const UNREAD = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029\ufeff]/u;
const HEADER = /^[|>](?:[1-9][+-]?|[+-][1-9]?)?(?: +(#.*)?)?$/u; // a block scalar's header, with its comment if any

// one node from `at`: { kind, text, end, comment } (kind "key" for a key, its text without the ":"), or { why }
function node(rest, at) {
  while (rest[at] === " ") at++;
  if (at >= rest.length) return { kind: "empty", text: "", start: at, end: at, comment: null };
  const c = rest[at], next = rest[at + 1];
  const spaced = next === undefined || next === " ";
  if (c === "#") return rest[at - 1] === " " ? { kind: "empty", text: "", start: at, end: at, comment: at } : { why: "a # that opens no comment" };
  if (c === "|" || c === ">") {
    const m = HEADER.exec(rest.slice(at));
    if (!m) return { why: "a block scalar's header this proof does not read" };
    const comment = m[1] === undefined ? null : rest.length - m[1].length;
    const text = rest.slice(at, comment ?? rest.length).replace(/ +$/u, "");
    return { kind: "block", text, start: at, end: rest.length, comment, fixed: /[1-9]/u.test(text) };
  }
  if (c === "-" && spaced) return { why: "a sequence on a key's line" };
  if (c === ":" && spaced) return { why: "a key with no name" };
  if ("&*!".includes(c)) return { why: "an anchor, alias or tag" };
  if ("?%@`".includes(c)) return { why: "an explicit key or a character YAML reserves" };
  if ("]},".includes(c)) return { why: "a [ ] or { } out of place" };
  if (c === "[" || c === "{") {
    let depth = 0, j = at;
    for (; j < rest.length; j++) {
      const ch = rest[j];
      if (`"'#&*!`.includes(ch)) return { why: "a quote, #, anchor, alias or tag inside [ ] or { }" };
      if (ch === "[" || ch === "{") depth++;
      else if (ch === "]" || ch === "}") { depth--; if (depth === 0) { j++; break; } }
    }
    if (depth !== 0) return { why: "a [ ] or { } that runs on to the next line" };
    return after(rest, at, j, "flow");
  }
  if (c === '"' || c === "'") {
    let j = at + 1;
    for (; j < rest.length; j++) {
      if (c === '"' && rest[j] === "\\") { j++; continue; }
      if (rest[j] === c) { if (c === "'" && rest[j + 1] === "'") { j++; continue; } break; }
    }
    if (j >= rest.length) return { why: "a quoted value that runs on to the next line" };
    return after(rest, at, j + 1, "quoted");
  }
  // a plain scalar: it ends at " #" (a comment) or at ": " or a final ":" (a key)
  for (let j = at; j < rest.length; j++) {
    if (rest[j] === "#" && rest[j - 1] === " ") return { kind: "plain", text: rest.slice(at, j).replace(/ +$/u, ""), start: at, end: j, comment: j };
    if (rest[j] === ":" && (j + 1 === rest.length || rest[j + 1] === " ")) return { kind: "key", text: rest.slice(at, j), start: at, end: j + 1, comment: null };
  }
  return { kind: "plain", text: rest.slice(at).replace(/ +$/u, ""), start: at, end: rest.length, comment: null };
}

// what may follow a quoted value or one in [ ] or { }: nothing, a comment, or the ":" that makes it a key
function after(rest, at, end, kind) {
  let j = end;
  while (rest[j] === " ") j++;
  if (j >= rest.length) return { kind, text: rest.slice(at, end), start: at, end, comment: null };
  if (rest[j] === "#" && j > end) return { kind, text: rest.slice(at, end), start: at, end, comment: j };
  if (rest[j] === ":" && (j + 1 === rest.length || rest[j + 1] === " ") && kind === "quoted") return { kind: "key", text: rest.slice(at, end), start: at, end: j + 1, comment: null };
  return { why: `text after a ${kind === "flow" ? "[ ] or { }" : "quoted value"}` };
}

/** How YAML reads `text`, line by line: { lines, unread }. Each line kept is either a block scalar's ("content", as it
 *  stands) or one with its entries (items, the "- " before its key or value; key; value); comment lines and blank lines
 *  between entries are left out, a line's own comment cut off. `unread` says, by line, what this proof cannot read. */
export function readYaml(text) {
  const unread = [], lines = [];
  const bad = UNREAD.exec(text);
  if (bad) return { lines, unread: [`line ${text.slice(0, bad.index).split("\n").length}: a tab, carriage return, byte order mark, or another control character or line break`] };
  const raw = text.split("\n");
  let block = null; // in a block scalar: { from, at }, the line that opened it and, once read, its content's indentation
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i], n = i + 1;
    const indent = /^ */u.exec(line)[0].length;
    const blank = indent === line.length;
    if (block) {
      if (block.at === undefined && !blank) block.at = block.fixed ? block.from + 1 : Math.max(block.from + 1, indent);
      if (blank || indent >= (block.at ?? Infinity)) { lines.push({ n, content: true, text: line }); continue; }
      block = null;
    }
    if (blank) continue;
    const rest = line.slice(indent);
    if (rest[0] === "#") continue;
    if (/^(?:---|\.\.\.)(?: |$)/u.test(rest)) { unread.push(`line ${n}: a document marker`); continue; }
    let at = 0, items = 0;
    while (rest[at] === "-" && (at + 1 === rest.length || rest[at + 1] === " ")) { items++; at++; while (rest[at] === " ") at++; }
    let first = node(rest, at), key = null, keyCol = null, value = first;
    if (first.why) { unread.push(`line ${n}: ${first.why}`); continue; }
    if (first.kind === "key") {
      key = first.text; keyCol = indent + at;
      value = node(rest, first.end);
      if (value.why) { unread.push(`line ${n}: ${value.why}`); continue; }
      if (value.kind === "key") { unread.push(`line ${n}: two keys on one line`); continue; }
      if (value.kind !== "empty" && rest[first.end] !== " ") { unread.push(`line ${n}: a value with no space after its key`); continue; }
    }
    const cut = value.comment === null ? rest.length : value.comment;
    const valueAt = value.kind === "empty" ? null : indent + value.start;
    lines.push({ n, indent, items, key, keyCol, kind: value.kind, value: value.text, valueAt, text: line.slice(0, indent + cut).replace(/ +$/u, "") });
    if (value.kind === "block") block = { from: indent, fixed: value.fixed };
  }
  // one entry a line: a line that is no key and no item continues a value, or stands alone where YAML would read it so;
  // and nothing deeper may follow a line that holds its value, where YAML would read it as that value running on
  const entries = lines.filter(l => !l.content);
  entries.forEach((l, k) => {
    if (l.key === null && l.items === 0) unread.push(`line ${l.n}: a value on a line of its own, or one that runs on from the line before`);
    const next = entries[k + 1];
    if (next && ["plain", "quoted", "flow"].includes(l.kind) && next.indent > (l.key !== null ? l.keyCol : l.indent)) unread.push(`line ${next.n}: a value that runs on from line ${l.n}`);
  });
  if (unread.length) return { lines: [], unread };
  // the steps' names: `- name: <value>` as the first key of an item under jobs.<job>.steps, holding no ${{
  const holder = (k) => {
    const me = entries[k];
    for (let p = k - 1; p >= 0; p--) {
      const q = entries[p];
      if (q.indent < me.indent || (q.indent === me.indent && q.items === 0 && me.items > 0)) return p;
    }
    return -1;
  };
  const opens = (p, key) => p >= 0 && entries[p].items === 0 && entries[p].kind === "empty" && (key === undefined ? entries[p].key !== null : entries[p].key === key);
  entries.forEach((l, k) => {
    if (l.items !== 1 || l.key !== "name" || !["plain", "quoted"].includes(l.kind) || l.value.includes("${{")) return;
    const steps = holder(k);
    if (!opens(steps, "steps")) return;
    const job = holder(steps);
    if (!opens(job)) return;
    const jobs = holder(job);
    if (opens(jobs, "jobs") && entries[jobs].indent === 0) l.stepName = true;
  });
  return { lines, unread };
}

/** Whether `before` and `after`, two versions of one YAML file, differ only in comments, blank lines between entries
 *  and steps' names: { same: true } or { why }. */
export function proof(before, after) {
  const a = readYaml(before), b = readYaml(after);
  if (a.unread.length) return { why: `before: ${a.unread.join("; ")}` };
  if (b.unread.length) return { why: `after: ${b.unread.join("; ")}` };
  const kept = l => l.content ? `C${l.text}` : `L${l.stepName ? `${l.text.slice(0, l.valueAt)}\u0000a step's name` : l.text}`;
  const x = a.lines.map(kept), y = b.lines.map(kept);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === y[i]) continue;
    const where = (lines, side) => lines[i] ? `${side} line ${lines[i].n}` : `${side}: nothing`;
    return { why: `more than a comment or a step's name changed (${where(a.lines, "before")}, ${where(b.lines, "after")})` };
  }
  return { same: true };
}

if (started(import.meta.url)) {
  const git = (args, encoding = "utf8") => execFileSync("git", args, { encoding, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });
  const clean = s => s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, "?");
  const head = git(["rev-parse", "HEAD"]).trim();
  let base;
  if (process.argv[2]) base = git(["rev-parse", "--verify", "--end-of-options", `${process.argv[2]}^{commit}`]).trim();
  else {
    git(["fetch", "-q", "--no-tags", "origin", "refs/heads/main"]);
    base = git(["merge-base", "FETCH_HEAD", head]).trim();
  }
  const fields = git(["-c", "core.quotePath=false", "diff", "--raw", "-z", "--no-renames", "--no-abbrev", "--no-ext-diff", "--ignore-submodules=none", base, head]).split("\0");
  const fails = [], read = [], others = [];
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  const blob = sha => utf8.decode(git(["cat-file", "blob", sha], "buffer"));
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const [modeA, modeB, shaA, shaB, status] = fields[i].replace(/^:/u, "").split(" ");
    const file = fields[i + 1];
    if (!RUNS.test(file)) { others.push(file); continue; }
    if (status !== "M" || modeA !== modeB || !["100644", "100755"].includes(modeA)) { fails.push(`${file}: added, deleted, or its mode or kind changed`); continue; }
    if (!YAML.test(file)) { fails.push(`${file}: not a YAML file`); continue; }
    let result;
    try { result = proof(blob(shaA), blob(shaB)); } catch { result = { why: "not text in UTF-8" }; }
    if (result.why) fails.push(`${file}: ${result.why}`);
    else read.push(file);
  }
  if (fails.length) {
    for (const f of fails) console.log(`  NOT ALONE ${clean(f)}`);
    console.log("not comments and steps' names alone: floor rule 3's two security reviews");
    process.exit(1);
  }
  console.log(read.length
    ? `comments and steps' names alone in .github/ and .claude/, ${base.slice(0, 7)}..${head.slice(0, 7)}: ${read.map(clean).join(", ")}`
    : `nothing changed in .github/ or .claude/, ${base.slice(0, 7)}..${head.slice(0, 7)}`);
  if (others.length) console.log(`changed outside .github/ and .claude/ (none of these may run by itself or with credentials): ${others.map(clean).join(", ")}`);
  console.log(`checked head ${head}`);
}
