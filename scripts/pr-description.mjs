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
// It asks too, of a pull request opened from WAITS_SINCE on (PR_CREATED, its time of opening; none given, none asked),
// the line that says what it waits on ("Nothing waits silently" in modules/git.md; core archive 218), in one of the
// forms waitsOn reads, as the scheduled look reads it (look.mjs, beside this file). Reads only: the description comes in PR_BODY,
// never on the command line; Node's own modules. Run by the description workflow (.github/workflows/pr-description.yml).
//
//   PR_BODY="$(...)" PR_CREATED="..." node core/scripts/pr-description.mjs ["Part one|Part two"]
//   PR_BODY="$(...)" node core/scripts/pr-description.mjs "+Part three"     the two, and that one as well
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
  // (asked only of a pull request opened since the line came: one that stood before it is never turned red by it)
  const created = String(process.env.PR_CREATED ?? "");
  const mend = /^\d{4}-\d\d-\d\dT/.test(created) && created >= WAITS_SINCE ? waitsMend(process.env.PR_BODY) : null;
  if (mend) console.log(`FAIL ${mend}`);
  process.exit(absent.length || mend ? 1 : 0);
}
