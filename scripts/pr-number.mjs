// The number of each rule the part "What holds it" names (split from pr-description.mjs, #888; "Every rule says what holds it" in the core's core-changes/holders.md; #303). pr-description.mjs,
// beside this file, says what the check asks as a whole, runs this one and exports what it holds.
import { spawnSync } from "node:child_process";
import { parseBounded } from "./guards.mjs";
import { NUMBER } from "./outcomes.mjs";
import { isPart } from "./milestones.mjs";

// a rule's number in its form at the start of a line, whatever follows it, in any case (#750, point 4)
const NUMBER_FIRST = new RegExp(NUMBER.source.replace(/\$$/u, "(?![\\w-])"), "iu");
export const HOLDS = "What holds it";

// The lines of the part HOLDS, each trimmed, the empty left out; null where the part is not there.
function partOf(body) {
  const lines = String(body ?? "").split(/\r\n|\r|\n/u), heading = l => /^ {0,3}#{1,6}[ \t]+(.*)$/u.exec(l)?.[1];
  const at = lines.findIndex(l => heading(l) && isPart(heading(l), HOLDS));
  if (at < 0) return null;
  const end = lines.findIndex((l, i) => i > at && heading(l));
  return lines.slice(at + 1, end < 0 ? undefined : end).map(l => l.trim()).filter(Boolean);
}
// What each line "Number:" of a part names, as written.
const namedIn = part => part.map(l => /(?:^|[\s*-])Number: (.*[^.\s])[.\s]*$/u.exec(l)?.[1]).filter(Boolean);

// The mend where the part HOLDS holds more than "None" and no line "Number: <the count>; outcome: <the outcome>" in
// NUMBER's form; null where it does, or where the part is not there (missing() names that).
export function numberMend(body) {
  const part = partOf(body);
  if (part === null || part.every(l => /^None\b/u.test(l))) return null;
  const named = namedIn(part);
  if (named.some(n => NUMBER_FIRST.test(n))) return null;
  return `the part "${HOLDS}" names no rule's number${named.length ? ` in its form (it reads "${named[0]}")` : ""}. Mend: under it, for each rule this pull request adds or widens, add a line "Number: <findings | check fires | correction: <kind>>; outcome: <asked | fast | readable | usable | robust>", the count the rule is meant to lower and the outcome it stands for, with "; rare harm" at its end where the rule guards against rare and severe harm, as the rule's entry in scripts/holders/ keeps it under "number"; or write "None" alone under the heading where it adds no rule`;
}

// (the mend of an entry that is no regular file: holders.mjs reads the folder's files, git keeps a link's target)
const ODD_MEND = "make each entry of scripts/holders/ a regular JSON file, its text in the folder itself, and push again";

// The "Number:" lines out of step with the entries (#1138, part 3), in the core's own repository: `changed`, the
// numbers of the entries of scripts/holders/ the pull request adds or changes, [{ rule, number }]; `standing`, every
// number an entry holds at its head; `odd`, the entries at its head that are no regular file, each failing. Under the
// part HOLDS, each changed entry has a line of its own whose number, read in NUMBER's form in any case, is the entry's,
// and each line in that form names a number some entry holds; a line beyond those of the changed entries may stand for
// a rule the pull request widens and whose number it keeps, which the check above asks a line of too. The mend, or
// null where they are in step or the part is not there (missing() names that).
export function entriesMend(body, changed, standing, odd = []) {
  const part = partOf(body), links = odd.map(f => `${f} is a link or a submodule, so the number it gives cannot be read`);
  if (part === null) return links.length ? `${links.join("; ")}. Mend: ${ODD_MEND}` : null;
  const said = namedIn(part).map(n => NUMBER_FIRST.exec(n)?.[0].toLowerCase()).filter(Boolean), left = [...said], lacking = [];
  for (const c of changed) { const i = left.indexOf(c.number.toLowerCase()); if (i < 0) lacking.push(c); else left.splice(i, 1); }
  const known = new Set([...standing].map(n => n.toLowerCase())), stray = said.filter(n => !known.has(n));
  const faults = [
    ...links,
    ...lacking.map(c => `the entry of "${c.rule}" gets the number "${c.number}", which no line "Number:" under "${HOLDS}" gives (${said.length} line${said.length === 1 ? "" : "s"} for ${changed.length} entr${changed.length === 1 ? "y" : "ies"} whose number this pull request adds or changes)`),
    ...[...new Set(stray)].map(n => `the line "Number: ${n}" under "${HOLDS}" names a number no entry of scripts/holders/ holds`),
  ];
  return faults.length ? `${faults.join("; ")}. Mend: ${links.length ? `${ODD_MEND}; and ` : ""}under "${HOLDS}", give each rule whose entry's "number" this pull request adds or changes a line "Number: <its number>" of its own, the number word for word as its entry in scripts/holders/ holds it, and make each other line "Number:" the number of the rule it stands for as its entry holds it` : null;
}

