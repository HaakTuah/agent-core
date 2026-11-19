// The description check ("Each PR has the headings" in roles/shared/work-flow.md), for every project that takes the core, on every
// PR that is not a draft: it fails a description without a heading for each part the project names, by default "What
// the owner can try" and "Readings taken". A part is there when a line of the description is a heading (one to six #)
// that starts with its words, whatever the case, with no letter or digit right after them and whatever marks before
// them: "### Readings taken (the unsure first)" and "## **Readings taken**" count. It reads no Markdown beyond that, so
// such a line counts inside a code block or a comment too: it catches the heading forgotten, which is what happens, and
// not the one faked, which a review sees. Where nothing was open, the heading stands with "None" under it, and where
// the project's report is a file of its own, with where that file is, so the check never guesses whether something
// was. It holds that the parts are there, not that they are true or whole: that stays with the reviews. Dependabot's
// own PRs are not asked (the workflow leaves them out by their author).
// It asks too the line that says what it waits on ("Nothing waits silently" in roles/shared/work-flow.md; core archive 218), in one
// of the forms waitsOn reads, as the scheduled look reads it (look.mjs, beside this file), of a pull request opened
// (PR_CREATED) on or after WAITS_SINCE where the copy on its base (BASE_SHA) already held it then: the newest commit
// from before then that changed this file there, as GitHub's API gives them through gh (GH_TOKEN, GITHUB_REPOSITORY),
// holds the line. Where any of it cannot be read, or the base's copy has not gained it (a sync's
// own pull request), nothing is asked, so a pull request that stood before the line came is never turned red by it.
// It asks in the same way, of a pull request opened since the copy on its base held READS_SINCE, the line that lists
// what its changed paths called for ("One script says what to read" in tasks/tools.md; core archive 234; #304): each
// file the reading script (reading.mjs, beside this file) gives for the paths the pull request changes, read from git
// as the merge commit against its first parent, the base, stands in backticks on the description's line "Read for
// it:". A renamed file counts by both its names, and the paths of the core's copy, in a project, by neither: a sync
// moves them, and the core's own pull request held them to their reading. A pull request whose paths call for nothing
// needs no line, and where the change cannot be read (a checkout without the base) nothing is asked. The kinds a
// project gives its own paths (its reading config) are read as the base holds them.
// It asks in the same way, of a pull request opened since the copy on its base held DONE_SINCE, how done will be judged
// (tasks/done-when.md; #305): a feature's issue it adds to the *progress file* has the heading "Done when", lines the
// description holds are in the form, and one that closes a feature's issue says what it ran and saw for each line, as
// done-when.mjs, beside this file, reads them, at most a dozen items read through gh; one it cannot read is asked
// nothing. And, of one opened since the copy on its base held PLAN_SINCE, the milestones of the *progress file*
// (tasks/planning.md; #322), as milestones.mjs, beside this file, reads them, where the manifest takes that module.
// It asks in the same way, of a pull request opened since the copy on its base held COST_SINCE, the line the cost script
// prints (session-cost.mjs, beside this file), or in its place the mark NO_COST, so that a line left out by the rule can
// be told from one forgotten ("An exemption leaves a mark" in roles/shared/work-flow.md; #302). And where the part
// "What holds it" is asked and holds more than "None", of a pull request opened since the copy on its base held
// NUMBER_SINCE, a line under it that names a rule's number in its form ("Number: findings; outcome: robust";
// outcomes.mjs's NUMBER; #303). And, of one opened since the copy on its base held REASONS_SINCE that adds a line
// under the manifest's "Differences" (read from git, the merge commit against its base), the line "Reasons read:"
// (tasks/updates.md, "A question or difference about a rule of the core starts from its reasons"; #756).
// Reads only: the description comes in PR_BODY, never on the command line; gh, git and Node's own modules. Run by the
// description workflow (.github/workflows/pr-description.yml).
//
//   PR_BODY="$(...)" PR_CREATED="..." node core/scripts/pr-description.mjs ["Part one|Part two"]
//   PR_BODY="$(...)" node core/scripts/pr-description.mjs "+Part three"     the two, and that one as well
import { spawnSync } from "node:child_process";
import { doneMends, ownerAt, queueAt, readItem, takesIt } from "./done-when.mjs";
import { isPart, milestoneMends } from "./milestones.mjs";
import { differencesOf } from "./manifest-reads.mjs";
import { NUMBER } from "./outcomes.mjs";
import { OWN, calledByPaths, coreAt, leftOut, library, lineMend, ownOf, ownPaths, pathIn, taken, textOf } from "./reading.mjs";
import { started } from "./started.mjs";

