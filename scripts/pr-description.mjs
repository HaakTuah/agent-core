// The description check ("Each PR has the headings" in modules/git.md), for every project that takes the core, on every
// PR that is not a draft: it fails a description without a heading for each part the project names, by default "What
// the owner can try" and "Readings taken". A part is there when a line of the description is a heading (one to six #)
// that starts with its words, whatever the case, with no letter or digit right after them and whatever marks before
// them: "### Readings taken (the unsure first)" and "## **Readings taken**" count. It reads no Markdown beyond that, so
// such a line counts inside a code block or a comment too: it catches the heading forgotten, which is what happens, and
// not the one faked, which a review sees. Where nothing was open, the heading stands with "None" under it, and where
// the project's report is a file of its own, with where that file is, so the check never guesses whether something
// was. It holds that the parts are there, not that they are true or whole: that stays with the reviews. Dependabot's
// own PRs are not asked (the workflow leaves them out by their author).
// It asks too the line that says what it waits on ("Nothing waits silently" in modules/git.md; core archive 218), in one
// of the forms waitsOn reads, as the scheduled look reads it (look.mjs, beside this file), of a pull request opened
// (PR_CREATED) on or after WAITS_SINCE where the copy on its base (BASE_SHA) already held it then: the newest commit
// from before then that changed this file there, as GitHub's API gives them through gh (GH_TOKEN, GITHUB_REPOSITORY),
// holds the line. Where any of it cannot be read, or the base's copy has not gained it (a sync's
// own pull request), nothing is asked, so a pull request that stood before the line came is never turned red by it.
// It asks in the same way, of a pull request opened since the copy on its base held READS_SINCE, the line that lists
// what its changed paths called for ("One script says what to read" in modules/tools.md; core archive 233; #304): each
// file the reading script (reading.mjs, beside this file) gives for the paths the pull request changes, read from git
// as the merge commit against its first parent, the base, stands in backticks on the description's line "Read for
// it:". A renamed file counts by both its names, and the paths of the core's copy, in a project, by neither: a sync
// moves them, and the core's own pull request held them to their reading. A pull request whose paths call for nothing
// needs no line, and where the change cannot be read (a checkout without the base) nothing is asked. The kinds a
// project gives its own paths (its reading config) are read as the base holds them.
// Reads only: the description comes in PR_BODY, never on the command line; gh, git and Node's own modules. Run by the
// description workflow (.github/workflows/pr-description.yml).
//
//   PR_BODY="$(...)" PR_CREATED="..." node core/scripts/pr-description.mjs ["Part one|Part two"]
//   PR_BODY="$(...)" node core/scripts/pr-description.mjs "+Part three"     the two, and that one as well
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { OWN, calledByPaths, coreAt, leftOut, library, lineMend, ownOf, ownPaths, taken } from "./reading.mjs";
import { started } from "./started.mjs";

// The line a description ends with, saying what the pull request waits on: nothing (its builder goes on), a review, its
// checks, another item ("#241"), or the owner, with the question in one sentence after a colon.
export const WAITS = "Waits on:";
const FORMS = [["nothing", /^nothing$/], ["a review", /^a review$/], ["checks", /^checks$/], ["item", /^#\d+$/], ["the owner", /^the owner: \S.*\?$/]];
export const WAITS_SINCE = "2026-11-16T00:00:00Z";
// The day from which the line "Read for it:" is asked, of a pull request opened since the copy on its base held this.
export const READS_SINCE = "2026-11-16T00:00:00Z";

// What a description says it waits on: its last line that starts with "Waits on:", as { said, kind }, kind null where
// the line is in none of the forms; null where there is no such line.
export function waitsOn(body) {
  const line = String(body ?? "").split(/\r\n|\r|\n/u).map(l => l.trim()).filter(l => l.startsWith(WAITS)).at(-1);
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
  // a heading's words: what follows the #, without marks before the first letter or digit (bold, a sign), blanks as one
  const words = text => text.replace(/^[^\p{L}\p{N}]+/u, "").replace(/\s+/gu, " ").trim().toLowerCase();
  const headings = String(body ?? "").split(/\r\n|\r|\n/u).map(line => /^ {0,3}#{1,6}[ \t]+(.*)$/u.exec(line)?.[1]).filter(Boolean).map(words);
  return parts.filter(part => { const p = words(part); return !headings.some(h => h === p || h.startsWith(p) && /^[^\p{L}\p{N}]/u.test(h.slice(p.length))); });
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
    const file = fs.existsSync("core/scripts/pr-description.mjs") ? "core/scripts/pr-description.mjs" : "scripts/pr-description.mjs";
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
  }
  for (const mend of mends) console.log(`FAIL ${mend}`);
  process.exit(absent.length || mends.length ? 1 : 0);
}
