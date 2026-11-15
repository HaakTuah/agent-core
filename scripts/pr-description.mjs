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
// Reads only: the description comes in PR_BODY, never on the command line; gh and Node's own modules. Run by the
// description workflow (.github/workflows/pr-description.yml).
//
//   PR_BODY="$(...)" PR_CREATED="..." node core/scripts/pr-description.mjs ["Part one|Part two"]
//   PR_BODY="$(...)" node core/scripts/pr-description.mjs "+Part three"     the two, and that one as well
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { started } from "./started.mjs";

// The line a description ends with, saying what the pull request waits on: nothing (its builder goes on), a review, its
// checks, another item ("#241"), or the owner, with the question in one sentence after a colon.
export const WAITS = "Waits on:";
const FORMS = [["nothing", /^nothing$/], ["a review", /^a review$/], ["checks", /^checks$/], ["item", /^#\d+$/], ["the owner", /^the owner: \S.*\?$/]];
export const WAITS_SINCE = "2026-11-16T00:00:00Z";

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
  return `${w ? `its line "${WAITS} ${w.said}" is in none of the forms` : `the description has no line "${WAITS}"`}: end it with one, above its closing lines, of these: "${WAITS} nothing", "${WAITS} a review", "${WAITS} checks", "${WAITS} #<the item it waits on>", or "${WAITS} the owner: <the question, in one sentence>?", with the label needs-owner on the pull request; edit it whenever what it waits on changes`;
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
  for (const part of absent) console.log(`FAIL the description has no heading "${part}": add "## ${part}" with what belongs under it ("None" where there is nothing; where a report in a file holds it, that file)`);
  console.log(`${absent.length ? "FAIL" : "ok  "} the description's parts: ${absent.length} of ${parts.length} missing`);
  // (asked only of a pull request opened since the copy on its base gained the line)
  const created = String(process.env.PR_CREATED ?? ""), base = String(process.env.BASE_SHA ?? ""), repo = String(process.env.GITHUB_REPOSITORY ?? "");
  let mend = null;
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(created) && created >= WAITS_SINCE && /^[0-9a-f]{40}$/.test(base) && /^[\w-]+\/[\w.-]+$/.test(repo) && !/\/\.+$/.test(repo)) {
    const file = fs.existsSync("core/scripts/pr-description.mjs") ? "core/scripts/pr-description.mjs" : "scripts/pr-description.mjs";
    const gh = (...a) => { const r = spawnSync("gh", ["api", ...a], { encoding: "utf8", maxBuffer: 1 << 24 }); if (r.status !== 0) throw new Error("no answer"); return r.stdout; };
    let held = null;
    try {
      const commits = JSON.parse(gh(`repos/${repo}/commits?path=${file}&sha=${base}&per_page=100`)).map(c => ({ sha: c.sha, date: c.commit?.committer?.date })).filter(c => /^[0-9a-f]{40}$/.test(c.sha));
      held = heldAt(commits, created, sha => Buffer.from(JSON.parse(gh(`repos/${repo}/contents/${file}?ref=${sha}`)).content ?? "", "base64").toString("utf8").includes("export const WAITS_SINCE"));
    } catch { held = null; }
    if (held) mend = waitsMend(process.env.PR_BODY);
    else console.log(`ok   the line "${WAITS}" is not asked here: ${held === false ? "the copy on its base did not hold it when the pull request opened" : "whether the copy on its base held it could not be read"}`);
  }
  if (mend) console.log(`FAIL ${mend}`);
  process.exit(absent.length || mend ? 1 : 0);
}
