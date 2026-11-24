// The trial of a release on a real project before it is cut (#1084; AGENTS.md, "A release is cut on the owner's word"):
// a run of check.mjs --verdicts before an update set beside one after it, the record of the trial, which holds counts
// alone, and what that record says of the release release.mjs would cut. Git and Node's own modules only.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { leadsOut } from "./guards.mjs";

// The key check.mjs --verdicts adds where it was run from outside the project, a clone of the core (check.mjs's RUN_FROM,
// which the test holds to this one; #1244): no job's place.
const RUN_FROM = "(run from)";

// The record of the trial: counts alone, never a project's name, its jobs or its code.
export const TRIAL = "reports/release-trial.json";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// A run of check.mjs --verdicts before an update set beside one after it, each job by its place: failed both, standing
// before the update; failed after where it passed before or did not run, the update's; passed after, whatever it
// was before (both, as a rule), since nothing of it is the update's; and stopped after, behind another's failure, which
// measured nothing of it (#1245, point 2). A job that ran before alone is counted apart, and holds nothing: an update may
// fold it into another's steps; one stopped before ran in neither, and one whose place a job stopped after holds is
// counted with that one.
export function compared(before, after) {
  const jobs = run => Object.entries(run ?? {}).filter(([job]) => job !== RUN_FROM);
  const stopped = jobs(after).filter(([, v]) => v === "stopped").map(([job]) => job);
  const under = job => stopped.some(s => job.startsWith(`${s}/`) || job.startsWith(`${s} (`));
  const out = { passedAfter: [], failedBoth: [], failedAfter: [], stoppedAfter: stopped,
    ranBeforeAlone: jobs(before).filter(([job, v]) => v !== "stopped" && !Object.hasOwn(after ?? {}, job) && !under(job)).map(([job]) => job) };
  for (const [job, v] of jobs(after).filter(([, x]) => x !== "stopped")) out[v !== "failed" ? "passedAfter" : before?.[job] === "failed" ? "failedBoth" : "failedAfter"].push(job);
  return out;
}

// The record of a trial at `sha` on the day `day`: each project's runs, [before, after], counted, and how many baselines
// the release's check.mjs took from a clone of the core, where the copy's could not (#1244); no pair where no project
// that takes the core allowed one.
export function trialRecord(sha, day, pairs) {
  const counts = { passedAfter: 0, failedBoth: 0, failedAfter: 0, stoppedAfter: 0, ranBeforeAlone: 0 };
  for (const [before, after] of pairs) for (const [k, jobs] of Object.entries(compared(before, after))) counts[k] += jobs.length;
  return { commit: sha, day, projects: pairs.length, ...counts, baselineFromClone: pairs.filter(([before]) => Object.hasOwn(before ?? {}, RUN_FROM)).length };
}

// Whether a record is in the form --trial writes: the commit, the day, and counts, all none where no project was tried.
function formed(r) {
  if (r === null || typeof r !== "object") return false;
  const counts = [r.passedAfter, r.failedBoth, r.failedAfter, r.stoppedAfter, r.ranBeforeAlone, r.baselineFromClone];
  return /^[0-9a-f]{40}$/.test(String(r.commit)) && /^\d{4}-\d\d-\d\d$/.test(String(r.day)) && [r.projects, ...counts].every(n => Number.isInteger(n) && n >= 0)
    && (r.projects > 0 || counts.every(n => n === 0)) && r.baselineFromClone <= r.projects;
}

// How the runs are taken, for a mend that asks a trial: check.mjs from the project's clone, before the update and after,
// and, where the copy holds none, or one without --verdicts, the baseline by the release's, from a clone of the core.
export const RUNS = "in a clone of the project, `node core/scripts/check.mjs --base <its main> --own --verdicts <a file outside every repository>` before the update and after it; where the copy holds no check.mjs, or one without --verdicts, the run before with `node <a clone of the core at the commit tried>/scripts/check.mjs` and the same options, from the project's clone";