// The line a description ends with, saying what the pull request waits on: nothing (its builder goes on), a review, its
// checks, another item ("#241"), or the owner, with the question in one sentence after a colon.
export const WAITS = "Waits on:";
const FORMS = [["nothing", /^nothing$/], ["a review", /^a review$/], ["checks", /^checks$/], ["item", /^#[1-9]\d{0,8}$/], ["the owner", /^the owner: \S.*\?$/]];
export const WAITS_SINCE = "2026-11-16T00:00:00Z";
// The day from which the line "Read for it:" is asked, of a pull request opened since the copy on its base held this.
export const READS_SINCE = "2026-11-16T00:00:00Z";
// The day from which how done will be judged is asked (tasks/done-when.md; #305), as the two lines above are.
export const DONE_SINCE = "2026-11-17T00:00:00Z";
// The day from which a description is asked its cost line or the mark that says the script printed none ("An exemption
// leaves a mark" in roles/shared/work-flow.md; #302), as the lines above are.
export const COST_SINCE = "2026-11-17T00:00:00Z";
export const NO_COST = "No cost line: the script printed none.";
// The day from which the part "What holds it" is asked the number of each rule it names (AGENTS.md of the core, "Every
// rule says what holds it"; #303), as the lines above are.
export const NUMBER_SINCE = "2026-11-17T00:00:00Z";
export const HOLDS = "What holds it";
// The day from which a pull request that adds a difference is asked the line REASONS (#756), as the lines above are.
export const REASONS_SINCE = "2026-11-19T00:00:00Z";
export const REASONS = "Reasons read:";

// The lines a pull request adds under the manifest's "Differences", in the checkout at `dir`, the merge commit against
// its first parent, the base (every line where the base holds no manifest: a project's first); [] where the head holds
// none, null where git cannot read the change.
export function differencesAdded(dir) {
  const show = at => { const r = spawnSync("git", ["show", `${at}:core-manifest.md`], { cwd: dir, encoding: "utf8", maxBuffer: 1 << 24 }); return r.status === 0 ? r.stdout : null; };
  if (spawnSync("git", ["rev-parse", "--verify", "--quiet", "HEAD^1"], { cwd: dir }).status !== 0) return null;
  const was = new Set(differencesOf(show("HEAD^1")).map(l => l.trim()));
  return differencesOf(show("HEAD")).map(l => l.trim()).filter(l => !was.has(l) && !/^None\.?$/iu.test(l));
}

// The mend where a pull request adds a difference and its description has no line REASONS with something after it;
// null where it has one, or adds none.
export function reasonsMend(body, added) {
  if (!added?.length) return null;
  if (textOf(body).split(/\r\n|\r|\n/u).some(l => l.trim().startsWith(REASONS) && l.trim().length > REASONS.length)) return null;
  return `it adds ${added.length === 1 ? "a line" : `${added.length} lines`} under the manifest's "Differences" ("${added[0].slice(0, 80)}"), and the description has no line "${REASONS}". Mend: for each rule of the core it departs from, run \`node core/scripts/reasons.mjs "<the rule's file and lead>"\`, read the archive items and the issues it prints, and add a line "${REASONS} <those items and issues>, and which of their reasons does not hold for this project, and why"; where a line departs from no rule of the core (a step of the sync notes, a file the starter kit writes), say so on that line`;
}

// The mend where the part HOLDS holds more than "None" and no line "Number: <the count>; outcome: <the outcome>" in
// NUMBER's form; null where it does, or where the part is not there (missing() names that).
export function numberMend(body) {
  const lines = String(body ?? "").split(/\r\n|\r|\n/u), heading = l => /^ {0,3}#{1,6}[ \t]+(.*)$/u.exec(l)?.[1];
  const at = lines.findIndex(l => heading(l) && isPart(heading(l), HOLDS));
  if (at < 0) return null;
  const end = lines.findIndex((l, i) => i > at && heading(l));
  const part = lines.slice(at + 1, end < 0 ? undefined : end).map(l => l.trim()).filter(Boolean);
  if (part.every(l => /^None\b/u.test(l))) return null;
  const named = part.map(l => /(?:^|[\s*-])Number: (.*[^.\s])[.\s]*$/u.exec(l)?.[1]).filter(Boolean);
  if (named.some(n => NUMBER.test(n))) return null;
  return `the part "${HOLDS}" names no rule's number${named.length ? ` in its form (it reads "${named[0]}")` : ""}. Mend: under it, for each rule this pull request adds or widens, add a line "Number: <findings | check fires | correction: <kind>>; outcome: <asked | fast | readable | usable | robust>", the count the rule is meant to lower and the outcome it stands for, with "; rare harm" at its end where the rule guards against rare and severe harm, as scripts/holders.json keeps it under "numbers"; or write "None" alone under the heading where it adds no rule`;
}

// The mend where a description has neither the line session-cost.mjs prints ("Session so far: ...") nor the mark that
// it printed none, each on a line of its own; null where it has one.
export function costMend(body) {
  const lines = String(body ?? "").split(/\r\n|\r|\n/u).map(l => l.trim());
  if (lines.some(l => /^Session so far: [\d,]+ answers\b/u.test(l) || l === NO_COST)) return null;
  return `the description has neither the line the cost script prints nor the mark that it printed none. Mend: run \`node core/scripts/session-cost.mjs\` (\`node scripts/session-cost.mjs\` in the core) and put the line it prints above the closing lines; where it prints nothing, put there instead, on a line of its own, "${NO_COST}"`;
}
// Whether it is asked of a pull request opened at `created` (as GitHub gives it), `then` the copy on its base when it
// opened, or null where that could not be read: only where both are on or after the day it came.
export const doneAsked = (created, then) => String(created) >= DONE_SINCE && Boolean(then?.includes("export const DONE_SINCE"));
// The day from which the milestones are asked (tasks/planning.md; #322), in the same way.
export const PLAN_SINCE = "2026-11-17T00:00:00Z";
export const planAsked = (created, then) => String(created) >= PLAN_SINCE && Boolean(then?.includes("export const PLAN_SINCE"));

// What a description says it waits on: its last line that starts with "Waits on:", as { said, kind }, kind null where
// the line is in none of the forms; null where there is no such line.
export function waitsOn(body) {
  const line = textOf(body).split(/\r\n|\r|\n/u).map(l => l.trim()).filter(l => l.startsWith(WAITS)).at(-1);
  if (line === undefined) return null;
  const said = line.slice(WAITS.length).trim();
  return { said, kind: FORMS.find(([, form]) => form.test(said))?.[0] ?? null };
}

// Whether the copy on the base held the line when the pull request opened at `created`: of the commits that changed
// it there, newest first ([{ sha, date }]), the newest from before then, and `holds`, whether the file at a commit holds
// the line. One file is read, however many syncs have changed it, so a run spends two of the repository's calls.
export function heldAt(commits, created, holds) {
  const then = commits.find(c => String(c.date) <= created);
  return then ? holds(then.sha) : false;
}

// The mend where a description asked for the line lacks it or words it in none of the forms; null where it is right.
export function waitsMend(body) {
  const w = waitsOn(body);
  if (w?.kind) return null;
  return `${w ? `its line "${WAITS} ${w.said}" is in none of the forms` : `the description has no line "${WAITS}"`}. Mend: end it with one, above its closing lines, of these: "${WAITS} nothing", "${WAITS} a review", "${WAITS} checks", "${WAITS} #<the item it waits on>", or "${WAITS} the owner: <the question, in one sentence>?", with the label needs-owner on the pull request; edit it whenever what it waits on changes`;
}

// What the paths a pull request changes call for, [{ file, why }], in the checkout at `dir`, the merge commit against
// its first parent, the base: each file by its path from the root (under core/ in a project). The kinds a project
// gives its own paths, and the modules its manifest leaves out, are read as the base holds them, so that a pull request
// does not set either for itself; the
// modules' own lines are the copy's, which core.yml holds to the core's. Null where the change cannot be read.
export function calledFor(dir) {
  const git = (...args) => { const r = spawnSync("git", args, { cwd: dir, encoding: "utf8", maxBuffer: 1 << 26 }); return r.status === 0 ? r.stdout : null; };
  const prefix = coreAt(dir), diff = prefix === null ? null : git("diff", "--name-only", "--no-renames", "-z", "HEAD^1", "HEAD");
  if (diff === null) return null;
  const own = prefix ? ownPaths(OWN.map(f => git("show", `HEAD^1:${f}`)).find(text => text !== null)) : [];
  const lib = taken(library(dir, prefix), leftOut(prefix ? git("show", "HEAD^1:core-manifest.md") : ""));
  return calledByPaths(lib, ownOf(diff.split("\0").filter(Boolean), prefix), own).map(c => ({ ...c, file: `${prefix}${c.file}` }));
}

// The path of the copy whose history says which lines a pull request is asked, in the checkout at `dir`, the merge commit
// against its first parent, the base: where the base's manifest puts the core (its "Core:" line, read by pathIn), or the
// core's own scripts/ where the base holds no manifest; never the head's, so that a pull request cannot move the path to
// skip the lines (#455).
export function copyAtBase(dir) {
  const r = spawnSync("git", ["show", "HEAD^1:core-manifest.md"], { cwd: dir, encoding: "utf8", maxBuffer: 1 << 24 });
  return `${r.status === 0 ? pathIn(r.stdout) : ""}scripts/pr-description.mjs`;
}

export const PARTS = ["What the owner can try", "Readings taken"];

// The parts an argument asks for: its own, separated by |, in place of the two; led by a +, added to the two (so a
// caller that wants one more never writes the two a second time); empty or left out, the two.
export function asked(arg) {
  const text = String(arg ?? "").trim();
  const own = text.replace(/^\+/u, "").split("|").map(p => p.trim()).filter(Boolean);
  if (!own.length) return PARTS;
  return text.startsWith("+") ? [...PARTS, ...own.filter(p => !PARTS.includes(p))] : own;
}

// The parts, of those asked for, that the description has no heading for.
export function missing(body, parts = PARTS) {
  // a heading's words: what follows the #, read as milestones.mjs, beside this file, reads a part's heading
  const headings = textOf(body).split(/\r\n|\r|\n/u).map(line => /^ {0,3}#{1,6}[ \t]+(.*)$/u.exec(line)?.[1]).filter(Boolean);
  return parts.filter(part => !headings.some(h => isPart(h, part)));
}

if (started(import.meta.url)) {
  const parts = asked(process.argv[2]);
  const absent = missing(process.env.PR_BODY, parts);
  for (const part of absent) console.log(`FAIL the description has no heading "${part}". Mend: add "## ${part}" with what belongs under it ("None" where there is nothing; where a report in a file holds it, that file), and run the check again`);
  console.log(`${absent.length ? "FAIL" : "ok  "} the description's parts: ${absent.length} of ${parts.length} missing${absent.length ? ". Mend: add each heading above as it says" : ""}`);
  // (each line asked only of a pull request opened since the copy on its base gained it)
  const created = String(process.env.PR_CREATED ?? ""), base = String(process.env.BASE_SHA ?? ""), repo = String(process.env.GITHUB_REPOSITORY ?? "");
  const mends = [];
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(created) && created >= WAITS_SINCE && /^[0-9a-f]{40}$/.test(base) && /^[\w-]+\/[\w.-]+$/.test(repo) && !/\/\.+$/.test(repo)) {
    const file = copyAtBase(".");
    const gh = (...a) => { const r = spawnSync("gh", ["api", ...a], { encoding: "utf8", maxBuffer: 1 << 24 }); if (r.status !== 0) throw new Error("no answer"); return r.stdout; };
    // the copy as it stood when the pull request opened, read once
    let then = null;
    try {
      const commits = JSON.parse(gh(`repos/${repo}/commits?path=${file}&sha=${base}&per_page=100`)).map(c => ({ sha: c.sha, date: c.commit?.committer?.date })).filter(c => /^[0-9a-f]{40}$/.test(c.sha));
      then = "";
      heldAt(commits, created, sha => { then = Buffer.from(JSON.parse(gh(`repos/${repo}/contents/${file}?ref=${sha}`)).content ?? "", "base64").toString("utf8"); return true; });
    } catch { then = null; }
    const why = then === null ? "whether the copy on its base held it could not be read" : "the copy on its base did not hold it when the pull request opened";
    if (then?.includes("export const WAITS_SINCE")) { const mend = waitsMend(process.env.PR_BODY); if (mend) mends.push(mend); }
    else console.log(`ok   the line "${WAITS}" is not asked here: ${why}`);
    if (created >= READS_SINCE && then?.includes("export const READS_SINCE")) {
      const called = calledFor(process.cwd());
      if (called === null) console.log("ok   the line that lists what the changed paths call for is not asked here: the change could not be read against its base");
      else {
        const mend = lineMend(process.env.PR_BODY, called, `node ${coreAt(process.cwd())}scripts/reading.mjs builder --changed --line`);
        if (mend) mends.push(mend);
        else console.log(`ok   the description lists what its changed paths call for (${called.length} file${called.length === 1 ? "" : "s"})`);
      }
    } else console.log(`ok   the line that lists what the changed paths call for is not asked here: ${why}`);
    const at = coreAt(process.cwd()) ?? "", queue = doneAsked(created, then) || planAsked(created, then) ? queueAt(process.cwd(), at) : null;
    // (one read of each item for both checks, so that a run reads a dozen at most between them)
    const owner = queue ? ownerAt(queue.manifest, at, repo) : null, seen = new Map();
    const read = item => { if (!seen.has(item)) seen.set(item, readItem(repo, item, ".", owner)); return seen.get(item); };
    if (queue && !doneAsked(created, then)) console.log(`ok   how done will be judged is not asked here: ${why}`);
    else if (queue && !takesIt(queue.manifest, at)) console.log("ok   how done will be judged is not asked here: the manifest leaves done-when.md out");
    else if (queue) {
      const done = doneMends({ body: process.env.PR_BODY, queue, read, at });
      for (const note of done.notes) console.log(`ok   ${note}`);
      if (done.mends.length) mends.push(...done.mends);
      else console.log("ok   how done will be judged: the entries this pull request queues or closes are in the form, and proved");
    } else console.log(`ok   how done will be judged is not asked here: ${doneAsked(created, then) ? "the change could not be read against its base" : why}`);
    if (queue && !planAsked(created, then)) console.log(`ok   the milestones are not asked here: ${why}`);
    else if (queue && !takesIt(queue.manifest, at, "planning.md")) console.log("ok   the milestones are not asked here: the manifest leaves planning.md out");
    else if (queue) {
      const plan = milestoneMends({ body: process.env.PR_BODY, queue, read, at, already: new Set(seen.keys()) });
      for (const note of plan.notes) console.log(`ok   ${note}`);
      if (plan.mends.length) mends.push(...plan.mends);
      else console.log("ok   the milestones of the progress file are in their form, and each one reached is named");
    } else console.log(`ok   the milestones are not asked here: ${planAsked(created, then) ? "the change could not be read against its base" : why}`);
    if (created >= COST_SINCE && then?.includes("export const COST_SINCE")) { const mend = costMend(process.env.PR_BODY); if (mend) mends.push(mend); else console.log("ok   the description has its cost line, or the mark that the script printed none"); }
    else console.log(`ok   the cost line or its mark is not asked here: ${why}`);
    // (asked only where the part is, which is where the rules change)
    if (parts.includes(HOLDS) && created >= NUMBER_SINCE && then?.includes("export const NUMBER_SINCE")) { const mend = numberMend(process.env.PR_BODY); if (mend) mends.push(mend); else console.log(`ok   the part "${HOLDS}" names a rule's number, or "None"`); }
    else if (parts.includes(HOLDS)) console.log(`ok   the number under "${HOLDS}" is not asked here: ${why}`);
    if (created >= REASONS_SINCE && then?.includes("export const REASONS_SINCE")) {
      const added = differencesAdded(process.cwd()), mend = added === null ? null : reasonsMend(process.env.PR_BODY, added);
      if (mend) mends.push(mend);
      else console.log(added === null ? `ok   the line "${REASONS}" is not asked here: the change could not be read against its base` : added.length ? `ok   the description says the reasons read for the difference it adds` : `ok   the line "${REASONS}" is not asked here: no line is added under the manifest's "Differences"`);
    } else console.log(`ok   the line "${REASONS}" is not asked here: ${why}`);
  }
  for (const mend of mends) console.log(`FAIL ${mend}`);
  process.exit(absent.length || mends.length ? 1 : 0);
}
