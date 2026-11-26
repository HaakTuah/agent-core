// The trial's record of the drafts (#1334; AGENTS.md, "A release's trial opens its update as a draft in the owner's own
// projects"): what release.mjs --trial takes of what trial-draft.mjs printed (beside this file), the record's counts,
// their form, what they say and why they hold the cut. Node's own modules.
import fs from "node:fs";

export const LINE = "draft answer: ";

// Each class of a check by what it said on main and on the draft; failed on the draft after passing on main, or run on
// it alone (the dependency review) and failed, is the release's and holds the cut; `--gate` sets a failure apart.
export const DRAFT_COUNTS = ["draftPassedBoth", "draftFixedAfter", "draftFailedBoth", "draftFailedAfter", "draftFailedAlone", "draftPassedAlone", "draftGated", "draftSkipped"];

// Why no draft was opened, as `none` reads it, with the record's count it adds to.
export const NO_DRAFT = { "another-owner": "draftsAnotherOwner", "stop-switch": "draftsStopped" };

// What trial-draft.mjs printed, `text`, read for the commit `sha`: its last line `draft answer: ` and its JSON, as
// { answer, repo } (the counts), { none, repo }, or { why } it is none.
export function draftAnswerOf(text, sha) {
  const line = String(text).split("\n").map(l => l.trimEnd()).filter(l => l.startsWith(LINE)).at(-1);
  let a = null;
  try { a = JSON.parse(line.slice(LINE.length)); } catch { /* (none, or not read) */ }
  const counted = a !== null && typeof a === "object" && DRAFT_COUNTS.every(k => Number.isInteger(a[k]) && a[k] >= 0);
  const said = typeof a?.repo === "string" && typeof a?.commit === "string" && (counted ? a.none === undefined : typeof a?.none === "string" && Object.hasOwn(NO_DRAFT, a.none));
  if (!said || !/^[0-9a-f]{12}$/.test(a.repo)) return { why: `holds no line \`${LINE}\` as trial-draft.mjs prints it` };
  if (a.commit !== sha) return { why: `answers for ${String(a.commit).slice(0, 7)}, not the commit tried, ${sha.slice(0, 7)}` };
  return counted ? { answer: Object.fromEntries(DRAFT_COUNTS.map(k => [k, a[k]])), repo: a.repo } : { none: a.none, repo: a.repo };
}

// The arguments of release.mjs --trial after the commit, with each `--draft <file>` taken out and given by the index of
// the pair before it: { rest, drafts }, or { why } where one follows no whole pair or a pair has two.
export function draftsIn(args) {
  const rest = [], drafts = [];
  let files = 0;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sync") { rest.push(args[i], args[i + 1]); i++; continue; }
    if (args[i].startsWith("--") && args[i] !== "--draft") return { why: `--trial takes no ${args[i]}: each project's pair takes \`--sync <its reading>\` and \`--draft <the file trial-draft.mjs wrote>\` after it, a draft's reading or its \`none\` reading` };
    if (args[i] !== "--draft") { rest.push(args[i]); files++; continue; }
    const at = files / 2 - 1;
    if (!files || files % 2 || drafts[at] !== undefined || args[i + 1] === undefined) return { why: "each project's pair takes one `--draft <the file trial-draft.mjs wrote>` after it" };
    drafts[at] = { file: args[++i] };
  }
  return { rest, drafts };
}

// Each pair's reading of its draft, from what `drafts` gives after it (draftsIn): { readings }, each { answer } or
// { none }, or { why } the first is none: a pair with no reading is refused, so no trial is recorded that never asked
// it, and so is a project's reading given twice.
export function draftReadingsOf(drafts, sha, pairs) {
  const readings = [], seen = new Set();
  for (let n = 0; n < pairs; n++) {
    const d = drafts[n];
    if (d === undefined) return { why: `project ${n + 1}'s runs are given with no --draft after them: in a project of the owner's own, open its sync as a draft pull request pinned to ${sha.slice(0, 7)} and give what \`node scripts/trial-draft.mjs <owner>/<name> <its number> ${sha}\` wrote; where no draft was opened, what \`node scripts/trial-draft.mjs <owner>/<name> none ${sha}\` wrote` };
    let text = null;
    try { text = fs.readFileSync(d.file, "utf8"); } catch { /* (not read) */ }
    const got = text === null ? { why: "cannot be read" } : draftAnswerOf(text, sha);
    if (got.why) return { why: `${d.file}, given with --draft for project ${n + 1}, ${got.why}: give the file trial-draft.mjs wrote for the commit tried, ${sha.slice(0, 7)}` };
    if (seen.has(got.repo)) return { why: `${d.file}, given with --draft for project ${n + 1}, reads a project already given a reading: give each project tried its own` };
    seen.add(got.repo);
    readings.push(got.answer ? { answer: got.answer } : { none: got.none });
  }
  return { readings };
}

