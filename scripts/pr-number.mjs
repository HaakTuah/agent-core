// The number of each rule the part "What holds it" names (split from pr-description.mjs, #888; "Every rule says what holds it" in the core's AGENTS.md; #303). pr-description.mjs,
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

// The "Number:" lines out of step with the entries (#1138, part 3), in the core's own repository: `changed`, the
// numbers of the entries of scripts/holders/ the pull request adds or changes, [{ rule, number }]; `standing`, every
// number an entry holds at its head. Under the part HOLDS, each such entry has a line of its own whose number, read in
// NUMBER's form in any case, is the entry's, and each line in that form names a number some entry holds; a line beyond
// those of the changed entries may stand for a rule the pull request widens and whose number it keeps, which the
// check above asks a line of too. The mend, or null where they are in step or the part is not there (missing() names
// that).
export function entriesMend(body, changed, standing) {
  const part = partOf(body);
  if (part === null) return null;
  const said = namedIn(part).map(n => NUMBER_FIRST.exec(n)?.[0].toLowerCase()).filter(Boolean), left = [...said], lacking = [];
  for (const c of changed) { const i = left.indexOf(c.number.toLowerCase()); if (i < 0) lacking.push(c); else left.splice(i, 1); }
  const known = new Set([...standing].map(n => n.toLowerCase())), stray = said.filter(n => !known.has(n));
  const faults = [
    ...lacking.map(c => `the entry of "${c.rule}" gets the number "${c.number}", which no line "Number:" under "${HOLDS}" gives (${said.length} line${said.length === 1 ? "" : "s"} for ${changed.length} entr${changed.length === 1 ? "y" : "ies"} whose number this pull request adds or changes)`),
    ...[...new Set(stray)].map(n => `the line "Number: ${n}" under "${HOLDS}" names a number no entry of scripts/holders/ holds`),
  ];
  return faults.length ? `${faults.join("; ")}. Mend: under "${HOLDS}", give each rule whose entry's "number" this pull request adds or changes a line "Number: <its number>" of its own, the number word for word as its entry in scripts/holders/ holds it, and make each other line "Number:" the number of the rule it stands for as its entry holds it` : null;
}

// The entries' numbers as the pull request in the checkout at `dir` leaves them, the merge commit against its first
// parent, the base, both read from git: { changed, standing } as entriesMend() takes them, an entry renamed (git's
// rename detection) compared with itself as it was; null where the change cannot be read.
export function entriesChanged(dir, git = (...a) => spawnSync("git", a, { cwd: dir, encoding: "utf8", maxBuffer: 1 << 26 })) {
  const LIST = "scripts/holders", diff = git("diff", "--name-status", "-M", "-z", "HEAD^1", "HEAD", "--", LIST), all = git("ls-tree", "-r", "--name-only", "-z", "HEAD", "--", `${LIST}/`);
  if (diff.status !== 0 || all.status !== 0) return null;
  const numberAt = (rev, f) => { const r = git("show", `${rev}:${f}`); if (r.status !== 0) return null; try { const e = parseBounded(r.stdout); return typeof e?.number === "string" && e.number ? { rule: String(e.rule), number: e.number } : null; } catch { return null; } };
  const fields = diff.stdout.split("\0").filter(Boolean), changed = [];
  for (let i = 0; i < fields.length;) {
    const status = fields[i++], renamed = /^[RC]/u.test(status), was = renamed ? fields[i++] : fields[i], now = fields[i++];
    if (!now.endsWith(".json") || status.startsWith("D")) continue;
    const after = numberAt("HEAD", now), before = status.startsWith("A") ? null : numberAt("HEAD^1", was);
    if (after && after.number !== before?.number) changed.push(after);
  }
  const standing = new Set(all.stdout.split("\0").filter(f => f.endsWith(".json")).map(f => numberAt("HEAD", f)?.number).filter(Boolean));
  return { changed, standing };
}