// The most of git's answer the entries are read from (SECURITY.md, rule 5): a tree's list, or all its entries' text
// together, past which git stops and the change is said unread, failing nothing.
export const ENTRIES_MAX = 1 << 24;
const LIST = "scripts/holders/";
// An entry's rule and number, the number null where it holds none or its text is no JSON (holders.mjs names that).
function entryOf(text) {
  try { const e = parseBounded(text); return { rule: String(e?.rule), number: typeof e?.number === "string" && e.number ? e.number : null }; } catch { return { rule: "", number: null }; }
}
// The entries of the tree at `rev`, { entries: [{ path, rule, number }], odd: [paths] }, two calls of git whatever
// their count: the tree's list, and the text of every regular file of it in one batch; a link or a submodule named as
// an entry is odd, never read; null where git fails, stops at ENTRIES_MAX or answers out of its form.
function entriesAt(rev, git) {
  const tree = git(["ls-tree", "-r", "-z", "--full-tree", rev, "--", LIST]);
  if (tree.status !== 0) return null;
  const files = [], odd = [];
  for (const record of String(tree.stdout).split("\0").filter(Boolean)) {
    const [, mode, sha, file] = /^(\d{6}) \w+ ([0-9a-f]{40,64})\t(.+)$/su.exec(record) ?? [];
    if (!file) return null;
    if (!file.endsWith(".json")) continue;
    if (mode === "100644" || mode === "100755") files.push({ file, sha }); else odd.push(file);
  }
  if (!files.length) return { entries: [], odd };
  const blobs = git(["cat-file", "--batch"], `${files.map(f => f.sha).join("\n")}\n`), entries = blobs.status === 0 && entriesIn(Buffer.from(blobs.stdout), files);
  return entries ? { entries, odd } : null;
}
// The entries `files` names ([{ file, sha }]) out of git's cat-file --batch answer `out`, in their order; null where it
// is out of its form (another object, one missing, or shorter than a size it gives).
function entriesIn(out, files) {
  const entries = [];
  let at = 0;
  for (const { file, sha } of files) {
    const end = out.indexOf(10, at), [got, type, size] = end < 0 ? [] : out.subarray(at, end).toString("latin1").split(" ");
    if (got !== sha || type !== "blob" || !/^\d{1,9}$/u.test(size ?? "") || end + 1 + Number(size) > out.length) return null;
    entries.push({ path: file, ...entryOf(out.subarray(end + 1, end + 1 + Number(size)).toString("utf8")) });
    at = end + 2 + Number(size);
  }
  return entries;
}

// The entries' numbers as the pull request in the checkout at `dir` leaves them, the merge commit against its first
// parent, the base: { changed, standing, odd } as entriesMend() takes them, each entry of the head compared with the
// base's of the same path, or else of the same rule (a rename with its number kept is no change), or else of the same
// lead, the rule's name after its file, where one entry of the base alone has it and no entry of the head holds that
// entry's rule (a rule moved to another file with its number kept is no change, #1202); four calls of git, whatever
// the entries' count; null where the change cannot be read.
export function entriesChanged(dir, git = (args, input) => spawnSync("git", args, { cwd: dir, input, maxBuffer: ENTRIES_MAX })) {
  const head = entriesAt("HEAD", git), base = head && entriesAt("HEAD^1", git);
  if (!base) return null;
  const byPath = new Map(base.entries.map(e => [e.path, e])), byRule = new Map(base.entries.map(e => [e.rule, e]));
  const leadOf = rule => rule.slice(rule.indexOf(": ") + 1).trim(), kept = new Set(head.entries.map(e => e.rule)), byLead = new Map();
  for (const e of base.entries) byLead.set(leadOf(e.rule), byLead.has(leadOf(e.rule)) ? null : e);
  const moved = e => { const from = byLead.get(leadOf(e.rule)); return from && !kept.has(from.rule) ? from : undefined; };
  const numbered = head.entries.filter(e => e.number);
  const changed = numbered.filter(e => e.number !== (byPath.get(e.path) ?? byRule.get(e.rule) ?? moved(e))?.number).map(({ rule, number }) => ({ rule, number }));
  return { changed, standing: new Set(numbered.map(e => e.number)), odd: head.odd };
}