// Why the readings of a trial with pairs fall short of the owner's own projects, `own` as state-report.mjs --projects
// found them (null where it could not), or null: each needs a draft's reading or a stop switch that stood.
export function draftsShort(own, readings) {
  if (own === null) return "which of the owner's projects take the core could not be read (scripts/state-report.mjs --projects), so the drafts cannot be told one for each. Mend: run it where gh answers for the owner's account, then --trial again";
  const opened = readings.filter(r => !r.none || r.none === "stop-switch").length;
  return opened < own ? `${own} of the owner's projects take the core, as scripts/state-report.mjs --projects finds them, and ${opened} ${opened === 1 ? "was" : "were"} given a draft's reading or a stop switch. Mend: try each of them, its sync opened as a draft pull request and read with trial-draft.mjs, and give its pair` : null;
}

// The record's counts of the drafts, from each pair's reading.
export function draftRecord(readings) {
  const out = { drafts: 0, draftsAnotherOwner: 0, draftsStopped: 0, ...Object.fromEntries(DRAFT_COUNTS.map(k => [k, 0])) };
  for (const r of readings) {
    if (r.none) { out[NO_DRAFT[r.none]]++; continue; }
    out.drafts++;
    for (const k of DRAFT_COUNTS) out[k] += r.answer[k];
  }
  return out;
}

// Whether a record's counts of the drafts are in their form: one reading a project, no checks' counts with no draft;
// too few drafts is in its form and holds the cut (draftHeld).
export function draftFormed(r) {
  const keys = ["ownProjects", "drafts", "draftsAnotherOwner", "draftsStopped", ...DRAFT_COUNTS];
  return keys.every(k => Number.isInteger(r[k]) && r[k] >= 0) && r.drafts + r.draftsAnotherOwner + r.draftsStopped === r.projects
    && (r.drafts > 0 || DRAFT_COUNTS.every(k => r[k] === 0));
}

// What a record says of them, the gated checks in a sentence of their own.
export const draftSaid = r => (r.projects === 0 ? "" : `On the drafts of the sync in the owner's own projects, ${r.drafts} read of ${r.ownProjects} such projects found, ${r.draftsAnotherOwner} projects of another owner's with none and ${r.draftsStopped} with none for a stop switch: ${r.draftPassedBoth} checks passed on main and the draft, ${r.draftFixedAfter} failed on main and passed on it, ${r.draftFailedBoth} failed on both (standing before), ${r.draftFailedAfter} passed on main and failed on the draft (the release's), ${r.draftFailedAlone} ran on the draft alone and failed (the release's too), and ${r.draftPassedAlone} ran on it alone and passed. ${r.draftGated} failed on the draft and were set apart by its builder as failing for being a draft, holding nothing: the record's pull request names each and why. ${r.draftSkipped} were skipped on the draft, measuring nothing there and holding nothing: the record's pull request names each that passed on main and why it skips on a draft.`);

// Why the drafts hold the cut, or null: a check the release's, or one of the owner's own projects found with no draft
// read and no stop switch.
export function draftHeld(r, again) {
  const failed = r.draftFailedAfter + r.draftFailedAlone, missing = r.ownProjects - r.drafts - r.draftsStopped;
  return [
    failed && `${failed} check${failed === 1 ? "" : "s"} failed on the draft of the sync in the owner's own projects, ${r.draftFailedAfter} of them passing on main and ${r.draftFailedAlone} run on the draft alone. Mend: find the release's fault from the draft's failed checks, mend it in the core in a pull request of its own, move the draft forward to the commit that mends it, and ${again}`,
    missing > 0 && `${missing} of the owner's own projects that take the core ${missing === 1 ? "was" : "were"} tried with no draft of the sync read. Mend: open each one's sync as a draft pull request pinned to the commit tried, read it with \`node scripts/trial-draft.mjs\`, and ${again}`,
  ].filter(Boolean).join("; and ") || null;
}