// What the trial's record says of the release at `sha`, read through `git` (its arguments give its output), and why it
// holds the cut, or null: the record stands for the commit where it names it, or one before it from which the release
// changes the record alone; it holds the cut where it does not stand, and where a check passed before and failed after.
export function trialAt(sha, git) {
  let r = null;
  try { r = JSON.parse(git(["show", `${sha}:${TRIAL}`])); } catch { /* (not there, or not read) */ }
  const again = `try the release on a copy of a project that takes the core and whose owner allows it, before the release workflow is started, as AGENTS.md says ("A release is cut on the owner's word"): ${RUNS}; record it with \`node scripts/release.mjs --trial <the commit tried> <before> <after>\` (\`--trial <the commit>\` alone where no project allows one), in a pull request of its own; then start the release again`;
  if (!formed(r)) return { said: `The trial on a real project has not run for ${sha.slice(0, 7)}: ${TRIAL} ${r === null ? "is not there or cannot be read" : "is in no form this script writes"}.`, held: `the trial on a real project has not run for ${sha.slice(0, 7)}. Mend: ${again}` };
  let more;
  try { git(["merge-base", "--is-ancestor", r.commit, sha]); more = git(["diff", "--no-renames", "--name-only", r.commit, sha]).split("\n").map(f => f.trim()).filter(f => f && f !== TRIAL); } catch { more = null; }
  if (more === null || more.length) return { said: `The trial on a real project ran on ${r.commit.slice(0, 7)}, and this commit changes more since.`, held: `the trial's record stands for ${r.commit.slice(0, 7)}, and ${sha.slice(0, 7)} ${more ? `changes more than the record since (${more.slice(0, 3).join(", ")}${more.length > 3 ? ", …" : ""})` : "does not follow it"}. Mend: ${again}` };
  return {
    said: trialSaid(r),
    held: r.projects === 0 ? null : r.failedAfter ? `${plural(r.failedAfter, "check")} passed before the release and failed after it in the trial on a real project. Mend: find the release's fault from the trial's run after the update, mend it in the core in a pull request of its own, and ${again}`
      : r.stoppedAfter ? `${plural(r.stoppedAfter, "check")} did not run after the update in the trial on a real project, stopped behind a failure, so the trial measured nothing of ${r.stoppedAfter === 1 ? "it" : "them"}. Mend: find what stopped them from the trial's run after the update, mend it in the core in a pull request of its own where it is the release's, and ${again}` : null,
  };
}

// What a record in its form says.
const trialSaid = r => (r.projects === 0
  ? `No project that takes the core allowed a trial of this release (${TRIAL}, ${r.day}), so none ran.`
  : `The trial on a real project ran on ${r.commit.slice(0, 7)} on ${r.day}, in ${plural(r.projects, "project")}: ${plural(r.passedAfter, "check")} passed after the update, ${r.failedBoth} failed before and after (standing before the release), ${r.failedAfter} passed before and failed after (the release's), ${r.stoppedAfter} stopped after it behind a failure, and ${r.ranBeforeAlone} ran before the update alone; ${r.baselineFromClone} of the baselines taken by the release's check.mjs from a clone of the core, the copy's holding none that writes verdicts.`);

// How many of the owner's own projects take the core, as scripts/state-report.mjs --projects lists them (a line each,
// another owner's named as such), or null where it could not read them.
function ownProjects() {
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "state-report.mjs"), "--projects"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return ownCount(r.stdout);
}

// Of what state-report.mjs --projects prints, how many lines name a project of the owner's: each project is a line
// "- <how shownAs names it>: <its counts>.", another owner's named "a project of another owner"; its other lines (a
// heading, "None found.", a note in brackets) name none. releases-test.mjs holds it to shownAs's words.
export const ownCount = printed => printed.split("\n").filter(l => /^- (`[^`]+`|a private project of the owner's): /.test(l)).length;


// --trial <sha> [<before> <after>]...: writes the trial's record, each pair one project's runs of check.mjs --verdicts.
export function trial([sha, ...files], fail) {
  if (!/^[0-9a-f]{40}$/.test(sha ?? "") || files.length % 2) return fail(`--trial needs the full SHA of the commit tried, then for each project tried the file check.mjs --verdicts wrote before the update and the one it wrote after (${RUNS}); no file where no project allowed a trial`);
  const inside = files.find(f => !leadsOut(ROOT, f));
  if (inside) return fail(`${inside} lies in the core's own repository, where a project's job names could be committed: write the runs' verdicts to a scratch folder outside every repository, and give those files`);
  if (!files.length) { const own = ownProjects(); if (own === null || own > 0) return fail(own === null ? "which of the owner's projects take the core could not be read (scripts/state-report.mjs --projects), and nothing read is not none found. Mend: run it where gh answers for the owner's account, then --trial again" : `${plural(own, "project")} of the owner's take the core, as scripts/state-report.mjs --projects finds them. Mend: try the release on one of them, and record its runs before and after`); }
  const pairs = [];
  for (let i = 0; i < files.length; i += 2) {
    const verdict = ([job, x]) => (job === RUN_FROM ? typeof x === "string" : ["passed", "failed", "stopped"].includes(x));
    const read = f => { try { const v = JSON.parse(fs.readFileSync(f, "utf8")); return v && typeof v === "object" && !Array.isArray(v) && Object.entries(v).every(verdict) ? v : null; } catch { return null; } };
    const pair = [read(files[i]), read(files[i + 1])];
    if (pair.includes(null)) return fail(`${pair[0] === null ? files[i] : files[i + 1]} is no run's verdicts: give the files check.mjs --verdicts wrote`);
    if (Object.keys(pair[0]).some(j => j !== RUN_FROM) && !Object.keys(pair[1]).some(j => j !== RUN_FROM)) return fail(`${files[i + 1]} holds no job, where the run before the update held some: check.mjs ran nothing after it, so run it again and give what it writes`);
    pairs.push(pair);
  }
  const record = trialRecord(sha, new Date().toISOString().slice(0, 10), pairs);
  fs.writeFileSync(path.join(ROOT, TRIAL), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`${TRIAL} written. ${trialSaid(record)}`);
}
